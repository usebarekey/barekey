declare global {
	var __barekey_heading_links: boolean | undefined;
}

const heading_link_selector = ".docs-heading-self-link";

const prefers_reduced_motion = () =>
	globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

const get_hash_target = (link: HTMLAnchorElement) => {
	const url = new URL(link.href);

	if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) {
		return undefined;
	}

	return document.getElementById(decodeURIComponent(url.hash.slice(1)));
};

const handle_heading_link_click = (event: MouseEvent) => {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
		return;
	}

	const target = event.target;

	if (!(target instanceof Element)) {
		return;
	}

	const link = target.closest<HTMLAnchorElement>(heading_link_selector);

	if (!link) {
		return;
	}

	const heading = get_hash_target(link);

	if (!heading) {
		return;
	}

	event.preventDefault();

	if (location.hash !== link.hash) {
		history.pushState(null, "", link.hash);
	}

	heading.scrollIntoView({
		block: "start",
		behavior: prefers_reduced_motion() ? "auto" : "smooth",
	});
};

if (typeof document !== "undefined" && !globalThis.__barekey_heading_links) {
	globalThis.__barekey_heading_links = true;
	document.addEventListener("click", handle_heading_link_click);
}
