<script lang="ts">
	type Props = {
		brand?: string;
		description: string;
		kind?: "docs";
		logo_src: string;
		title: string;
	};

	let { brand = "Barekey", description, kind = "docs", logo_src, title }: Props = $props();

	const root_style =
		"width: 100%; height: 100%; padding: 56px 60px; background: linear-gradient(180deg, #18191d 0%, #101114 100%); color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; font-family: PP Neue Montreal, Arial, sans-serif; letter-spacing: 0;";
	const brand_style = "display: flex; align-items: center;";
	const logo_style = "width: 42px; height: 42px; object-fit: contain;";
	const brand_name_style =
		"margin-left: 16px; font-family: Cal Sans, sans-serif; font-size: 42px; font-weight: 700; line-height: 42px; letter-spacing: -0.05em; color: #ffffff;";
	const copy_style = "margin-top: 92px; display: flex; flex-direction: column;";
	const title_style =
		"max-width: 900px; font-family: Geist, sans-serif; font-size: 58px; font-weight: 600; line-height: 1.08; letter-spacing: -0.05em; color: #ffffff;";
	const description_style =
		"max-width: 900px; margin-top: 26px; font-size: 30px; font-weight: 400; line-height: 1.25; color: #a7adba;";
</script>

<div data-kind={kind} style={root_style}>
	<div style={brand_style}>
		<img src={logo_src} alt="" style={logo_style} />
		<div style={brand_name_style}>{brand}</div>
	</div>

	<div style={copy_style}>
		<div style={title_style}>{title}</div>
		<div style={description_style}>{description}</div>
	</div>
</div>
