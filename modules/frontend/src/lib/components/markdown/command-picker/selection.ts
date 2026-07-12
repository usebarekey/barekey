import { browser } from "$app/environment";
import { Effect, Layer } from "effect";
import { writable, type Readable, type Writable } from "svelte/store";

const storage_prefix = "docs-command-picker:";

const selection_stores = new Map<string, Writable<string | undefined>>();

export type CommandPickerSelection = Readable<string | undefined> & {
	select: (value: string) => void;
};

const get_storage_key = (key: string) => `${storage_prefix}${key}`;

const ReadStoredValue = (key: string) => {
	if (!browser) {
		return Effect.succeed(undefined);
	}

	return Effect.try(
		() => globalThis.localStorage.getItem(get_storage_key(key)) ?? undefined,
	).pipe(Effect.catch(() => Effect.succeed(undefined)));
};

const WriteStoredValue = (key: string, value: string) => {
	if (!browser) {
		return Effect.void;
	}

	return Effect.try(() => globalThis.localStorage.setItem(get_storage_key(key), value)).pipe(
		Effect.catch(() => Effect.void),
	);
};

const handle_storage = (event: StorageEvent) => {
	if (!event.key?.startsWith(storage_prefix)) {
		return;
	}

	const key = event.key.slice(storage_prefix.length);
	selection_stores.get(key)?.set(event.newValue ?? undefined);
};

/** Synchronizes command picker selections across tabs for the client runtime lifetime. */
export const CommandPickerSelectionLive = Layer.effectDiscard(
	Effect.acquireRelease(
		Effect.sync(() => globalThis.addEventListener("storage", handle_storage)),
		() => Effect.sync(() => globalThis.removeEventListener("storage", handle_storage)),
	),
);

const get_selection_store = (key: string) => {
	let store = selection_stores.get(key);

	if (!store) {
		store = writable(Effect.runSync(ReadStoredValue(key)));
		selection_stores.set(key, store);
	}

	return store;
};

export const get_command_picker_selection = (key: string): CommandPickerSelection => {
	const store = get_selection_store(key);

	return {
		select: (value: string) => {
			store.set(value);
			Effect.runSync(WriteStoredValue(key, value));
		},
		subscribe: store.subscribe,
	};
};
