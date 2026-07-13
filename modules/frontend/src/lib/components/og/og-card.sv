<script lang="ts">
	type Props = {
		brand?: string;
		description: string;
		kind?: "docs";
		logo_src: string;
		title: string;
	};

	let { brand = "Barekey", description, kind = "docs", logo_src, title }: Props = $props();
</script>

<div
	class="docs-responsive-surfaces flex h-[630px] w-[1200px] flex-col bg-linear-to-b from-[#18191d] to-[#101114] px-[60px] py-14 text-white"
	data-kind={kind}
	data-og-card
>
	<div class="flex items-center">
		<img class="size-[42px] object-contain" src={logo_src} alt="" />
		<div
			class="ml-4 font-[var(--font-logo)] text-[calc(42px*var(--docs-dev-logo-size,24)/24)] leading-[42px] font-[var(--docs-dev-logo-weight,700)] tracking-[var(--docs-dev-logo-tracking,-0.05em)]"
		>
			{brand}
		</div>
	</div>

	<div class="mt-[92px] flex flex-col">
		<div
			class="font-heading max-w-[900px] text-[calc(58px*var(--docs-dev-heading-scale,1))] leading-[1.08] font-[var(--docs-dev-heading-weight,630)] tracking-[var(--docs-dev-heading-tracking,-0.045em)]"
		>
			{title}
		</div>
		<div
			class="mt-[26px] max-w-[900px] text-[calc(30px*var(--docs-dev-prose-scale,1))] leading-[1.25] font-[var(--docs-dev-prose-weight,410)] tracking-[var(--docs-dev-prose-tracking,-0.04em)] text-[#a7adba]"
		>
			{description}
		</div>
	</div>
</div>
