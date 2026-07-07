import { MediaQuery } from "svelte/reactivity";

const default_mobile_breakpoint = 768;

/**
 * Reactive media query helper for mobile-width detection.
 *
 * @since 0.0.1
 */
export class IsMobile extends MediaQuery {
	constructor(breakpoint: number = default_mobile_breakpoint) {
		super(`max-width: ${breakpoint - 1}px`);
	}
}
