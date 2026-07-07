<script lang="ts">
	import { cn } from "$lib/utils";
	import { IconLoader } from "@tabler/icons-svelte";
	import type { SVGAttributes } from "svelte/elements";

	let {
		class: class_name,
		role = "status",
		name,
		color,
		stroke,
		"aria-label": aria_label = "Loading",
		...rest_props
	}: SVGAttributes<SVGSVGElement> = $props();
</script>

<IconLoader {role} name={name === null ? undefined : name} color={color === null ? undefined : color} stroke={stroke === null ? undefined : stroke} aria-label={aria_label} class={cn("size-4 animate-spin", class_name)} {...rest_props} />
