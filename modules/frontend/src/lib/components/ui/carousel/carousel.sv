<script lang="ts">
	import {
		type CarouselAPI,
		type CarouselProps,
		type EmblaContext,
		set_embla_context,
	} from "$lib/components/ui/carousel/context.js";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		opts = {},
		plugins = [],
		setApi: set_api = () => {},
		orientation = "horizontal",
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<CarouselProps> = $props();

	function scroll_prev() {
		carousel_state.api?.scrollPrev();
	}

	function scroll_next() {
		carousel_state.api?.scrollNext();
	}

	function scroll_to(index: number, jump?: boolean) {
		carousel_state.api?.scrollTo(index, jump);
	}

	function on_select() {
		if (!carousel_state.api) return;
		carousel_state.selected_index = carousel_state.api.selectedScrollSnap();
		carousel_state.can_scroll_next = carousel_state.api.canScrollNext();
		carousel_state.can_scroll_prev = carousel_state.api.canScrollPrev();
	}

	function handle_key_down(event: KeyboardEvent) {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			scroll_prev();
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			scroll_next();
		}
	}

	function on_init(event: CustomEvent<CarouselAPI>) {
		carousel_state.api = event.detail;
		set_api(carousel_state.api);

		carousel_state.scroll_snaps = carousel_state.api.scrollSnapList();
		carousel_state.api.on("select", on_select);
		on_select();
	}

	let carousel_state = $state<EmblaContext>({
		api: undefined,
		scroll_prev,
		scroll_next,
		can_scroll_next: false,
		can_scroll_prev: false,
		handle_key_down,
		on_init,
		scroll_snaps: [],
		selected_index: 0,
		scroll_to,
		get orientation() {
			return orientation;
		},
		get options() {
			return opts;
		},
		get plugins() {
			return plugins;
		},
	});

	set_embla_context(carousel_state);

	$effect(() => {
		return () => {
			carousel_state.api?.off("select", on_select);
		};
	});
</script>

<div
	bind:this={ref}
	data-slot="carousel"
	class={cn("relative", class_name)}
	role="region"
	aria-roledescription="carousel"
	{...rest_props}
>
	{@render children?.()}
</div>
