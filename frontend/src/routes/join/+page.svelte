<script>
	import { onMount } from 'svelte';
	import { wsService } from '$lib/websocket.js';
	import { goto } from '$app/navigation';

	let uploadId = $state('');
	let userName = $state('');
	let isConnecting = $state(false);
	let isConnected = $state(false);
	let fileMetadata = $state(null);
	let showNameInput = $state(true);

	onMount(() => {
		// Get uploadid from query parameters
		const urlParams = new URLSearchParams(window.location.search);
		uploadId = urlParams.get('uploadid') || '';
		if (!uploadId) {
			goto('/');
			return;
		}
	});

	async function joinUpload() {
		if (!userName.trim()) return;

		isConnecting = true;
		showNameInput = false;

		try {
			// Generate a simple public key (in real app, use proper crypto)
			const publicKey = 'demo-public-key-' + Math.random().toString(36).substr(2, 9);

			// Connect to WebSocket
			await wsService.connect(`/api/join/${uploadId}`);

			// Set up message handlers
			wsService.onMessage('file_metadata', (metadata) => {
				fileMetadata = metadata;
				isConnected = true;
				isConnecting = false;
			});

			wsService.onMessage('file_data', (data) => {
				console.log('Received file data:', data);
				// File download will be handled by the WebSocket service
			});

			// Send join request
			wsService.joinUpload(userName, publicKey);

		} catch (error) {
			console.error('Failed to join upload:', error);
			isConnecting = false;
			showNameInput = true;
		}
	}

	function requestFile() {
		wsService.requestFile();
	}

	function goBack() {
		goto('/');
	}

	import { icons, iconsPath } from '$lib/icons.js';
</script>

<svelte:head>
	<title>Modtag Fil - QuickFS</title>
</svelte:head>

<div class="min-h-screen py-8 sm:py-12">
	<div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
		<div class="relative px-6 py-12 overflow-hidden shadow-2xl isolate card sm:rounded-3xl sm:px-16 xl:py-16">

			<!-- Back Button -->
			<button
				onclick={goBack}
				class="absolute p-2 text-gray-600 transition-colors top-4 left-4 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
				aria-label="Go back"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
				</svg>
			</button>

			<div class="mb-8 text-center">
				<div class="flex items-center justify-center mx-auto mb-3 bg-gray-100 size-12 rounded-xl dark:bg-white/10 backdrop-blur">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" class="text-gray-700 size-6 dark:text-white">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
					</svg>
				</div>
				<h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
					Modtag Fil
				</h1>
				<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
					Del-kode: <span class="font-mono text-orange-600 dark:text-indigo-300">{uploadId}</span>
				</p>
			</div>

			<div class="max-w-md mx-auto">
				{#if showNameInput}
					<!-- Name Input -->
					<div class="p-6 border border-gray-300 bg-white/20 dark:bg-white/5 backdrop-blur dark:border-white/10 rounded-xl">
						<h3 class="mb-4 text-lg font-semibold text-center text-gray-900 dark:text-white">Hvad er dit navn?</h3>
						<div class="space-y-4">
							<input
								bind:value={userName}
								type="text"
								placeholder="Indtast dit navn..."
								class="w-full px-4 py-3 text-gray-900 placeholder-gray-600 border border-gray-300 rounded-lg bg-white/50 dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-indigo-500"
								onkeydown={(e) => e.key === 'Enter' && joinUpload()}
							>
							<button
								onclick={joinUpload}
								disabled={!userName.trim() || isConnecting}
								class="w-full px-4 py-3 font-medium text-white transition-colors bg-orange-600 rounded-lg dark:bg-indigo-600 hover:bg-orange-700 dark:hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:opacity-50"
							>
								{isConnecting ? 'Forbinder...' : 'Tilslut'}
							</button>
						</div>
					</div>
				{:else if isConnecting}
					<!-- Connecting State -->
					<div class="p-6 text-center border border-gray-300 bg-white/20 dark:bg-white/5 backdrop-blur dark:border-white/10 rounded-xl">
						<div class="w-8 h-8 mx-auto mb-4 border-b-2 border-orange-500 rounded-full animate-spin dark:border-indigo-400"></div>
						<h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Forbinder til host...</h3>
						<p class="text-xs text-gray-600 dark:text-gray-400">
							Vent venligst mens vi etablerer forbindelse
						</p>
					</div>
				{:else if isConnected && fileMetadata}
					<!-- File Available State -->
					<div class="p-6 border border-gray-300 bg-white/20 dark:bg-white/5 backdrop-blur dark:border-white/10 rounded-xl">
						<div class="mb-6 text-center">
							<div class="flex items-center justify-center mx-auto mb-3 bg-gray-100 size-16 rounded-xl dark:bg-white/10 backdrop-blur">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" class="text-gray-700 size-6 dark:text-white">
									{#if iconsPath[fileMetadata.type]}
										{@html icons[iconsPath[fileMetadata.type]]}
									{:else}
										{@html icons['unknown']}
									{/if}
								</svg>
							</div>
							<h3 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{fileMetadata.filename}</h3>
							<p class="text-sm text-gray-700 dark:text-gray-300">
								{(fileMetadata.filesize / 1024 / 1024).toFixed(2)} MB
							</p>
							<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
								Klar til download
							</p>
						</div>
					</div>
				{:else}
					<!-- Error State -->
					<div class="p-6 text-center border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl">
						<h3 class="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">Forbindelse fejlede</h3>
						<p class="mb-4 text-sm text-gray-700 dark:text-gray-300">
							Kunne ikke forbinde til fil-sessionen
						</p>
						<button
							onclick={goBack}
							class="px-4 py-2 text-white transition-colors bg-gray-500 rounded-lg dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-700"
						>
							Tilbage til start
						</button>
					</div>
				{/if}
			</div>

			<!-- Enhanced Background -->
			<!-- Main gradient circle -->
			<svg viewBox="0 0 1024 1024" aria-hidden="true" class="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 -z-10 size-128 opacity-40">
				<circle r="512" cx="512" cy="512" fill="url(#download-gradient-main)" />
				<defs>
					<radialGradient id="download-gradient-main" cx="0.3" cy="0.3">
						<stop offset="0%" stop-color="#7775D6" stop-opacity="0.8" />
						<stop offset="50%" stop-color="#E935C1" stop-opacity="0.6" />
						<stop offset="100%" stop-color="#1F2937" stop-opacity="0.2" />
					</radialGradient>
				</defs>
			</svg>

			<!-- Secondary accent circles -->
			<svg viewBox="0 0 400 400" aria-hidden="true" class="absolute top-10 right-10 -z-10 size-32 opacity-20">
				<circle r="200" cx="200" cy="200" fill="url(#download-accent-1)" />
				<defs>
					<radialGradient id="download-accent-1">
						<stop offset="0%" stop-color="#60A5FA" />
						<stop offset="100%" stop-color="#3B82F6" stop-opacity="0" />
					</radialGradient>
				</defs>
			</svg>

			<svg viewBox="0 0 300 300" aria-hidden="true" class="absolute opacity-25 bottom-16 left-16 -z-10 size-24">
				<circle r="150" cx="150" cy="150" fill="url(#download-accent-2)" />
				<defs>
					<radialGradient id="download-accent-2">
						<stop offset="0%" stop-color="#F59E0B" />
						<stop offset="100%" stop-color="#D97706" stop-opacity="0" />
					</radialGradient>
				</defs>
			</svg>

			<!-- Subtle pattern overlay -->
			<div class="absolute inset-0 -z-10 bg-gradient-to-br from-gray-900/50 via-transparent to-gray-900/30"></div>
			<div class="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]"></div>
		</div>
	</div>
</div>
