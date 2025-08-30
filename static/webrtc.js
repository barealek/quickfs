// WebRTC manager implementerer WebRTC som tillader P2P filoverførsel fra host til receiver
class WebRTCManager {
    constructor() {
        this.peerConnections = new Map(); // receiverId -> RTCPeerConnection
        this.dataChannels = new Map(); // receiverId -> RTCDataChannel
        this.connectionStates = new Map(); // receiverId -> 'connecting' | 'connected' | 'failed'
        this.isHost = false;
        this.wsService = null;
        this.fileBuffer = new Map(); // receiverId -> { chunks: [], metadata: {} }

        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // File transfer chunk size (16KB)
        this.chunkSize = 16384;
    }

    setWebSocketService(wsService) {
        this.wsService = wsService;
    }

    setIsHost(isHost) {
        this.isHost = isHost;
    }

    // Host: Create offer for a new receiver
    async createOffer(receiverId) {
        try {
            const peerConnection = new RTCPeerConnection(this.rtcConfig);
            this.peerConnections.set(receiverId, peerConnection);

            // Create data channel for file transfer
            const dataChannel = peerConnection.createDataChannel('fileTransfer', {
                ordered: true
            });
            this.dataChannels.set(receiverId, dataChannel);

            this.setupDataChannel(dataChannel, receiverId);
            this.setupPeerConnectionEvents(peerConnection, receiverId);

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            this.wsService.send({
                type: 'webrtc_offer',
                payload: {
                    receiver_id: receiverId,
                    offer: offer
                }
            });
        } catch (error) {
            console.error('Failed to create WebRTC offer:', error);
        }
    }

    // Receiver: Handle incoming offer
    async handleOffer(senderId, offer) {
        try {
            const peerConnection = new RTCPeerConnection(this.rtcConfig);
            this.peerConnections.set(senderId, peerConnection);

            this.setupPeerConnectionEvents(peerConnection, senderId);

            // Handle incoming data channel
            peerConnection.ondatachannel = (event) => {
                const dataChannel = event.channel;
                this.dataChannels.set(senderId, dataChannel);
                this.setupDataChannel(dataChannel, senderId);
            };

            // Set remote description and create answer
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            this.wsService.send({
                type: 'webrtc_answer',
                payload: {
                    sender_id: senderId,
                    answer: answer
                }
            });
        } catch (error) {
            console.error('Failed to handle WebRTC offer:', error);
        }
    }

    // Host: Handle incoming answer
    async handleAnswer(receiverId, answer) {
        try {
            const peerConnection = this.peerConnections.get(receiverId);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        } catch (error) {
            console.error('Failed to handle WebRTC answer:', error);
        }
    }

    // Handle ICE candidates
    async handleIceCandidate(peerId, candidate) {
        try {
            const peerConnection = this.peerConnections.get(peerId);
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    setupPeerConnectionEvents(peerConnection, peerId) {
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.wsService.send({
                    type: 'webrtc_ice_candidate',
                    payload: {
                        peer_id: peerId,
                        candidate: event.candidate
                    }
                });
            }
        };

        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'failed') {
                this.closePeerConnection(peerId);
            }
        };
    }

    setupDataChannel(dataChannel, peerId) {
        this.connectionStates.set(peerId, 'connecting');

        dataChannel.onopen = () => {
            this.connectionStates.set(peerId, 'connected');
            this.updateReceiverConnectionStatus(peerId, 'connected');
        };

        dataChannel.onclose = () => {
            this.connectionStates.set(peerId, 'disconnected');
            this.updateReceiverConnectionStatus(peerId, 'disconnected');
        };

        dataChannel.onerror = (error) => {
            this.connectionStates.set(peerId, 'failed');
            this.updateReceiverConnectionStatus(peerId, 'failed');
        };

        dataChannel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data, peerId);
        };
    }

    handleDataChannelMessage(data, senderId) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'file_start':
                    this.initializeFileReceive(senderId, message.metadata, message.totalChunks);
                    this.updateTransferProgress(senderId, 0);
                    break;

                case 'file_chunk':
                    this.handleFileChunk(senderId, message.chunkIndex, message.data);
                    break;

                case 'file_complete':
                    this.finalizeFileReceive(senderId);
                    break;
            }
        } catch (error) {
            console.error('Failed to parse data channel message:', error);
        }
    }

    initializeFileReceive(senderId, metadata, totalChunks) {
        // Initialize file receive with streaming approach
        this.fileBuffer.set(senderId, {
            metadata: metadata,
            totalChunks: totalChunks,
            receivedChunks: 0,
            chunks: new Array(totalChunks), // Sparse array for chunks
            writableStream: null,
            writer: null
        });

        // Create a TransformStream for assembling chunks
        const transformStream = new TransformStream({
            transform(chunk, controller) {
                controller.enqueue(chunk);
            }
        });

        const buffer = this.fileBuffer.get(senderId);
        buffer.writableStream = transformStream.writable;
        buffer.readableStream = transformStream.readable;
    }

    handleFileChunk(senderId, chunkIndex, chunkData) {
        const buffer = this.fileBuffer.get(senderId);
        if (!buffer) return;

        // Convert base64 back to binary data
        const binaryData = Uint8Array.from(atob(chunkData), c => c.charCodeAt(0));
        buffer.chunks[chunkIndex] = binaryData;
        buffer.receivedChunks++;

        // Update progress
        const progress = (buffer.receivedChunks / buffer.totalChunks) * 100;
        this.updateTransferProgress(senderId, progress);

        // Check if all chunks received
        if (buffer.receivedChunks === buffer.totalChunks) {
            this.assembleAndDownloadFile(senderId);
        }
    }

    finalizeFileReceive(senderId) {
        // Ensure all chunks are received before finalizing
        const buffer = this.fileBuffer.get(senderId);
        if (buffer && buffer.receivedChunks === buffer.totalChunks) {
            this.assembleAndDownloadFile(senderId);
        }
    }

    assembleAndDownloadFile(senderId) {
        const buffer = this.fileBuffer.get(senderId);
        if (!buffer) return;

        try {
            // Use streaming approach for large files
            if (buffer.metadata.filesize > 50 * 1024 * 1024) { // 50MB threshold
                this.streamDownloadFile(senderId, buffer);
            } else {
                // For smaller files, use the traditional approach
                this.traditionalDownloadFile(senderId, buffer);
            }
        } catch (error) {
            console.error('Failed to assemble file:', error);
            // Fallback to traditional method
            this.traditionalDownloadFile(senderId, buffer);
        }
    }

    streamDownloadFile(senderId, buffer) {
        // For large files, create blob parts incrementally to avoid memory spikes
        const blobParts = [];

        // Process chunks in batches to control memory usage
        for (let i = 0; i < buffer.chunks.length; i++) {
            const chunk = buffer.chunks[i];
            if (chunk) {
                blobParts.push(chunk);
                buffer.chunks[i] = null; // Free memory immediately
            }

            // Every 100 chunks, yield control to prevent blocking
            if (i % 100 === 0) {
                // Use setTimeout to yield control and prevent UI blocking
                setTimeout(() => {}, 0);
            }
        }

        // Create blob and download
        const blob = new Blob(blobParts, { type: buffer.metadata.filetype });
        this.downloadBlob(blob, buffer.metadata.filename);

        // Clean up
        this.fileBuffer.delete(senderId);
        this.updateTransferProgress(senderId, 100);
    }

    traditionalDownloadFile(senderId, buffer) {
        // Assemble file from chunks (original method for smaller files)
        const totalSize = buffer.chunks.reduce((size, chunk) => size + (chunk ? chunk.length : 0), 0);
        const fileData = new Uint8Array(totalSize);
        let offset = 0;

        for (const chunk of buffer.chunks) {
            if (chunk) {
                fileData.set(chunk, offset);
                offset += chunk.length;
            }
        }

        // Create blob and download
        const blob = new Blob([fileData], { type: buffer.metadata.filetype });
        this.downloadBlob(blob, buffer.metadata.filename);

        // Clean up
        this.fileBuffer.delete(senderId);
        this.updateTransferProgress(senderId, 100);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show download success status
        const waitingStatus = document.getElementById('waiting-status');
        const downloadStatus = document.getElementById('download-status');
        if (waitingStatus && downloadStatus) {
            waitingStatus.classList.add('hidden');
            downloadStatus.classList.remove('hidden');
            downloadStatus.classList.add('flex');
        }
    }

    updateTransferProgress(peerId, progress) {
        // Update UI with transfer progress
        const progressElement = document.getElementById(`progress-${peerId}`);
        if (progressElement) {
            progressElement.textContent = `${progress.toFixed(1)}%`;
        }

        // Update waiting status text for receivers
        const waitingStatus = document.getElementById('waiting-status');
        if (waitingStatus && progress > 0 && progress < 100) {
            waitingStatus.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    <span>Modtager fil... ${progress.toFixed(1)}%</span>
                </div>
            `;
        }
    }

    // Host: Send file to specific receiver via WebRTC
    async sendFileToReceiver(receiverId, file) {
        const dataChannel = this.dataChannels.get(receiverId);
        const connectionState = this.connectionStates.get(receiverId);

        if (!dataChannel || dataChannel.readyState !== 'open' || connectionState !== 'connected') {
            return false;
        }

        try {
            // Calculate chunks without loading the entire file
            const totalChunks = Math.ceil(file.size / this.chunkSize);

            // Send file metadata
            const metadata = {
                filename: file.name,
                filetype: file.type || 'application/octet-stream',
                filesize: file.size
            };

            dataChannel.send(JSON.stringify({
                type: 'file_start',
                metadata: metadata,
                totalChunks: totalChunks
            }));

            // Send file in chunks using streaming approach
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.chunkSize;
                const end = Math.min(start + this.chunkSize, file.size);

                // Read only the current chunk from file
                const chunk = await this.readFileChunk(file, start, end);

                // Convert to base64 for JSON transmission
                const chunkBase64 = btoa(String.fromCharCode(...chunk));

                dataChannel.send(JSON.stringify({
                    type: 'file_chunk',
                    chunkIndex: i,
                    data: chunkBase64
                }));

                // Update progress for host
                const progress = ((i + 1) / totalChunks) * 100;
                this.updateSendProgress(receiverId, progress);

                // Small delay to prevent overwhelming the data channel
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }

            // Send completion signal
            dataChannel.send(JSON.stringify({
                type: 'file_complete'
            }));

            return true;
        } catch (error) {
            console.error('Failed to send file:', error);
            return false;
        }
    }

    updateSendProgress(receiverId, progress) {
        const sendBtn = document.querySelector(`[data-receiver-id="${receiverId}"]`);
        if (sendBtn) {
            sendBtn.textContent = `Sender... ${progress.toFixed(1)}%`;
            sendBtn.disabled = true;

            if (progress >= 100) {
                sendBtn.textContent = 'Sendt!';
                setTimeout(() => {
                    sendBtn.textContent = 'Send fil';
                    sendBtn.disabled = false;
                }, 2000);
            }
        }
    }

    readFileChunk(file, start, end) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const arrayBuffer = reader.result;
                const chunk = new Uint8Array(arrayBuffer);
                resolve(chunk);
            };
            reader.onerror = () => reject(reader.error);

            // Read only the specific slice of the file
            const blob = file.slice(start, end);
            reader.readAsArrayBuffer(blob);
        });
    }

    updateReceiverConnectionStatus(receiverId, status) {
        // Update UI to show WebRTC connection status
        const sendBtn = document.querySelector(`[data-receiver-id="${receiverId}"]`);
        if (sendBtn) {
            switch (status) {
                case 'connecting':
                    sendBtn.textContent = 'Tilslutter...';
                    sendBtn.disabled = true;
                    sendBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
                    sendBtn.classList.add('bg-yellow-500');
                    break;
                case 'connected':
                    sendBtn.textContent = 'Send fil';
                    sendBtn.disabled = false;
                    sendBtn.classList.remove('bg-yellow-500', 'bg-red-500');
                    sendBtn.classList.add('bg-green-500', 'hover:bg-green-600');
                    break;
                case 'failed':
                case 'disconnected':
                    sendBtn.textContent = 'Forbindelse fejlet';
                    sendBtn.disabled = true;
                    sendBtn.classList.remove('bg-yellow-500', 'bg-green-500', 'hover:bg-green-600');
                    sendBtn.classList.add('bg-red-500');
                    break;
            }
        }
    }

    closePeerConnection(peerId) {
        const peerConnection = this.peerConnections.get(peerId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(peerId);
        }

        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel) {
            dataChannel.close();
            this.dataChannels.delete(peerId);
        }

        this.fileBuffer.delete(peerId);
        this.connectionStates.delete(peerId);
    }

    closeAllConnections() {
        for (const peerId of this.peerConnections.keys()) {
            this.closePeerConnection(peerId);
        }
    }
}
