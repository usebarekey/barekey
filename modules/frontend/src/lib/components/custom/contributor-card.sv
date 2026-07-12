<script lang="ts">
	import { capture_event } from "$lib/client/analytics";
	import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
	import type { Contributor } from "$lib/data/github-contributors";

	import barekey_logo from "$lib/assets/barekey/logo-40.png";

	let { contributor }: { contributor: Contributor } = $props();

	const get_avatar_url = (avatar: string) => {
		const url = new URL(avatar);

		if (url.hostname === "avatars.githubusercontent.com") {
			url.searchParams.set("s", "64");
		}

		if (url.hostname === "github.com" && url.pathname.endsWith(".png")) {
			url.searchParams.set("size", "64");
		}

		return url.href;
	};
</script>

<li class="flex items-center gap-2">
	<Avatar size="sm">
		{#if contributor.avatar}
			<AvatarImage
				src={get_avatar_url(contributor.avatar)}
				alt={contributor.name + "'s avatar"}
			/>
		{/if}
		<AvatarFallback>{contributor.name.slice(0, 1).toUpperCase()}</AvatarFallback>
	</Avatar>
	<p class="text-sm text-muted-foreground">
		<span class="inline-flex items-baseline gap-[1ch]">
			{#if contributor.profile_url}
				<a
					href={contributor.profile_url}
					target="_blank"
					rel="noreferrer"
					class="font-heading font-semibold text-foreground underline-offset-4 hover:underline"
					onclick={() =>
						capture_event("contributor_clicked", { contributor: contributor.name })}
					>{contributor.name}</a
				>
			{:else}
				<span class="font-heading font-semibold text-foreground">{contributor.name}</span>
			{/if}
			{#if contributor.is_barekey_member}
				<img
					src={barekey_logo}
					alt="Barekey organization member"
					title="Barekey organization member"
					class="inline size-3 self-center"
				/>
			{/if}
		</span>{" "}with
		{#if contributor.commits}
			<span class="text-foreground">{contributor.commits.toLocaleString("en-US")}</span>
			{contributor.commits === 1 ? "commit" : "commits"}
		{/if}
		{#if contributor.diff}
			and
			<span class="text-green-400">
				{contributor.diff.plus.toLocaleString("en-US")}
				{contributor.diff.plus === 1 ? "line" : "lines"} added</span
			>
			and
			<span class="text-red-400">
				{contributor.diff.minus.toLocaleString("en-US")}
				{contributor.diff.minus === 1 ? "line" : "lines"} deleted</span
			>
		{/if}.
	</p>
</li>
