<script>
	import { selectedFile, startHosting } from '$lib/stores.js';
	import { wsService } from '$lib/websocket.js';
   import { goto } from '$app/navigation';

	let fileInput;
	let isDragOver = $state(false);
	let isUploading = $state(false);

	function handleFileSelect(event) {
		console.log('File input changed:', event);
		const file = event.target.files[0];
		console.log('Selected file:', file);
		if (file) {
			handleFile(file);
		} else {
			console.log('No file selected');
		}
	}

	function handleDrop(event) {
		console.log('File dropped:', event);
		event.preventDefault();
		isDragOver = false;
		const file = event.dataTransfer.files[0];
		console.log('Dropped file:', file);
		if (file) {
			handleFile(file);
		}
	}

	function handleDragOver(event) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event) {
		event.preventDefault();
		isDragOver = false;
	}

	async function handleFile(file) {
		console.log('File selected:', file);
		isUploading = true;

		try {
			const metadata = startHosting(file);
			console.log('Starting hosting with metadata:', metadata);

			// Create upload session via WebSocket with query parameters
			await wsService.createUploadSession(metadata);

			console.log('Upload session created, waiting for server response...');

			// Wait a bit for the upload_created message from server
			setTimeout(() => {
				console.log('Navigating to host page...');
				goto('/host');
			}, 2000);

		} catch (error) {
			console.error('Failed to start hosting:', error);
			isUploading = false;
		}
	}

	function openFileDialog() {
		console.log('File dialog opened');
		fileInput?.click();
	}
</script>

<svelte:head>
	<title>QuickFS - Del dine filer sikkert</title>
</svelte:head>

<style>
	.font-mulish {
		font-family: 'Mulish', sans-serif;
	}
</style>

<!-- Hero -->
<div class="min-h-screen py-16 sm:py-24">
	<div class="mx-auto max-w-7xl sm:px-6 lg:px-8">
		<div class="relative px-6 py-24 overflow-hidden shadow-2xl isolate card sm:rounded-3xl sm:px-24 xl:py-32">
			<h2 class="max-w-3xl mx-auto text-4xl font-extrabold tracking-tight text-center text-gray-900 dark:text-white sm:text-5xl font-mulish">
				Del dine filer på en sikker måde.
			</h2>
			<p class="max-w-lg mx-auto mt-6 text-lg text-center text-gray-700 dark:text-gray-300">
				Ingen konto. E2E-krypteret. Open-source. Kan self-hostes. Privatlivs-fokuseret. Sikker.
			</p>

			<div class="mt-12">
				<label
					for="file-upload"
					class="relative block w-full rounded-lg border-2 border-dashed transition-all cursor-pointer
						{isDragOver ? 'border-orange-500 bg-orange-50 dark:bg-indigo-400/10' : 'border-gray-400 dark:border-gray-500'}
						{isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-orange-500 dark:hover:border-indigo-400'}
						p-12 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-orange-500 dark:focus-within:outline-indigo-500"
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
				>
					<input
						bind:this={fileInput}
						id="file-upload"
						name="file-upload"
						type="file"
						class="sr-only"
						onchange={handleFileSelect}
						disabled={isUploading}
					>

					{#if isUploading}
						<div class="mx-auto border-4 border-gray-300 rounded-full animate-spin size-12 dark:border-gray-600 border-t-orange-500 dark:border-t-indigo-500"></div>
						<span class="block mt-4 text-sm font-semibold text-gray-900 dark:text-white">Forbereder deling...</span>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" class="mx-auto text-gray-600 size-12 dark:text-gray-400">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
						</svg>
						<span class="block mt-2 text-sm font-semibold text-gray-900 dark:text-white">Smid din fil her</span>
						<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">eller klik for at vælge filer</p>
					{/if}
				</label>
			</div>

			<!-- <svg viewBox="0 0 1024 1024" aria-hidden="true" class="absolute top-1/2 left-1/2 -z-10 size-256 -translate-x-1/2 mask-[radial-gradient(closest-side,white,transparent)]">
				<circle r="512" cx="512" cy="512" fill="url(#827591b1-ce8c-4110-b064-7cb85a0b1217)" fill-opacity="0.7" />
				<defs>
					<radialGradient id="827591b1-ce8c-4110-b064-7cb85a0b1217">
						<stop stop-color="#7775D6" />
						<stop offset="1" stop-color="#E935C1" />
					</radialGradient>
				</defs>
			</svg> -->
		</div>
	</div>
</div>

<!-- Footer -->
<footer class="bg-white dark:bg-gray-900">
	<div class="px-6 py-12 mx-auto max-w-7xl md:flex md:items-center md:justify-between lg:px-8">
		<div class="flex justify-center gap-x-6 md:order-2">
			<a href="#" class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white">
				<span class="sr-only">GitHub</span>
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="size-6">
					<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
				</svg>
			</a>
		</div>
		<div class="mt-8 md:order-1 md:mt-0">
			<p class="text-sm text-center text-gray-600 dark:text-gray-400">
				&copy; 2025 QuickFS. Open source og privatlivs-fokuseret.
			</p>
		</div>
	</div>
</footer>
