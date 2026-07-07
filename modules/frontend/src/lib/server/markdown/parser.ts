import { Data, Effect, Schema } from "effect";
import type { Frontmatter } from "satteri";
import { parseDocument } from "yaml";
import type { YAMLError, YAMLWarning } from "yaml";

/**
 * Schema for supported docs frontmatter.
 * @since 0.0.1
 */
export const frontmatter_schema = Schema.Struct({
	title: Schema.String,
	description: Schema.String,
});

/**
 * Parsed docs frontmatter.
 * @since 0.0.1
 */
export type ParsedFrontmatter = Schema.Schema.Type<typeof frontmatter_schema>;

/**
 * Structured YAML parser issue with optional source location.
 * @since 0.0.1
 */
export type YamlIssue = {
	name: "YAMLParseError" | "YAMLWarning";
	code: string;
	message: string;
	line?: number;
	column?: number;
};

/**
 * Error raised when the parser adapter throws outside YAML validation.
 * @since 0.0.1
 */
export class InternalParserError extends Data.TaggedError("InternalParserError")<{
	message: string;
}> {}

/**
 * Error raised when YAML parsing reports errors or warnings.
 * @since 0.0.1
 */
export class FrontmatterParseError extends Data.TaggedError("FrontmatterParseError")<{
	issues: ReadonlyArray<YamlIssue>;
}> {}

/**
 * Error raised when parsed YAML does not match the frontmatter schema.
 * @since 0.0.1
 */
export class FrontmatterSchemaError extends Data.TaggedError("FrontmatterSchemaError")<{
	message: string;
}> {}

/**
 * Error raised when a non-YAML frontmatter block is encountered.
 * @since 0.0.1
 */
export class UnsupportedFrontmatterError extends Data.TaggedError("UnsupportedFrontmatterError")<{
	kind: string;
}> {}

const to_yaml_issue = (issue: YAMLError | YAMLWarning): YamlIssue => ({
	name: issue.name,
	code: issue.code,
	message: issue.message,
	line: issue.linePos?.[0]?.line,
	column: issue.linePos?.[0]?.col,
});

/**
 * Parses and validates a Satteri frontmatter block.
 * @param frontmatter Satteri frontmatter payload.
 * @returns An Effect resolving to parsed YAML frontmatter or null.
 * @since 0.0.1
 */
export const ParseFrontmatter = (frontmatter: Frontmatter | null) =>
	Effect.gen(function* () {
		if (!frontmatter) {
			return null;
		}

		if (frontmatter.kind !== "yaml") {
			return yield* Effect.fail(
				new UnsupportedFrontmatterError({
					kind: frontmatter.kind,
				}),
			);
		}

		const document = yield* Effect.try({
			try: () =>
				parseDocument(frontmatter.value, {
					prettyErrors: true,
					strict: true,
					uniqueKeys: true,
				}),
			catch: (error) =>
				new InternalParserError({
					message: error instanceof Error ? error.message : "Unknown error.",
				}),
		});

		const issues = [...document.errors, ...document.warnings].map(to_yaml_issue);

		if (issues.length > 0) {
			return yield* Effect.fail(
				new FrontmatterParseError({
					issues,
				}),
			);
		}

		const parsed = yield* Effect.try({
			try: () => document.toJS(),
			catch: (error) =>
				new InternalParserError({
					message: error instanceof Error ? error.message : "Unknown error.",
				}),
		});

		return yield* Schema.decodeUnknownEffect(frontmatter_schema, {
			onExcessProperty: "error",
		})(parsed).pipe(
			Effect.mapError(
				(error) =>
					new FrontmatterSchemaError({
						message: error.message,
					}),
			),
		);
	});
