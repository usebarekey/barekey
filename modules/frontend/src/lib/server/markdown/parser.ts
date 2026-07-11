import { Data, Effect, Schema } from "effect";

/** Schema for supported docs frontmatter. */
export const FrontmatterSchema = Schema.Struct({
	title: Schema.String,
	description: Schema.String,
});

/** Parsed docs frontmatter. */
export type ParsedFrontmatter = Schema.Schema.Type<typeof FrontmatterSchema>;

/** Error raised when mdsvex metadata does not match the docs frontmatter schema. */
export class FrontmatterSchemaError extends Data.TaggedError("FrontmatterSchemaError")<{
	message: string;
}> {}

/** Validates mdsvex metadata against the docs frontmatter schema. */
export const DecodeFrontmatter = (metadata: unknown) =>
	Schema.decodeUnknownEffect(FrontmatterSchema, {
		onExcessProperty: "error",
	})(metadata).pipe(
		Effect.mapError(
			(error) =>
				new FrontmatterSchemaError({
					message: error.message,
				}),
		),
	);
