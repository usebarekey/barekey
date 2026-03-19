import { describe, expect, test } from "bun:test";

import {
  timeZoneDateTimeToUtcMs,
  utcMsToTimeZoneDateTime,
} from "../../pkg/convex/lib/timezone";

describe("timezone helpers", () => {
  test("round-trips date and time values through a timezone", () => {
    const timestampMs = timeZoneDateTimeToUtcMs({
      dateValue: "2025-03-18",
      timeValue: "09:30",
      timeZone: "Europe/Berlin",
    });

    expect(
      utcMsToTimeZoneDateTime({
        timestampMs,
        timeZone: "Europe/Berlin",
      }),
    ).toEqual({
      dateValue: "2025-03-18",
      timeValue: "09:30",
    });
  });

  test("rejects malformed dates and times", () => {
    expect(() =>
      timeZoneDateTimeToUtcMs({
        dateValue: "03/18/2025",
        timeValue: "09:30",
        timeZone: "Europe/Berlin",
      }),
    ).toThrow("Date must use YYYY-MM-DD format.");

    expect(() =>
      timeZoneDateTimeToUtcMs({
        dateValue: "2025-03-18",
        timeValue: "9:30",
        timeZone: "Europe/Berlin",
      }),
    ).toThrow("Time must use HH:mm format.");
  });
});
