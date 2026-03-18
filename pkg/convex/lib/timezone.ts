import { throwValidationError } from "./errors/effect";

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timeZoneFormatterCache.get(timeZone);
  if (formatter !== undefined) {
    return formatter;
  }

  formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  timeZoneFormatterCache.set(timeZone, formatter);
  return formatter;
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDateValue(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) {
    return throwValidationError("Date must use YYYY-MM-DD format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return throwValidationError("Date is invalid.");
  }

  return { year, month, day };
}

function parseTimeValue(value: string): {
  hour: number;
  minute: number;
} {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (match === null) {
    return throwValidationError("Time must use HH:mm format.");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return throwValidationError("Hour must be between 00 and 23.");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return throwValidationError("Minute must be between 00 and 59.");
  }

  return { hour, minute };
}

function getFormattedTimeZoneDateParts(input: {
  timestampMs: number;
  timeZone: string;
}): TimeZoneDateParts {
  const formatter = getTimeZoneFormatter(input.timeZone);
  const parts = formatter.formatToParts(new Date(input.timestampMs));
  const values = new Map<string, number>();

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values.set(part.type, Number(part.value));
    }
  }

  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  const hour = values.get("hour");
  const minute = values.get("minute");
  const second = values.get("second");
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return throwValidationError(`Unable to resolve timezone parts for ${input.timeZone}.`);
  }

  return {
    year,
    month,
    day,
    hour: hour === 24 ? 0 : hour,
    minute,
    second,
  };
}

function getTimeZoneOffsetMs(input: { timestampMs: number; timeZone: string }): number {
  const parts = getFormattedTimeZoneDateParts(input);
  const representedUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  return representedUtcMs - input.timestampMs;
}

export function utcMsToTimeZoneDateTime(input: { timestampMs: number; timeZone: string }): {
  dateValue: string;
  timeValue: string;
} {
  const parts = getFormattedTimeZoneDateParts(input);
  return {
    dateValue: `${parts.year}-${padTwo(parts.month)}-${padTwo(parts.day)}`,
    timeValue: `${padTwo(parts.hour)}:${padTwo(parts.minute)}`,
  };
}

export function timeZoneDateTimeToUtcMs(input: {
  dateValue: string;
  timeValue: string;
  timeZone: string;
}): number {
  const date = parseDateValue(input.dateValue);
  const time = parseTimeValue(input.timeValue);
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0, 0);

  let offsetMs = getTimeZoneOffsetMs({
    timestampMs: utcGuess,
    timeZone: input.timeZone,
  });
  let resolvedUtcMs = utcGuess - offsetMs;
  const adjustedOffsetMs = getTimeZoneOffsetMs({
    timestampMs: resolvedUtcMs,
    timeZone: input.timeZone,
  });
  if (adjustedOffsetMs !== offsetMs) {
    offsetMs = adjustedOffsetMs;
    resolvedUtcMs = utcGuess - offsetMs;
  }

  const verification = utcMsToTimeZoneDateTime({
    timestampMs: resolvedUtcMs,
    timeZone: input.timeZone,
  });
  if (
    verification.dateValue !== input.dateValue ||
    verification.timeValue !== `${padTwo(time.hour)}:${padTwo(time.minute)}`
  ) {
    return throwValidationError("Selected time does not exist in the chosen timezone.");
  }

  return resolvedUtcMs;
}

export function formatUtcMsInTimeZone(input: {
  timestampMs: number;
  timeZone: string;
  includeTimeZoneName?: boolean;
}): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: input.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: input.includeTimeZoneName ? "short" : undefined,
  }).format(new Date(input.timestampMs));
}
