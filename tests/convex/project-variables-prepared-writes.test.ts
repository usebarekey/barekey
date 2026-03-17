import { describe, expect, test } from "bun:test";

import type { Id } from "../../pkg/convex/_generated/dataModel";
import { summarizePreparedWriteApplication } from "../../pkg/convex/project_variables/prepared_write_summary";

describe("summarizePreparedWriteApplication", () => {
  test("measures mixed create, update, and delete storage deltas", () => {
    const storageDelta = summarizePreparedWriteApplication({
      existingRows: [
        {
          _id: "var_delete" as Id<"projectVariables">,
          name: "DELETE_ME",
          encryptedValue: "abcd",
          encryptedValueA: null,
          encryptedValueB: null,
        },
        {
          _id: "var_update" as Id<"projectVariables">,
          name: "UPDATE_ME",
          encryptedValue: "aa",
          encryptedValueA: null,
          encryptedValueB: null,
        },
      ],
      creates: [
        {
          name: "CREATE_ME",
          visibility: "private",
          kind: "secret",
          declaredType: "string",
          encryptedValue: "12345",
          encryptedValueA: null,
          encryptedValueB: null,
          chance: null,
          rolloutFunction: null,
          rolloutMilestones: null,
        },
      ],
      updates: [
        {
          id: "var_update" as Id<"projectVariables">,
          visibility: "private",
          kind: "secret",
          declaredType: "string",
          encryptedValue: "abcdef",
          encryptedValueA: null,
          encryptedValueB: null,
          chance: null,
          rolloutFunction: null,
          rolloutMilestones: null,
        },
      ],
      deletes: ["var_delete" as Id<"projectVariables">],
    });

    expect(storageDelta).toEqual({
      storageDeltaBytes: 5,
    });
  });

  test("throws when an updated variable is also deleted", () => {
    expect(() =>
      summarizePreparedWriteApplication({
        existingRows: [
          {
            _id: "var_1" as Id<"projectVariables">,
            name: "TOKEN",
            encryptedValue: "abcd",
            encryptedValueA: null,
            encryptedValueB: null,
          },
        ],
        creates: [],
        updates: [
          {
            id: "var_1" as Id<"projectVariables">,
            visibility: "private",
            kind: "secret",
            declaredType: "string",
            encryptedValue: "abcdef",
            encryptedValueA: null,
            encryptedValueB: null,
            chance: null,
            rolloutFunction: null,
            rolloutMilestones: null,
          },
        ],
        deletes: ["var_1" as Id<"projectVariables">],
      }),
    ).toThrow("Cannot update a variable that is marked for deletion.");
  });
});
