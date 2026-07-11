import type { WithElementRef } from "$lib/utils.ts";
import type {
	default as emblaCarouselSvelte,
	EmblaCarouselSvelteType,
} from "embla-carousel-svelte";
import { getContext, hasContext, setContext } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

/**
 * Embla carousel instance API inferred from the Svelte action event.
 */
export type CarouselAPI =
	NonNullable<NonNullable<EmblaCarouselSvelteType["$$_attributes"]>["on:emblaInit"]> extends (
		evt: CustomEvent<infer CarouselAPI>,
	) => void
		? CarouselAPI
		: never;

type EmblaCarouselConfig = NonNullable<Parameters<typeof emblaCarouselSvelte>[1]>;

/**
 * Options accepted by the Embla carousel Svelte action.
 */
export type CarouselOptions = EmblaCarouselConfig["options"];

/**
 * Plugins accepted by the Embla carousel Svelte action.
 */
export type CarouselPlugins = EmblaCarouselConfig["plugins"];

/**
 * Props accepted by the carousel root component.
 */
export type CarouselProps = {
	opts?: CarouselOptions;
	plugins?: CarouselPlugins;
	setApi?: (api: CarouselAPI | undefined) => void;
	orientation?: "horizontal" | "vertical";
} & WithElementRef<HTMLAttributes<HTMLDivElement>>;

const embla_carousel_context = Symbol("embla-carousel-context");

class CarouselContextMissingError extends Error {
	constructor(name: string) {
		super(`${name} must be used within a <Carousel.Root> component`);
		this.name = "CarouselContextMissingError";
	}
}

/**
 * Shared carousel state stored in Svelte context.
 */
export type EmblaContext = {
	api: CarouselAPI | undefined;
	orientation: "horizontal" | "vertical";
	scroll_next: () => void;
	scroll_prev: () => void;
	can_scroll_next: boolean;
	can_scroll_prev: boolean;
	handle_key_down: (event: KeyboardEvent) => void;
	options: CarouselOptions;
	plugins: CarouselPlugins;
	on_init: (event: CustomEvent<CarouselAPI>) => void;
	scroll_to: (index: number, jump?: boolean) => void;
	scroll_snaps: number[];
	selected_index: number;
};

/**
 * Stores the Embla carousel state in Svelte context.
 */
export function set_embla_context(config: EmblaContext): EmblaContext {
	setContext(embla_carousel_context, config);
	return config;
}

/**
 * Reads the Embla carousel state from Svelte context.
 */
export function get_embla_context(name = "This component") {
	if (!hasContext(embla_carousel_context)) {
		throw new CarouselContextMissingError(name);
	}
	return getContext<ReturnType<typeof set_embla_context>>(embla_carousel_context);
}
