<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>QuickFS - Quick File Share</title>
	<meta name="description" content="Share files quickly and securely using peer-to-peer connections" />
	<link rel="icon" href={favicon} />

	<!-- PWA tags that can be dynamically updated -->
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="mobile-web-app-capable" content="yes" />
</svelte:head>

{@render children?.()}
