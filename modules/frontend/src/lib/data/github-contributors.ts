import { Schema } from "effect";

export const ContributorSchema = Schema.Struct({
	avatar: Schema.NullOr(Schema.String),
	commits: Schema.Number,
	diff: Schema.NullOr(
		Schema.Struct({
			minus: Schema.Number,
			plus: Schema.Number,
		}),
	),
	is_barekey_member: Schema.Boolean,
	name: Schema.String,
	profile_url: Schema.NullOr(Schema.String),
});

export const ContributorsResponseSchema = Schema.Struct({
	contributors: Schema.Array(ContributorSchema),
});

export type Contributor = typeof ContributorSchema.Type;
