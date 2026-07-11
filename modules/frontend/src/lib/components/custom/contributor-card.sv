<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";

	import barekey_logo from "$lib/assets/barekey/logo-40.png";

	type Contributor = {
		avatar: string;
		is_barekey_member: boolean;
		commits: number;
		diff: {
			minus: number;
			plus: number;
		};
		name: string;
	};

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
		<AvatarImage src={get_avatar_url(contributor.avatar)} alt={`${contributor.name}'s avatar`} />
		<AvatarFallback>{contributor.name.slice(0, 1).toUpperCase()}</AvatarFallback>
	</Avatar>
	<p class="text-sm text-muted-foreground">
		<a
			href={`https://github.com/${contributor.name}`}
			target="_blank"
			rel="noreferrer"
			class="font-heading font-semibold text-foreground underline-offset-4 hover:underline"
			>{contributor.name}</a
		>{#if contributor.is_barekey_member}<img
				src={barekey_logo}
				alt="Barekey organization member"
				title="Barekey organization member"
				class="ml-1 inline size-3 align-[-0.1em]"
			/>{/if}
		with <span class="text-foreground">{contributor.commits.toLocaleString("en-US")}</span>
		{contributor.commits === 1 ? "commit" : "commits"} and
		<span class="text-green-400">
			{contributor.diff.plus.toLocaleString("en-US")}
			{contributor.diff.plus === 1 ? "line" : "lines"} added</span
		>
		and
		<span class="text-red-400">
			{contributor.diff.minus.toLocaleString("en-US")}
			{contributor.diff.minus === 1 ? "line" : "lines"} deleted</span
		>.
	</p>
</li>
