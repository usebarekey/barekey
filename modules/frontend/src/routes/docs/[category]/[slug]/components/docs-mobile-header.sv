<script lang="ts">
	import barekey_logo from "$lib/assets/barekey/logo-40.png";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import LayoutSidebar from "@tabler/icons-svelte/icons/layout-sidebar";
</script>

<header
	class="sticky top-0 z-20 flex h-12 w-full shrink-0 items-center justify-between rounded-2xl border border-foreground/8 bg-background/72 px-2 pl-3 shadow-[0_8px_30px_-18px_oklch(from_var(--foreground)_l_c_h_/_45%)] backdrop-blur-xl xl:hidden"
>
	<a href="/" class="flex min-w-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
		<img src={barekey_logo} alt="" class="size-5 shrink-0 invert dark:invert-0" />
		<span class="truncate font-logo text-sm">Barekey</span>
	</a>

	<Sidebar.Trigger
		aria-label="Open documentation navigation"
		class="group/sidebar-toggle flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5 transition-transform duration-(--duration-quick) ease-(--ease-smooth-out) active:scale-[0.97] motion-reduce:transition-none"
	>
		<LayoutSidebar
			class="size-4 text-muted-foreground transition-colors duration-(--duration-fast) ease-in-out group-hover/sidebar-toggle:text-foreground motion-reduce:transition-none"
		/>
	</Sidebar.Trigger>
</header>
