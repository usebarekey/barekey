import { Effect } from "effect";

type ComponentPropValue = number | string | undefined;
type ComponentPropExpression = {
	expression: string;
};

export const component_prop_expression = (expression: string): ComponentPropExpression => ({
	expression,
});

const is_component_prop_expression = (
	value: ComponentPropValue | ComponentPropExpression,
): value is ComponentPropExpression => typeof value === "object" && value !== null;

const render_component_prop = ([name, value]: [
	string,
	ComponentPropValue | ComponentPropExpression,
]) => {
	if (value === undefined) {
		return "";
	}

	if (is_component_prop_expression(value)) {
		return ` ${name}={${value.expression}}`;
	}

	if (typeof value === "number") {
		return ` ${name}={${value}}`;
	}

	return ` ${name}={${JSON.stringify(value)}}`;
};

export const render_component_tag = (
	name: string,
	props: Record<string, ComponentPropValue | ComponentPropExpression>,
) => `<${name}${Object.entries(props).map(render_component_prop).join("")} />`;

export const RenderComponentTag = (
	name: string,
	props: Record<string, ComponentPropValue | ComponentPropExpression>,
) => Effect.sync(() => render_component_tag(name, props));
