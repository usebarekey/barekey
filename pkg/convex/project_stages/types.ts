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
