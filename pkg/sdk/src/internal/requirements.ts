import { InvalidConfigurationProvidedError, RequirementsValidationFailedError } from "../errors.js";
import type { BarekeyStandardSchemaResult, BarekeyStandardSchemaV1 } from "../types.js";

function isStandardSchemaResult(value: unknown): value is BarekeyStandardSchemaResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "value" in value || "issues" in value;
}

export async function validateRequirements(
  requirements: BarekeyStandardSchemaV1,
  value: unknown,
): Promise<void> {
  const standard = requirements["~standard"];
  if (
    standard === undefined ||
    typeof standard !== "object" ||
    standard === null ||
    typeof standard.validate !== "function"
  ) {
    throw new InvalidConfigurationProvidedError({
      message: "requirements must implement Standard Schema v1.",
    });
  }

  const result = await standard.validate(value);
  if (!isStandardSchemaResult(result)) {
    throw new InvalidConfigurationProvidedError({
      message: "requirements returned an invalid Standard Schema result.",
    });
  }

  if ("issues" in result && Array.isArray(result.issues) && result.issues.length > 0) {
    const firstIssue = result.issues[0];
    const issuePath =
      firstIssue?.path && firstIssue.path.length > 0
        ? ` at ${firstIssue.path.map((segment: PropertyKey) => String(segment)).join(".")}`
        : "";
    const issueMessage = firstIssue?.message ?? "Validation failed.";
    throw new RequirementsValidationFailedError({
      message: `Barekey requirements validation failed${issuePath}: ${issueMessage}`,
    });
  }
}
