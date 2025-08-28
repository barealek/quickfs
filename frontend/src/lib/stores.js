import { writable } from 'svelte/store';

// Current app state: 'upload', 'hosting', 'receiving'
export const currentStage = writable('upload');

// Selected file for upload
export const selectedFile = writable(null);

// Upload session data
export const uploadSession = writable(null);

// Connected receivers (for host)
export const connectedReceivers = writable([]);

// WebSocket connection
export const wsConnection = writable(null);

// Helper functions
export function resetToUpload() {
	currentStage.set('upload');
	selectedFile.set(null);
	uploadSession.set(null);
	connectedReceivers.set([]);
	wsConnection.update(ws => {
		if (ws) ws.close();
		return null;
	});
}

export function startHosting(file) {
	const metadata = {
		filename: file.name,
		filetype: file.type || 'application/octet-stream', // Fallback for unknown file types
		filesize: file.size
	};

	selectedFile.set(file);
	currentStage.set('hosting');

	// Will be set by the WebSocket connection
	return metadata;
}

export function joinSession(uploadId) {
	currentStage.set('receiving');
	return uploadId;
}
