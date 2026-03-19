import { describe, expect, test } from "bun:test";

import { mapVariableMetadataRow } from "../../pkg/convex/lib/project_variables/rows";

describe("mapVariableMetadataRow", () => {
  test("keeps rollout rows readable when milestones are missing", () => {
    expect(
      mapVariableMetadataRow({
        _id: "pv_123" as never,
        projectId: "project_123" as never,
        orgId: "org_123",
        stageSlug: "prod",
        name: "ROLLOUT_FLAG",
        kind: "rollout",
        createdAtMs: 1,
        updatedAtMs: 2,
        rolloutFunction: "linear",
        rolloutMilestones: null,
      }),
    ).toMatchObject({
      kind: "rollout",
      rolloutMilestones: [],
    });
  });
});
