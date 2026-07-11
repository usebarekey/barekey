import Description from "$lib/components/ui/form/form-description.sv";
import Label from "$lib/components/ui/form/form-label.sv";
import FieldErrors from "$lib/components/ui/form/form-field-errors.sv";
import Field from "$lib/components/ui/form/form-field.sv";
import Fieldset from "$lib/components/ui/form/form-fieldset.sv";
import Legend from "$lib/components/ui/form/form-legend.sv";
import ElementField from "$lib/components/ui/form/form-element-field.sv";
import Button from "$lib/components/ui/form/form-button.sv";

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
