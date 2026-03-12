import { v } from "convex/values";

export const variableVisibilityValidator = v.union(
  v.literal("private"),
  v.literal("public"),
);

export type VariableVisibility = "private" | "public";

export function getVariableVisibility(input: {
  visibility?: VariableVisibility | null;
}): VariableVisibility {
  return input.visibility === "public" ? "public" : "private";
}
