import { browser } from "$app/environment";
import { writable, type Readable, type Writable } from "svelte/store";

const storage_prefix = "docs-command-picker:";

const selection_stores = new Map<string, Writable<string | undefined>>();
let storage_listener_ready = false;

export type CommandPickerSelection = Readable<string | undefined> & {
	select: (value: string) => void;
};

const get_storage_key = (key: string) => `${storage_prefix}${key}`;

const read_stored_value = (key: string) => {
	if (!browser) {
		return;
	}

	try {
		return globalThis.localStorage.getItem(get_storage_key(key)) ?? undefined;
	} catch {
		return;
	}
};

const write_stored_value = (key: string, value: string) => {
	if (!browser) {
		return;
	}

	try {
		globalThis.localStorage.setItem(get_storage_key(key), value);
	} catch {
		return;
	}
};

const ensure_storage_listener = () => {
	if (!browser || storage_listener_ready) {
		return;
	}

	storage_listener_ready = true;
	globalThis.addEventListener("storage", (event) => {
		if (!event.key?.startsWith(storage_prefix)) {
			return;
		}

		const key = event.key.slice(storage_prefix.length);
		selection_stores.get(key)?.set(event.newValue ?? undefined);
	});
};

const get_selection_store = (key: string) => {
	let store = selection_stores.get(key);

	if (!store) {
		store = writable(read_stored_value(key));
		selection_stores.set(key, store);
	}

	return store;
};

export const get_command_picker_selection = (key: string): CommandPickerSelection => {
	ensure_storage_listener();

	const store = get_selection_store(key);

	return {
		select: (value: string) => {
			store.set(value);
			write_stored_value(key, value);
		},
		subscribe: store.subscribe,
	};
};
