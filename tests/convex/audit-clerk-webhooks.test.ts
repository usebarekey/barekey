import { describe, expect, test } from "bun:test";

import { decodeClerkWebhookEnvelope } from "../../pkg/convex/audit/clerk_webhooks/schema";

describe("decodeClerkWebhookEnvelope", () => {
  test("decodes supported Clerk webhook envelopes from JSON", () => {
    expect(
      decodeClerkWebhookEnvelope(
        JSON.stringify({
          type: "organizationMembership.created",
          data: {
            organization_id: "org_123",
            public_organization_data: {
              slug: "acme",
              name: "Acme",
            },
            public_user_data: {
              user_id: "user_123",
              identifier: "sander@example.com",
              first_name: "Sander",
              last_name: "Aarts",
            },
          },
        }),
      ),
    ).toEqual({
      type: "organizationMembership.created",
      data: {
        organization_id: "org_123",
        public_organization_data: {
          slug: "acme",
          name: "Acme",
        },
        public_user_data: {
          user_id: "user_123",
          identifier: "sander@example.com",
          first_name: "Sander",
          last_name: "Aarts",
        },
      },
    });
  });

  test("returns null for malformed or incomplete webhook payloads", () => {
    expect(decodeClerkWebhookEnvelope("{")).toBeNull();
    expect(
      decodeClerkWebhookEnvelope(
        JSON.stringify({
          data: {},
        }),
      ),
    ).toBeNull();
  });
});
