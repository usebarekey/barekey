<script lang="ts">
	import barekey_logo from "$lib/assets/barekey/logo-40.png";
	import * as Sidebar from "$lib/components/ui/sidebar";
</script>

<header
	class="sticky top-0 z-20 order-first flex h-12 w-full shrink-0 items-center justify-between rounded-full border border-white/18 bg-linear-to-b from-white/18 to-white/8 px-2 pl-3 shadow-[inset_0_1px_0_oklch(1_0_0_/_16%),0_10px_30px_-18px_oklch(0_0_0_/_70%)] backdrop-blur-xl xl:hidden"
>
	<a href="/" class="flex min-w-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
		<img src={barekey_logo} alt="" class="size-5 shrink-0 invert dark:invert-0" />
		<span class="truncate font-logo text-sm">Barekey</span>
	</a>

	<Sidebar.Trigger
		aria-label="Open documentation navigation"
		variant="default"
		size="icon"
		class="rounded-full bg-linear-to-b from-foreground-extra/5 to-foreground-extra/10 text-foreground-extra card"
	/>
</header>
