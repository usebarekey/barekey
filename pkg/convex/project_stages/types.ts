import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Schema } from "effect";
import { v } from "convex/values";

export const stageSummaryValidator = v.object({
  id: v.id("projectStages"),
  projectId: v.id("projects"),
  orgId: v.string(),
  slug: v.string(),
  name: v.string(),
  isDefault: v.boolean(),
  variableCount: v.number(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

export const stageSummarySchema = Schema.Struct({
  id: ConfectId.Id("projectStages"),
  projectId: ConfectId.Id("projects"),
  orgId: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  variableCount: Schema.Number,
  createdAtMs: Schema.Number,
  updatedAtMs: Schema.Number,
});

export const DEFAULT_STAGE_DEFINITIONS = [
  {
    slug: "development",
    name: "Development",
  },
  {
    slug: "production",
    name: "Production",
  },
] as const;
