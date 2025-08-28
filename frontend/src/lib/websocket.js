import { wsConnection, uploadSession, connectedReceivers } from './stores.js';

class WebSocketService {
	constructor() {
		this.ws = null;
		this.messageHandlers = new Map();
		this.currentFileMetadata = null; // Store metadata for use in handleFileData
	}

	async createUploadSession(metadata) {
		console.log('Creating upload session with metadata:', metadata);

		try {
			// Create WebSocket URL with metadata as query parameters
			const params = new URLSearchParams({
				filename: metadata.filename,
				filetype: metadata.filetype,
				filesize: metadata.filesize.toString()
			});

			const wsUrl = `/api/upload?${params.toString()}`;
			console.log('Connecting to WebSocket with URL:', wsUrl);

			// Connect to WebSocket with metadata in query params
			await this.connect(wsUrl);

			return null; // Upload ID will come from the server response

		} catch (error) {
			console.error('Failed to create upload session:', error);
			throw error;
		}
	}

	connect(url) {
		// Convert relative URL to absolute WebSocket URL
		let wsUrl;
		if (url.startsWith('/')) {
			// Relative URL - construct WebSocket URL based on current location
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const host = window.location.host;
			wsUrl = `${protocol}//${host}${url}`;
		} else {
			// Absolute URL - use as is
			wsUrl = url;
		}

		console.log('Connecting to WebSocket:', wsUrl);
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(wsUrl);

				this.ws.onopen = () => {
					console.log('WebSocket connected to:', wsUrl);
					wsConnection.set(this.ws);
					resolve(this.ws);
				};

				this.ws.onmessage = (event) => {
					console.log('Raw WebSocket message:', event.data);
					try {
						const message = JSON.parse(event.data);
						console.log('Parsed message:', message);
						this.handleMessage(message);
					} catch (e) {
						console.error('Failed to parse message:', e, event.data);
					}
				};

				this.ws.onclose = (event) => {
					console.log('WebSocket disconnected:', event.code, event.reason);
					wsConnection.set(null);
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
	}	send(message) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	handleMessage(message) {
		console.log('Handling message type:', message.type, 'payload:', message.payload);

		switch (message.type) {
			case 'upload_created':
				console.log('Upload created with ID:', message.payload.id);
				uploadSession.set(message.payload);
				break;
			case 'receivers_update':
				console.log('Receivers update:', message.payload);
				connectedReceivers.set(message.payload);
				break;
			case 'file_metadata':
				console.log('File metadata received:', message.payload);
				this.handleFileMetadata(message.payload);
				break;
			case 'file_data':
				console.log('File data received');
				this.handleFileData(message.payload);
				break;
			default:
				console.log('Unknown message type:', message.type);
		}

		// Call any registered handlers
		const handler = this.messageHandlers.get(message.type);
		if (handler) {
			console.log('Calling registered handler for:', message.type);
			handler(message.payload);
		}
	}

	handleFileMetadata(metadata) {
		console.log('Received file metadata:', metadata);
		// Store metadata for use in handleFileData
		this.currentFileMetadata = metadata;
	}

	handleFileData(data) {
		console.log('Received file data with metadata:', this.currentFileMetadata);

		// Use metadata if available
		const filename = this.currentFileMetadata?.filename || 'received-file';
		const filetype = this.currentFileMetadata?.filetype || 'application/octet-stream';

		// Handle file download based on data type
		if (typeof data === 'string') {
			// For text data or base64 encoded data
			if (data.startsWith('data:')) {
				// Handle data URL (base64 encoded)
				this.downloadDataURL(data, filename);
			} else {
				// Handle plain text
				const blob = new Blob([data], { type: filetype });
				this.downloadBlob(blob, filename);
			}
		} else if (data instanceof ArrayBuffer) {
			// Handle binary data
			const blob = new Blob([data], { type: filetype });
			this.downloadBlob(blob, filename);
		} else {
			console.warn('Unknown file data format:', typeof data);
		}
	}


	downloadBlob(blob, filename) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	downloadDataURL(dataURL, filename) {
		const a = document.createElement('a');
		a.href = dataURL;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	onMessage(type, handler) {
		this.messageHandlers.set(type, handler);
	}

	requestFile() {
		this.send({
			type: 'request_file',
			payload: {}
		});
	}

	sendFileToReceiver(receiverId, fileData) {
		this.send({
			type: 'send_file',
			payload: {
				receiver_id: receiverId,
				file_data: fileData
			}
		});
	}

	joinUpload(name, publicKey) {
		this.send({
			type: 'join_request',
			payload: {
				name: name,
				public_key: publicKey
			}
		});
	}

	close() {
		if (this.ws) {
			this.ws.close();
		}
	}
}

export const wsService = new WebSocketService();
