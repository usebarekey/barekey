<script lang="ts">
	import { NavigationMenu as NavigationMenuPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: NavigationMenuPrimitive.IndicatorProps = $props();
</script>

<NavigationMenuPrimitive.Indicator
	bind:ref
	data-slot="navigation-menu-indicator"
	class={cn(
		"data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden",
		class_name
	)}
	{...rest_props}
>
	<div class="bg-border rounded-tl-sm shadow-md relative top-[60%] h-2 w-2 rotate-45"></div>
</NavigationMenuPrimitive.Indicator>
