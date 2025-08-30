// Global test function for debugging WebRTC
window.testWebRTCMessage = function() {
    if (wsService && wsService.ws) {
        console.log('Testing WebRTC message send...');
        wsService.send({
            type: 'webrtc_test',
            payload: {
                test: 'hello from frontend'
            }
        });
    } else {
        console.log('No WebSocket service available');
    }
};

// Global state
let currentPage = 'upload';
let currentFile = null;
let uploadSession = null;
let connectedReceivers = [];
let ws = null;
let webrtcManager = null;

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = savedTheme || systemTheme;

    // Remove both classes first
    document.documentElement.classList.remove('dark', 'light');
    document.body.classList.remove('dark', 'light');

    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
    } else {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');

    // Remove both classes
    document.documentElement.classList.remove('dark', 'light');
    document.body.classList.remove('dark', 'light');

    if (isDark) {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

// WebRTC Manager for peer-to-peer file transfer
class WebRTCManager {
    constructor() {
        this.peerConnections = new Map(); // receiverId -> RTCPeerConnection
        this.dataChannels = new Map(); // receiverId -> RTCDataChannel
        this.connectionStates = new Map(); // receiverId -> 'connecting' | 'connected' | 'failed'
        this.isHost = false;
        this.wsService = null;
        this.fileBuffer = new Map(); // receiverId -> { chunks: [], metadata: {} }

        // WebRTC configuration with STUN servers
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
        console.log('Creating WebRTC offer for receiver:', receiverId);
        try {
            const peerConnection = new RTCPeerConnection(this.rtcConfig);
            this.peerConnections.set(receiverId, peerConnection);

            // Create data channel for file transfer
            const dataChannel = peerConnection.createDataChannel('fileTransfer', {
                ordered: true
            });
            this.dataChannels.set(receiverId, dataChannel);

            console.log('Data channel created for receiver:', receiverId);
            this.setupDataChannel(dataChannel, receiverId);
            this.setupPeerConnectionEvents(peerConnection, receiverId);

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            console.log('Sending WebRTC offer via WebSocket for receiver:', receiverId);
            this.wsService.send({
                type: 'webrtc_offer',
                payload: {
                    receiver_id: receiverId,
                    offer: offer
                }
            });

            console.log('WebRTC offer created and sent for receiver:', receiverId);
        } catch (error) {
            console.error('Failed to create WebRTC offer:', error);
        }
    }

    // Receiver: Handle incoming offer
    async handleOffer(senderId, offer) {
        console.log('Handling WebRTC offer from sender:', senderId);
        try {
            const peerConnection = new RTCPeerConnection(this.rtcConfig);
            this.peerConnections.set(senderId, peerConnection);

            this.setupPeerConnectionEvents(peerConnection, senderId);

            // Handle incoming data channel
            peerConnection.ondatachannel = (event) => {
                const dataChannel = event.channel;
                console.log('Data channel received from host:', dataChannel);
                this.dataChannels.set(senderId, dataChannel);
                this.setupDataChannel(dataChannel, senderId);
                console.log('Data channel received from host');
            };

            // Set remote description and create answer
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            console.log('Sending WebRTC answer to host');
            this.wsService.send({
                type: 'webrtc_answer',
                payload: {
                    sender_id: senderId,
                    answer: answer
                }
            });

            console.log('WebRTC answer created and sent to host');
        } catch (error) {
            console.error('Failed to handle WebRTC offer:', error);
        }
    }

    // Host: Handle incoming answer
    async handleAnswer(receiverId, answer) {
        console.log('Handling WebRTC answer from receiver:', receiverId);
        try {
            const peerConnection = this.peerConnections.get(receiverId);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('WebRTC answer processed for receiver:', receiverId);
            } else {
                console.error('No peer connection found for receiver:', receiverId);
            }
        } catch (error) {
            console.error('Failed to handle WebRTC answer:', error);
        }
    }

    // Handle ICE candidates
    async handleIceCandidate(peerId, candidate) {
        console.log('Handling ICE candidate for peer:', peerId, candidate);
        try {
            const peerConnection = this.peerConnections.get(peerId);
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('ICE candidate added for peer:', peerId);
            } else {
                console.error('No peer connection found for peer:', peerId);
            }
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    setupPeerConnectionEvents(peerConnection, peerId) {
        console.log('Setting up peer connection events for:', peerId);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate for peer:', peerId);
                this.wsService.send({
                    type: 'webrtc_ice_candidate',
                    payload: {
                        peer_id: peerId,
                        candidate: event.candidate
                    }
                });
            } else {
                console.log('ICE gathering complete for peer:', peerId);
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log(`WebRTC connection state for ${peerId}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed') {
                this.closePeerConnection(peerId);
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state for ${peerId}:`, peerConnection.iceConnectionState);
        };
    }

    setupDataChannel(dataChannel, peerId) {
        console.log('Setting up data channel for peer:', peerId);
        this.connectionStates.set(peerId, 'connecting');

        dataChannel.onopen = () => {
            console.log(`Data channel opened for ${peerId}`);
            this.connectionStates.set(peerId, 'connected');
            this.updateReceiverConnectionStatus(peerId, 'connected');
        };

        dataChannel.onclose = () => {
            console.log(`Data channel closed for ${peerId}`);
            this.connectionStates.set(peerId, 'disconnected');
            this.updateReceiverConnectionStatus(peerId, 'disconnected');
        };

        dataChannel.onerror = (error) => {
            console.error(`Data channel error for ${peerId}:`, error);
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
                    this.fileBuffer.set(senderId, {
                        chunks: [],
                        metadata: message.metadata,
                        totalChunks: message.totalChunks,
                        receivedChunks: 0
                    });
                    console.log('File transfer started:', message.metadata.filename);
                    this.updateTransferProgress(senderId, 0);
                    break;

                case 'file_chunk':
                    this.handleFileChunk(senderId, message.chunkIndex, message.data);
                    break;

                case 'file_complete':
                    this.assembleAndDownloadFile(senderId);
                    break;
            }
        } catch (error) {
            console.error('Failed to parse data channel message:', error);
        }
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

        console.log(`Received chunk ${chunkIndex + 1}/${buffer.totalChunks} (${progress.toFixed(1)}%)`);

        // Check if all chunks received
        if (buffer.receivedChunks === buffer.totalChunks) {
            this.assembleAndDownloadFile(senderId);
        }
    }

    assembleAndDownloadFile(senderId) {
        const buffer = this.fileBuffer.get(senderId);
        if (!buffer) return;

        // Assemble file from chunks
        const totalSize = buffer.chunks.reduce((size, chunk) => size + chunk.length, 0);
        const fileData = new Uint8Array(totalSize);
        let offset = 0;

        for (const chunk of buffer.chunks) {
            fileData.set(chunk, offset);
            offset += chunk.length;
        }

        // Create blob and download
        const blob = new Blob([fileData], { type: buffer.metadata.filetype });
        this.downloadBlob(blob, buffer.metadata.filename);

        // Clean up
        this.fileBuffer.delete(senderId);
        this.updateTransferProgress(senderId, 100);

        console.log('File download completed:', buffer.metadata.filename);
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
        console.log('WebRTC sendFileToReceiver called for:', receiverId);
        console.log('Available data channels:', Array.from(this.dataChannels.keys()));
        console.log('Connection states:', Array.from(this.connectionStates.entries()));

        const dataChannel = this.dataChannels.get(receiverId);
        const connectionState = this.connectionStates.get(receiverId);

        console.log('Data channel for receiver:', dataChannel);
        console.log('Data channel ready state:', dataChannel ? dataChannel.readyState : 'no channel');
        console.log('Connection state:', connectionState);

        if (!dataChannel || dataChannel.readyState !== 'open' || connectionState !== 'connected') {
            console.error('Data channel not ready for receiver:', receiverId, 'channel state:', dataChannel ? dataChannel.readyState : 'no channel', 'connection state:', connectionState);
            return false;
        }

        try {
            // Read file as array buffer
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const fileData = new Uint8Array(arrayBuffer);

            // Calculate chunks
            const totalChunks = Math.ceil(fileData.length / this.chunkSize);

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

            // Send file in chunks
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.chunkSize;
                const end = Math.min(start + this.chunkSize, fileData.length);
                const chunk = fileData.slice(start, end);

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

            console.log('File sent successfully to receiver:', receiverId);
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

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
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
                    sendBtn.textContent = 'Send fil (WebRTC)';
                    sendBtn.disabled = false;
                    sendBtn.classList.remove('bg-yellow-500', 'bg-red-500');
                    sendBtn.classList.add('bg-green-500', 'hover:bg-green-600');
                    break;
                case 'failed':
                case 'disconnected':
                    sendBtn.textContent = 'Send fil (WebSocket)';
                    sendBtn.disabled = false;
                    sendBtn.classList.remove('bg-yellow-500', 'bg-green-500', 'hover:bg-green-600');
                    sendBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
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
        console.log('Peer connection closed for:', peerId);
    }

    closeAllConnections() {
        for (const peerId of this.peerConnections.keys()) {
            this.closePeerConnection(peerId);
        }
        console.log('All WebRTC connections closed');
    }
}

// Page navigation
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(`${pageName}-page`).classList.remove('hidden');
    currentPage = pageName;
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// WebSocket management
class WebSocketService {
    constructor() {
        this.ws = null;
        this.messageHandlers = new Map();
    }

    async connect(url) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}${url}`;

        console.log('Connecting to WebSocket:', wsUrl);

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('WebSocket connected');
                    resolve(this.ws);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('WebSocket message:', message);
                        this.handleMessage(message);
                    } catch (e) {
                        console.error('Failed to parse message:', e);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason);
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                console.error('Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Sending WebSocket message:', message);
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not ready, cannot send message:', message);
            console.log('WebSocket state:', this.ws ? this.ws.readyState : 'no websocket');
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'upload_created':
                uploadSession = message.payload;
                updateHostPage();
                break;
            case 'receivers_update':
                console.log('Received receivers update:', message.payload);
                connectedReceivers = message.payload;
                updateReceiversList();
                // Create WebRTC offers for new receivers if we're the host
                if (webrtcManager && webrtcManager.isHost) {
                    console.log('Creating WebRTC offers for new receivers as host');
                    console.log('Current peer connections:', Array.from(webrtcManager.peerConnections.keys()));

                    // Add a small delay to ensure receiver is ready
                    setTimeout(() => {
                        message.payload.forEach(receiver => {
                            console.log('Checking receiver:', receiver.id);
                            if (!webrtcManager.peerConnections.has(receiver.id)) {
                                console.log('Creating offer for new receiver:', receiver.id);
                                webrtcManager.createOffer(receiver.id);
                            } else {
                                console.log('Peer connection already exists for receiver:', receiver.id);
                            }
                        });
                    }, 500); // 500ms delay
                } else {
                    console.log('Not creating offers - webrtcManager:', !!webrtcManager, 'isHost:', webrtcManager ? webrtcManager.isHost : 'N/A');
                }
                break;
            case 'file_metadata':
                showFileMetadata(message.payload);
                break;
            case 'file_data':
                // Legacy WebSocket file transfer - we'll phase this out
                handleFileDownload(message.payload);
                break;
            // WebRTC signaling messages
            case 'webrtc_offer':
                console.log('Received WebRTC offer:', message.payload);
                if (webrtcManager && !webrtcManager.isHost) {
                    webrtcManager.handleOffer(message.payload.sender_id, message.payload.offer);
                } else {
                    console.log('Ignoring offer - not a receiver or no webrtcManager');
                }
                break;
            case 'webrtc_answer':
                console.log('Received WebRTC answer:', message.payload);
                if (webrtcManager && webrtcManager.isHost) {
                    webrtcManager.handleAnswer(message.payload.receiver_id, message.payload.answer);
                } else {
                    console.log('Ignoring answer - not a host or no webrtcManager');
                }
                break;
            case 'webrtc_ice_candidate':
                console.log('Received ICE candidate:', message.payload);
                if (webrtcManager) {
                    webrtcManager.handleIceCandidate(message.payload.peer_id, message.payload.candidate);
                } else {
                    console.log('Ignoring ICE candidate - no webrtcManager');
                }
                break;
        }
    }


    async createUploadSession(metadata) {
        const params = new URLSearchParams({
            filename: metadata.filename,
            filetype: metadata.filetype,
            filesize: metadata.filesize.toString()
        });

        await this.connect(`/api/upload?${params.toString()}`);
    }

    joinUpload(userName, publicKey) {
        this.send({
            type: 'join_request',
            payload: {
                name: userName,
                public_key: publicKey
            }
        });
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

const wsService = new WebSocketService();

// File upload functionality
function handleFileSelect(file) {
    if (!file) return;

    currentFile = file;
    console.log('File selected:', file);

    // Show loading state
    document.getElementById('upload-content').classList.add('hidden');
    document.getElementById('loading-content').classList.remove('hidden');

    // Create file metadata
    const metadata = {
        filename: file.name,
        filetype: file.type || 'application/octet-stream',
        filesize: file.size
    };

    // Start upload session
    wsService.createUploadSession(metadata)
        .then(() => {
            // Initialize WebRTC as host
            webrtcManager = new WebRTCManager();
            webrtcManager.setWebSocketService(wsService);
            webrtcManager.setIsHost(true);
            showPage('host');
        })
        .catch((error) => {
            console.error('Failed to start hosting:', error);
            resetUploadState();
        });
}

function resetUploadState() {
    document.getElementById('upload-content').classList.remove('hidden');
    document.getElementById('loading-content').classList.add('hidden');
    currentFile = null;
    uploadSession = null;

    // Close WebRTC connections
    if (webrtcManager) {
        webrtcManager.closeAllConnections();
        webrtcManager = null;
    }
}

// Host page functionality
function updateHostPage() {
    if (!uploadSession || !currentFile) return;

    // Update file info
    document.getElementById('file-name').textContent = currentFile.name;
    document.getElementById('file-size').textContent = formatFileSize(currentFile.size);
    document.getElementById('file-type').textContent = currentFile.type || 'Unknown';

    // Update share URL
    const shareUrl = `${window.location.origin}/join?uploadid=${uploadSession.id}`;
    document.getElementById('share-url').value = shareUrl;

    // Generate QR code (simplified placeholder)
    updateQRCode(shareUrl);
}

function updateQRCode(url) {
    const qrCode = document.getElementById('qr-code');
    qrCode.innerHTML = `
        <div class="w-24 h-24 bg-white/90 dark:bg-gray-800/90 rounded-lg flex items-center justify-center">
            <span class="text-xs text-gray-600 dark:text-gray-400">QR: ${url.substr(-6)}</span>
        </div>
    `;
}

function updateReceiversList() {
    const receiversList = document.getElementById('receivers-list');
    const receiverCount = document.getElementById('receiver-count');

    receiverCount.textContent = connectedReceivers.length;

    if (connectedReceivers.length === 0) {
        receiversList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Ingen tilsluttede endnu...</p>';
    } else {
        receiversList.innerHTML = connectedReceivers.map(receiver => {
            // Check WebRTC connection status
            const connectionState = webrtcManager ? webrtcManager.connectionStates.get(receiver.id) : null;
            let buttonClass = 'bg-yellow-500'; // Default to connecting
            let buttonText = 'Tilslutter...';
            let buttonDisabled = true;

            if (connectionState === 'connected') {
                buttonClass = 'bg-green-500 hover:bg-green-600';
                buttonText = 'Send fil (WebRTC)';
                buttonDisabled = false;
            } else if (connectionState === 'failed' || connectionState === 'disconnected') {
                buttonClass = 'bg-blue-500 hover:bg-blue-600';
                buttonText = 'Send fil (WebSocket)';
                buttonDisabled = false;
            }

            return `
                <div class="flex items-center justify-between p-3 glass-light rounded-lg">
                    <div class="flex-1">
                        <span class="text-sm font-medium text-gray-900 dark:text-white">${receiver.name}</span>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Tilsluttet</p>
                    </div>
                    <button
                        onclick="sendFileToReceiver(${JSON.stringify(receiver).replace(/"/g, '&quot;')})"
                        data-receiver-id="${receiver.id}"
                        class="px-3 py-1 text-xs font-medium text-white ${buttonClass} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                        ${buttonDisabled ? 'disabled' : ''}
                    >
                        ${buttonText}
                    </button>
                </div>
            `;
        }).join('');
    }

    // Enable send button if there are receivers
    const sendBtn = document.getElementById('send-file-btn');
    sendBtn.disabled = connectedReceivers.length === 0;
}// Join page functionality
function initJoinPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const uploadId = urlParams.get('uploadid');

    if (uploadId) {
        showPage('join');
        // Store upload ID for later use
        window.currentUploadId = uploadId;
    }
}

function joinUpload() {
    const userName = document.getElementById('user-name').value.trim();
    if (!userName) return;

    // Show connection status
    document.getElementById('name-input-section').classList.add('hidden');
    document.getElementById('connection-status').classList.remove('hidden');

    // Generate simple public key
    const publicKey = 'demo-public-key-' + generateId();

    // Connect to WebSocket
    wsService.connect(`/api/join/${window.currentUploadId}`)
        .then(() => {
            // Initialize WebRTC as receiver
            webrtcManager = new WebRTCManager();
            webrtcManager.setWebSocketService(wsService);
            webrtcManager.setIsHost(false);
            wsService.joinUpload(userName, publicKey);
        })
        .catch((error) => {
            console.error('Failed to join upload:', error);
            // Reset to name input
            document.getElementById('connection-status').classList.add('hidden');
            document.getElementById('name-input-section').classList.remove('hidden');
        });
}

function showFileMetadata(metadata) {
    // Hide connection status
    document.getElementById('connection-status').classList.add('hidden');

    // Store metadata for use in file download
    window.currentFileMetadata = metadata;

    // Show file info
    document.getElementById('join-file-name').textContent = metadata.filename;
    document.getElementById('join-file-size').textContent = formatFileSize(metadata.filesize);
    document.getElementById('join-file-type').textContent = metadata.filetype;
    document.getElementById('file-info-section').classList.remove('hidden');
}

function handleFileDownload(data) {
    console.log('File download started:', data);

    if (!data) {
        console.error('No file data received');
        return;
    }

    // Get metadata from the join session (we should store this when metadata is received)
    const metadata = window.currentFileMetadata || {};
    const filename = metadata.filename || 'received-file';
    const filetype = metadata.filetype || 'application/octet-stream';

    // Handle file download based on data type
    if (typeof data === 'string') {
        // For text data or base64 encoded data
        if (data.startsWith('data:')) {
            // Handle data URL (base64 encoded)
            downloadDataURL(data, filename);
        } else {
            // Handle plain text
            const blob = new Blob([data], { type: filetype });
            downloadBlob(blob, filename);
        }
    } else if (data instanceof ArrayBuffer) {
        // Handle binary data
        const blob = new Blob([data], { type: filetype });
        downloadBlob(blob, filename);
    } else {
        console.warn('Unknown file data format:', typeof data);
        // Try to convert to string and download as text
        const blob = new Blob([String(data)], { type: 'text/plain' });
        downloadBlob(blob, filename);
    }

    // Show download success status
    const waitingStatus = document.getElementById('waiting-status');
    const downloadStatus = document.getElementById('download-status');
    if (waitingStatus && downloadStatus) {
        waitingStatus.classList.add('hidden');
        downloadStatus.classList.remove('hidden');
        downloadStatus.classList.add('flex');
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('File downloaded:', filename);
}

function downloadDataURL(dataURL, filename) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('File downloaded:', filename);
}

function sendFileToReceiver(receiver) {
    if (!currentFile) {
        console.error('No file selected');
        return;
    }

    console.log('Sending file to receiver via WebRTC:', receiver.name);

    // Use WebRTC if available, fallback to WebSocket
    if (webrtcManager && webrtcManager.isHost) {
        webrtcManager.sendFileToReceiver(receiver.id, currentFile)
            .then(success => {
                if (!success) {
                    console.warn('WebRTC transfer failed, falling back to WebSocket');
                    sendFileViaWebSocket(receiver);
                }
            })
            .catch(error => {
                console.error('WebRTC transfer error, falling back to WebSocket:', error);
                sendFileViaWebSocket(receiver);
            });
    } else {
        // Fallback to WebSocket transfer
        sendFileViaWebSocket(receiver);
    }
}

// Legacy WebSocket file transfer (fallback)
function sendFileViaWebSocket(receiver) {
    console.log('Sending file via WebSocket to receiver:', receiver.name);

    const reader = new FileReader();

    reader.onload = (e) => {
        const fileData = e.target.result;
        console.log('File read successfully, sending to receiver:', receiver.id);
        wsService.sendFileToReceiver(receiver.id, fileData);

        // Show feedback to user
        const sendBtn = document.querySelector(`[data-receiver-id="${receiver.id}"]`);
        if (sendBtn) {
            const originalText = sendBtn.textContent;
            sendBtn.textContent = 'Sendt!';
            sendBtn.disabled = true;
            setTimeout(() => {
                sendBtn.textContent = originalText;
                sendBtn.disabled = false;
            }, 2000);
        }
    };

    reader.onerror = (e) => {
        console.error('Failed to read file:', e);
        alert('Fejl ved læsning af fil');
    };

    // Choose read method based on file type
    if (currentFile.type.startsWith('text/')) {
        reader.readAsText(currentFile);
    } else {
        // For binary files, convert to base64 data URL
        reader.readAsDataURL(currentFile);
    }
}

// Copy to clipboard
function copyToClipboard() {
    const shareUrl = document.getElementById('share-url');
    navigator.clipboard.writeText(shareUrl.value).then(() => {
        const copyBtn = document.getElementById('copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Kopieret!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initTheme();

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // File upload handling
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('file-drop-zone');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelect(file);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-orange-500', 'bg-orange-50', 'dark:bg-indigo-400/10');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-orange-500', 'bg-orange-50', 'dark:bg-indigo-400/10');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-orange-500', 'bg-orange-50', 'dark:bg-indigo-400/10');
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    });

    // Host page buttons
    document.getElementById('copy-btn').addEventListener('click', copyToClipboard);
    document.getElementById('back-btn').addEventListener('click', () => {
        wsService.close();
        if (webrtcManager) {
            webrtcManager.closeAllConnections();
            webrtcManager = null;
        }
        resetUploadState();
        showPage('upload');
    });
    document.getElementById('send-file-btn').addEventListener('click', () => {
        // Send file to all connected receivers
        if (connectedReceivers.length === 0) {
            alert('Ingen modtagere tilsluttet');
            return;
        }

        connectedReceivers.forEach(receiver => {
            sendFileToReceiver(receiver);
        });
    });

    // Join page buttons
    document.getElementById('join-btn').addEventListener('click', joinUpload);
    document.getElementById('user-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinUpload();
    });
    document.getElementById('join-back-btn').addEventListener('click', () => {
        wsService.close();
        if (webrtcManager) {
            webrtcManager.closeAllConnections();
            webrtcManager = null;
        }
        showPage('upload');
        // Clear URL parameters
        window.history.replaceState({}, document.title, '/');
    });

    // Check for join URL on load
    initJoinPage();
});
