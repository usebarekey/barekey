import {
  BarekeyError,
  parseBigIntOrThrow,
  parseBooleanOrThrow,
  parseDateOrThrow,
  parseFloatOrThrow,
  parseJsonOrThrow,
  parseTemporalInstantOrThrow,
} from "./errors";
import type { BarekeyDeclaredType, BarekeyResolvedValue, BarekeyTemporalInstant } from "./types";

export class BarekeyValueBuilder<TValue> {
  private readonly resolve: () => Promise<BarekeyResolvedValue>;

  constructor(resolve: () => Promise<BarekeyResolvedValue>) {
    this.resolve = resolve;
  }

  async raw(): Promise<BarekeyResolvedValue> {
    return this.resolve();
  }

  async string(): Promise<string> {
    const resolved = await this.resolve();
    return resolved.value;
  }

  async number(): Promise<number> {
    const resolved = await this.resolve();
    return parseFloatOrThrow(resolved.value);
  }

  async float(): Promise<number> {
    const resolved = await this.resolve();
    return parseFloatOrThrow(resolved.value);
  }

  async integer(): Promise<bigint> {
    const resolved = await this.resolve();
    return parseBigIntOrThrow(resolved.value);
  }

  async boolean(): Promise<boolean> {
    const resolved = await this.resolve();
    return parseBooleanOrThrow(resolved.value);
  }

  async date(): Promise<BarekeyTemporalInstant> {
    const resolved = await this.resolve();
    return parseTemporalInstantOrThrow(resolved.value);
  }

  async toDate(): Promise<Date> {
    const resolved = await this.resolve();
    return parseDateOrThrow(resolved.value);
  }

  async json<TJson = TValue>(): Promise<TJson> {
    const resolved = await this.resolve();
    return parseJsonOrThrow<TJson>(resolved.value);
  }

  async coerce(): Promise<TValue>;
  async coerce(type: "string"): Promise<string>;
  async coerce(type: "boolean"): Promise<boolean>;
  async coerce(type: "int64"): Promise<bigint>;
  async coerce(type: "float"): Promise<number>;
  async coerce(type: "date"): Promise<BarekeyTemporalInstant>;
  async coerce(type: "json"): Promise<unknown>;
  async coerce(type?: BarekeyDeclaredType): Promise<unknown> {
    const resolved = await this.resolve();
    const targetType = type ?? resolved.declaredType;

    if (targetType === "string") {
      return resolved.value;
    }
    if (targetType === "boolean") {
      return parseBooleanOrThrow(resolved.value);
    }
    if (targetType === "int64") {
      return parseBigIntOrThrow(resolved.value);
    }
    if (targetType === "float") {
      return parseFloatOrThrow(resolved.value);
    }
    if (targetType === "date") {
      return parseTemporalInstantOrThrow(resolved.value);
    }
    if (targetType === "json") {
      return parseJsonOrThrow(resolved.value);
    }
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unsupported coercion target: ${String(targetType)}`,
    });
  }

  async default<TDefault>(fallback: TDefault): Promise<string | TDefault> {
    try {
      return await this.string();
    } catch {
      return fallback;
    }
  }

  async required(message?: string): Promise<string> {
    try {
      const value = await this.string();
      if (value.length === 0) {
        throw new BarekeyError({
          code: "REQUIRED_VALUE_MISSING",
          message: message ?? "Required value is empty.",
        });
      }
      return value;
    } catch (error: unknown) {
      if (error instanceof BarekeyError) {
        throw error;
      }
      throw new BarekeyError({
        code: "REQUIRED_VALUE_MISSING",
        message: message ?? "Required value is missing.",
      });
    }
  }
}
