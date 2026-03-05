import { BarekeyError, parseBooleanOrThrow, parseNumberOrThrow } from "./errors";
import type { BarekeyResolvedValue } from "./types";

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
    return parseNumberOrThrow(resolved.value);
  }

  async boolean(): Promise<boolean> {
    const resolved = await this.resolve();
    return parseBooleanOrThrow(resolved.value);
  }

  async json<TJson = TValue>(): Promise<TJson> {
    const resolved = await this.resolve();
    try {
      return JSON.parse(resolved.value) as TJson;
    } catch {
      throw new BarekeyError({
        code: "COERCE_FAILED",
        message: `Unable to parse JSON value for ${resolved.name}.`,
      });
    }
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
