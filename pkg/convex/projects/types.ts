import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";

export const projectSummaryValidator = v.object({
  id: v.id("projects"),
  orgId: v.string(),
  orgSlug: v.string(),
  name: v.string(),
  slug: v.string(),
  slugBase: v.string(),
  createdByClerkUserId: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

export const projectListItemValidator = v.object({
  id: v.id("projects"),
  orgId: v.string(),
  orgSlug: v.string(),
  name: v.string(),
  slug: v.string(),
  slugBase: v.string(),
  createdByClerkUserId: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  secretCount: v.number(),
});

export type ProjectSummary = {
  id: Id<"projects">;
  orgId: string;
  orgSlug: string;
  name: string;
  slug: string;
  slugBase: string;
  createdByClerkUserId: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export const DEFAULT_PROJECT_STAGES = [
  {
    slug: "development",
    name: "Development",
  },
  {
    slug: "production",
    name: "Production",
  },
] as const;
