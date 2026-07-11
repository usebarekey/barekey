import { createContext } from "svelte";

export type CommandPickerOption = {
	command: string;
	icon?: string;
	label: string;
	value: string;
};

export type CommandPickerContext = {
	get_selected_value: () => string;
};

export const [get_command_picker_context, set_command_picker_context] =
	createContext<CommandPickerContext>();
