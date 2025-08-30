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

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    resolve(this.ws);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (e) {
                        console.error('Failed to parse message:', e);
                    }
                };

                this.ws.onclose = (event) => {
                    // Connection closed
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
            this.ws.send(JSON.stringify(message));
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'upload_created':
                uploadSession = message.payload;
                updateHostPage();
                break;
            case 'receivers_update':
                connectedReceivers = message.payload;
                updateReceiversList();
                // Create WebRTC offers for new receivers if we're the host
                if (webrtcManager && webrtcManager.isHost) {
                    // Add a small delay to ensure receiver is ready
                    setTimeout(() => {
                        message.payload.forEach(receiver => {
                            if (!webrtcManager.peerConnections.has(receiver.id)) {
                                webrtcManager.createOffer(receiver.id);
                            }
                        });
                    }, 500); // 500ms delay
                }
                break;
            case 'file_metadata':
                showFileMetadata(message.payload);
                break;
            // WebRTC signaling messages
            case 'webrtc_offer':
                if (webrtcManager && !webrtcManager.isHost) {
                    webrtcManager.handleOffer(message.payload.sender_id, message.payload.offer);
                }
                break;
            case 'webrtc_answer':
                if (webrtcManager && webrtcManager.isHost) {
                    webrtcManager.handleAnswer(message.payload.receiver_id, message.payload.answer);
                }
                break;
            case 'webrtc_ice_candidate':
                if (webrtcManager) {
                    webrtcManager.handleIceCandidate(message.payload.peer_id, message.payload.candidate);
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
                buttonText = 'Send fil';
                buttonDisabled = false;
            } else if (connectionState === 'failed' || connectionState === 'disconnected') {
                buttonClass = 'bg-red-500';
                buttonText = 'Forbindelse fejlet';
                buttonDisabled = true;
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
}

function sendFileToReceiver(receiver) {
    if (!currentFile) {
        return;
    }

    // Send file via WebRTC
    if (webrtcManager && webrtcManager.isHost) {
        webrtcManager.sendFileToReceiver(receiver.id, currentFile);
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
