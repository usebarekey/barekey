import { Effect } from "effect";

type QueryCursor = {
  withIndex(name: string, builder: (query: any) => any): any;
  collect(): Promise<unknown>;
  unique(): Promise<unknown>;
};

/**
 * Loads a row by id through Convex DB with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `db.get` function.
 * @param id The row id to load.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that yields the row or `null`.
 * @remarks This is a small shared bridge to keep repo modules from repeating `Effect.tryPromise({ try: () => convexCtx.db.get(...) })`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function dbGetEffect<Row, Error>(
  convexCtx: {
    db: {
      get(id: unknown): Promise<unknown>;
    };
  },
  id: unknown,
  onError: (error: unknown) => Error,
): Effect.Effect<Row | null, Error> {
  return Effect.tryPromise({
    try: () => convexCtx.db.get(id) as Promise<Row | null>,
    catch: onError,
  });
}

/**
 * Inserts a row through Convex DB with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `db.insert` function.
 * @param table The table name to insert into.
 * @param value The row payload to insert.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that yields the inserted row id.
 * @remarks This keeps insert-side repo helpers concise and consistent.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function dbInsertEffect<Id, Error>(
  convexCtx: {
    db: {
      insert(table: string, value: Record<string, unknown>): Promise<unknown>;
    };
  },
  table: string,
  value: Record<string, unknown>,
  onError: (error: unknown) => Error,
): Effect.Effect<Id, Error> {
  return Effect.tryPromise({
    try: () => convexCtx.db.insert(table, value) as Promise<Id>,
    catch: onError,
  });
}

/**
 * Patches a row through Convex DB with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `db.patch` function.
 * @param id The row id to patch.
 * @param value The patch payload.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that completes after the patch is persisted.
 * @remarks This is intentionally narrow and side-effect-focused for repo modules.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function dbPatchEffect<Error>(
  convexCtx: {
    db: {
      patch(id: unknown, value: Record<string, unknown>): Promise<unknown>;
    };
  },
  id: unknown,
  value: Record<string, unknown>,
  onError: (error: unknown) => Error,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () => convexCtx.db.patch(id, value),
    catch: onError,
  }).pipe(Effect.asVoid);
}

/**
 * Deletes a row through Convex DB with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `db.delete` function.
 * @param id The row id to delete.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that completes after the row is deleted.
 * @remarks This keeps delete-side repo helpers concise and consistent.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function dbDeleteEffect<Error>(
  convexCtx: {
    db: {
      delete(id: unknown): Promise<unknown>;
    };
  },
  id: unknown,
  onError: (error: unknown) => Error,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () => convexCtx.db.delete(id),
    catch: onError,
  }).pipe(Effect.asVoid);
}

/**
 * Collects rows from a Convex table query with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `db.query` function.
 * @param table The table name to query.
 * @param buildQuery A function that can refine the base query before collection.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that yields the collected rows.
 * @remarks This keeps `query(...).collect()` boilerplate out of repo modules.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function dbCollectEffect<Row, Error>(
  convexCtx: {
    db: {
      query(table: string): any;
    };
  },
  table: string,
  buildQuery: (query: QueryCursor) => any,
  onError: (error: unknown) => Error,
): Effect.Effect<Array<Row>, Error> {
  return Effect.tryPromise({
    try: () => buildQuery(convexCtx.db.query(table)).collect() as Promise<Array<Row>>,
    catch: onError,
  });
}

/**
 * Resolves a unique row from a Convex table query with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `db.query` function.
 * @param table The table name to query.
 * @param buildQuery A function that can refine the base query before uniqueness resolution.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that yields the unique row or `null`.
 * @remarks This keeps `query(...).unique()` boilerplate out of repo modules.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function dbUniqueEffect<Row, Error>(
  convexCtx: {
    db: {
      query(table: string): any;
    };
  },
  table: string,
  buildQuery: (query: QueryCursor) => any,
  onError: (error: unknown) => Error,
): Effect.Effect<Row | null, Error> {
  return Effect.tryPromise({
    try: () => buildQuery(convexCtx.db.query(table)).unique() as Promise<Row | null>,
    catch: onError,
  });
}
