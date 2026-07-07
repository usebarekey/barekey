import Description from "./form-description.svelte";
import Label from "./form-label.svelte";
import FieldErrors from "./form-field-errors.svelte";
import Field from "./form-field.svelte";
import Fieldset from "./form-fieldset.svelte";
import Legend from "./form-legend.svelte";
import ElementField from "./form-element-field.svelte";
import Button from "./form-button.svelte";

export {
	Button,
	Button as FormButton,
	Description,
	Description as FormDescription,
	ElementField,
	ElementField as FormElementField,
	Field,
	Field as FormField,
	FieldErrors,
	FieldErrors as FormFieldErrors,
	Fieldset,
	Fieldset as FormFieldset,
	Label,
	Label as FormLabel,
	Legend,
	Legend as FormLegend,
};

export { Control, Control as FormControl } from "formsnap";
