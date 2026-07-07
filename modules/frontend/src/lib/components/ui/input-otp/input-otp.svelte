<script lang="ts">
	import { PinInput as InputOTPPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		value = $bindable(""),
		...rest_props
	}: InputOTPPrimitive.RootProps = $props();
</script>

<InputOTPPrimitive.Root
	bind:ref
	bind:value
	data-slot="input-otp"
	spellcheck={false}
	class={cn(
		"cn-input-otp-input gap-2 flex items-center disabled:cursor-not-allowed has-disabled:opacity-50",
		class_name
	)}
	{...rest_props}
/>
