<script>
	import { onMount, onDestroy } from 'svelte';
	import { selectedFile, uploadSession, connectedReceivers, resetToUpload } from '$lib/stores.js';
	import { wsService } from '$lib/websocket.js';
	import { goto } from '$app/navigation';

	let shareUrl = $state('');
	let qrCodeElement;

	$effect(() => {
		if ($uploadSession?.id) {
			shareUrl = `${window.location.origin}/join?uploadid=${$uploadSession.id}`;
			generateQRCode();
		}
	});

	onMount(() => {
		// If no upload session, redirect to home
		if (!$uploadSession) {
			goto('/');
		}
	});

	onDestroy(() => {
		// Clean up WebSocket when leaving
		wsService.close();
	});

	function generateQRCode() {
		if (typeof window !== 'undefined' && window.QRCode && qrCodeElement) {
			qrCodeElement.innerHTML = '';
			new QRCode(qrCodeElement, {
				text: shareUrl,
				width: 120,
				height: 120,
				colorDark: '#000000',
				colorLight: '#ffffff',
			});
		} else {
			// Fallback: simple QR code placeholder
			if (qrCodeElement) {
				qrCodeElement.innerHTML = `
					<div class="flex items-center justify-center bg-gray-200 rounded-lg w-30 h-30">
						<span class="text-xs text-gray-600">QR Code</span>
					</div>
				`;
			}
		}
	}

	function copyShareLink() {
		navigator.clipboard.writeText(shareUrl).then(() => {
			console.log('Share link copied!');
			// You could add a toast notification here
		});
	}

	function sendFileToReceiver(receiver) {
		if (!$selectedFile) return;

		// For demo, we'll send the file as text
		// In a real app, you'd read the file as binary and send chunks
		const reader = new FileReader();
		reader.onload = (e) => {
			const fileData = e.target.result;
			wsService.sendFileToReceiver(receiver.id, fileData);
		};

		if ($selectedFile.type.startsWith('text/')) {
			reader.readAsText($selectedFile);
		} else {
			// For binary files, convert to base64
			reader.readAsDataURL($selectedFile);
		}
	}

	function goBack() {
		resetToUpload();
		goto('/');
	}

   // Create a QR Code instance with enhanced styling
   onMount(() => {
     var qrcode = new QRCode(document.getElementById("qrcode"), {
       text: "https://example.com/download/billede.png",
       width: 140,
       height: 140,
       colorDark: "#1f2937", // Dark gray for better contrast
       colorLight: "transparent", // Transparent background to blend with backdrop
       correctLevel: QRCode.CorrectLevel.H // High error correction
     });

     // Add styling to the generated QR code
     setTimeout(() => {
       const qrImg = document.querySelector('#qrcode img');
       if (qrImg) {
         qrImg.style.borderRadius = '12px';
         qrImg.style.backgroundColor = '#ffffff';
         qrImg.style.padding = '12px';
         qrImg.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.1)';
       }
     }, 100);
   });



	import { icons, iconsPath } from '$lib/icons.js';
</script>

<svelte:head>
	<title>Host File - QuickFS</title>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
</svelte:head>

<!-- Hero Section -->
<div class="min-h-screen py-8 sm:py-12">
	<div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
		<div class="relative px-6 py-12 overflow-hidden shadow-2xl isolate card sm:rounded-3xl sm:px-16 xl:py-16">

			<!-- Back Button -->
			<button
				onclick={goBack}
				class="absolute p-2 text-gray-600 transition-colors top-4 left-4 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
				</svg>
			</button>

			<!-- File Info Header -->
			<div class="mb-8 text-center">
				<div class="flex items-center justify-center mx-auto mb-3 bg-gray-100 size-12 rounded-xl dark:bg-white/10 backdrop-blur">
					{#if $selectedFile && iconsPath[$selectedFile.type]}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" class="text-gray-700 size-6 dark:text-white">
							{@html icons[iconsPath[$selectedFile.type]]}
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" class="text-gray-700 size-6 dark:text-white">
							{@html icons['unknown']}
						</svg>
					{/if}
				</div>
				<h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
					{$selectedFile?.name || 'Fil'}
				</h1>
				<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
					{#if $selectedFile}
						{@const size = $selectedFile.size}
						{@const kb = size / 1024}
						{@const mb = kb / 1024}
						{@const gb = mb / 1024}
						Klar til afsendelse • {
							size < 1024 ? `${size} B` :
							kb < 1024 ? `${kb.toFixed(1)} KB` :
							mb < 1024 ? `${mb.toFixed(2)} MB` :
							`${gb.toFixed(2)} GB`
						}
					{:else}
						Klar til afsendelse • ? B
					{/if}
				</p>
				{#if $uploadSession?.id}
					<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
						Del-kode: <span class="font-mono text-orange-600 dark:text-indigo-300">{$uploadSession.id}</span>
					</p>
				{/if}
			</div>

			<!-- QR Code Section -->
			<div class="flex justify-center mb-8">
				<div class="relative p-4 border border-gray-300 shadow-xl bg-white/20 dark:bg-white/10 backdrop-blur dark:border-white/20 rounded-2xl">
					<div bind:this={qrCodeElement} class="flex items-center justify-center mb-3 w-30 h-30"></div>
					<div class="text-center">
						<p class="mb-1 text-xs text-gray-700 dark:text-gray-300">Scan med din telefon</p>
						<p class="text-xs text-gray-600 dark:text-gray-400">eller del linket</p>
					</div>
				</div>
			</div>

			<!-- Share Link -->
			{#if shareUrl}
				<div class="flex justify-center mb-8">
					<div class="w-full max-w-md p-4 border border-gray-300 rounded-lg bg-white/20 dark:bg-white/5 backdrop-blur dark:border-white/10">
						<div class="flex items-center space-x-3">
							<div class="flex-1 min-w-0">
								<p class="mb-1 text-xs text-gray-600 dark:text-gray-400">Del dette link:</p>
								<p class="font-mono text-sm text-gray-900 truncate dark:text-white">{shareUrl}</p>
							</div>
							<button
								onclick={copyShareLink}
								class="px-3 py-1 text-xs font-medium text-gray-700 transition-colors bg-gray-200 rounded-md dark:text-gray-300 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Connected Devices Section -->
			<div class="max-w-2xl mx-auto">
				<div class="p-4 border border-gray-300 bg-white/20 dark:bg-white/5 backdrop-blur dark:border-white/10 rounded-xl">
					<h3 class="mb-4 text-sm font-semibold text-center text-gray-900 dark:text-white">
						Tilsluttede enheder
						<span class="font-medium text-gray-700 dark:text-gray-300">({$connectedReceivers.length}/5)</span>
					</h3>

					{#if $connectedReceivers.length > 0}
						<div class="space-y-3">
							{#each $connectedReceivers as receiver}
								<div class="p-3 border border-gray-300 rounded-lg bg-white/20 dark:bg-white/5 dark:border-white/10">
									<div class="flex items-center justify-between mb-3">
										<div class="flex items-center space-x-3">
											<div class="relative flex items-center justify-center bg-gray-200 border border-gray-300 rounded-lg size-8 dark:bg-white/10 backdrop-blur dark:border-white/20">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-700 dark:text-gray-300">
													<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
													<path d="M12 18h.01"/>
												</svg>
											</div>
											<div>
												<p class="text-xs font-medium text-gray-900 dark:text-white">{receiver.name}</p>
												<p class="text-xs text-gray-600 dark:text-gray-400">
													Forbundet: {new Date(receiver.connected_at).toLocaleTimeString()}
												</p>
											</div>
										</div>
										<button
											onclick={() => sendFileToReceiver(receiver)}
											class="px-3 py-1 text-xs font-medium text-orange-700 transition-colors bg-orange-100 rounded-md dark:text-indigo-300 dark:bg-indigo-500/20 hover:bg-orange-200 dark:hover:bg-indigo-500/30"
										>
											<svg class="inline mr-1 size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
											</svg>
											Send
										</button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="py-8 text-center">
							<svg class="w-12 h-12 mx-auto mb-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21l4-4 4 4M8 3l4 4 4-4m-4 14V7"/>
							</svg>
							<p class="mb-1 text-sm text-gray-700 dark:text-gray-300">Venter på forbindelser...</p>
							<p class="text-xs text-gray-600 dark:text-gray-400">Andre enheder vil vises her når de scanner QR-koden</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Enhanced Background -->
			<!-- Main gradient circle -->
			<svg viewBox="0 0 1024 1024" aria-hidden="true" class="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 -z-10 size-128 opacity-30">
				<circle r="512" cx="512" cy="512" fill="url(#host-gradient-main)" />
				<defs>
					<radialGradient id="host-gradient-main" cx="0.4" cy="0.2">
						<stop offset="0%" stop-color="#7775D6" stop-opacity="0.9" />
						<stop offset="60%" stop-color="#E935C1" stop-opacity="0.5" />
						<stop offset="100%" stop-color="#065F46" stop-opacity="0.3" />
					</radialGradient>
				</defs>
			</svg>

			<!-- QR Code accent -->
			<svg viewBox="0 0 600 600" aria-hidden="true" class="absolute -translate-x-1/2 top-20 left-1/2 -z-10 size-40 opacity-15">
				<circle r="300" cx="300" cy="300" fill="url(#host-qr-accent)" />
				<defs>
					<radialGradient id="host-qr-accent">
						<stop offset="0%" stop-color="#10B981" />
						<stop offset="100%" stop-color="#059669" stop-opacity="0" />
					</radialGradient>
				</defs>
			</svg>

			<!-- Connection indicators -->
			<svg viewBox="0 0 200 200" aria-hidden="true" class="absolute top-32 right-8 -z-10 size-16 opacity-20">
				<circle r="100" cx="100" cy="100" fill="url(#host-connect-1)" />
				<defs>
					<radialGradient id="host-connect-1">
						<stop offset="0%" stop-color="#8B5CF6" />
						<stop offset="100%" stop-color="#7C3AED" stop-opacity="0" />
					</radialGradient>
				</defs>
			</svg>

			<svg viewBox="0 0 250 250" aria-hidden="true" class="absolute opacity-25 bottom-20 right-20 -z-10 size-20">
				<circle r="125" cx="125" cy="125" fill="url(#host-connect-2)" />
				<defs>
					<radialGradient id="host-connect-2">
						<stop offset="0%" stop-color="#EC4899" />
						<stop offset="100%" stop-color="#DB2777" stop-opacity="0" />
					</radialGradient>
				</defs>
			</svg>

			<!-- Ambient background layers -->
			<div class="absolute inset-0 -z-10 bg-gradient-to-tr from-gray-900/40 via-transparent to-orange-900/20 dark:to-indigo-900/20"></div>
			<div class="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_60%_30%,rgba(139,92,246,0.08),transparent_70%)]"></div>
			<div class="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.06),transparent_60%)]"></div>
		</div>
	</div>
</div>
