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
		"width: 100%; height: 100%; background: #030406; color: #ffffff; display: flex; align-items: center; justify-content: center; font-family: PP Neue Montreal, Arial, sans-serif; letter-spacing: 0;";
	const frame_style =
		"width: 1080px; height: 500px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-sizing: border-box; display: flex;";
	const card_style =
		"width: 100%; height: 100%; padding: 56px 60px; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 28px; background: linear-gradient(180deg, #18191d 0%, #101114 100%); box-sizing: border-box; display: flex; flex-direction: column;";
	const brand_style = "display: flex; align-items: center;";
	const logo_style = "width: 42px; height: 42px; object-fit: contain;";
	const brand_name_style = "margin-left: 16px; font-size: 36px; font-weight: 800; line-height: 1;";
	const copy_style = "margin-top: 92px; display: flex; flex-direction: column;";
	const title_style =
		"max-width: 900px; font-size: 58px; font-weight: 800; line-height: 1.08; color: #ffffff;";
	const description_style =
		"max-width: 900px; margin-top: 26px; font-size: 30px; font-weight: 400; line-height: 1.25; color: #a7adba;";
</script>

<div data-kind={kind} style={root_style}>
	<div style={frame_style}>
		<div style={card_style}>
			<div style={brand_style}>
				<img src={logo_src} alt="" style={logo_style} />
				<div style={brand_name_style}>{brand}</div>
			</div>

			<div style={copy_style}>
				<div style={title_style}>{title}</div>
				<div style={description_style}>{description}</div>
			</div>
		</div>
	</div>
</div>
