import {
  createTable,
  type RowData,
  type TableOptions,
  type TableOptionsResolved,
  type TableState,
  type Updater,
} from "@tanstack/table-core";

/**
 * Creates a reactive TanStack table object for Svelte.
 * @param options Table options to create the table with.
 * @returns A reactive table object.
 * @since 0.0.1
 */
export function create_svelte_table<TData extends RowData>(
  options: TableOptions<TData>,
) {
  const resolved_options: TableOptionsResolved<TData> = merge_objects(
    {
      state: {},
      "onStateChange"() {},
      "renderFallbackValue": null,
      "mergeOptions": (
        default_options: TableOptions<TData>,
        options: Partial<TableOptions<TData>>,
      ) => {
        return merge_objects(default_options, options);
      },
    },
    options,
  );

  const table = createTable(resolved_options);
  let state = $state<TableState>(table.initialState);

  function update_options() {
    table.setOptions(() => {
      return merge_objects(resolved_options, options, {
        state: merge_objects(state, options.state || {}),

        "onStateChange": (updater: Updater<TableState>) => {
          if (updater instanceof Function) state = updater(state);
          else state = merge_objects(state, updater);

          options.onStateChange?.(updater);
        },
      });
    });
  }

  update_options();

  $effect.pre(() => {
    update_options();
  });

  return table;
}

type MaybeThunk<T extends object> = T | (() => T | null | undefined);
type ResolvedThunk<T> = T extends MaybeThunk<infer Value> ? Value : never;
type Intersection<T extends readonly unknown[]> =
  T extends [infer H, ...infer R] ? H & Intersection<R>
    : unknown;

/**
 * Lazily merges several objects (or thunks) while preserving
 * getter semantics from every source.
 *
 * Proxy-based to avoid known WebKit recursion issue.
 *
 * @param sources Objects or thunks to merge from left to right.
 * @returns A proxy that reads values from the last source containing each key.
 * @since 0.0.1
 */
export function merge_objects<Sources extends readonly MaybeThunk<object>[]>(
  ...sources: Sources
): Intersection<{ [K in keyof Sources]: ResolvedThunk<Sources[K]> }> {
  const resolve = <T extends object>(src: MaybeThunk<T>): T | undefined =>
    typeof src === "function" ? (src() ?? undefined) : src;

  const find_source_with_key = (key: PropertyKey) => {
    for (let i = sources.length - 1; i >= 0; i--) {
      const obj = resolve(sources[i]);
      if (obj && key in obj) return obj;
    }
    return undefined;
  };

  return new Proxy(Object.create(null), {
    get(_, key) {
      const src = find_source_with_key(key);

      return src?.[key as never];
    },

    has(_, key) {
      return !!find_source_with_key(key);
    },

    "ownKeys"(): (string | symbol)[] {
      const all = new Set<string | symbol>();
      for (const s of sources) {
        const obj = resolve(s);
        if (obj) {
          for (const k of Reflect.ownKeys(obj) as (string | symbol)[]) {
            all.add(k);
          }
        }
      }
      return [...all];
    },

    "getOwnPropertyDescriptor"(_, key) {
      const src = find_source_with_key(key);
      if (!src) return undefined;
      return {
        configurable: true,
        enumerable: true,
        value: Reflect.get(src, key) as unknown,
        writable: true,
      };
    },
  }) as Intersection<{ [K in keyof Sources]: ResolvedThunk<Sources[K]> }>;
}
