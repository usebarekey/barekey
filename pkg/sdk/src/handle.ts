import {
  coerceEvaluatedValue,
  parseDeclaredValue,
  type BarekeyCoerceTarget,
} from "./internal/evaluate.js";
import type { BarekeyEvaluatedValue } from "./types.js";

export class BarekeyEnvHandle<TValue = unknown> implements PromiseLike<TValue> {
  private readonly resolveEvaluatedValue: () => Promise<BarekeyEvaluatedValue>;
  private readonly transform: (resolved: BarekeyEvaluatedValue) => Promise<TValue>;
  private evaluatedValuePromise: Promise<BarekeyEvaluatedValue> | null = null;

  constructor(
    resolveEvaluatedValue: () => Promise<BarekeyEvaluatedValue>,
    transform?: (resolved: BarekeyEvaluatedValue) => Promise<TValue>,
  ) {
    this.resolveEvaluatedValue = resolveEvaluatedValue;
    this.transform =
      transform ??
      (async (resolved) => parseDeclaredValue(resolved.value, resolved.declaredType) as TValue);
  }

  private async resolveValue(): Promise<TValue> {
    return await this.transform(await this.getEvaluatedValue());
  }

  private async getEvaluatedValue(): Promise<BarekeyEvaluatedValue> {
    if (this.evaluatedValuePromise === null) {
      this.evaluatedValuePromise = this.resolveEvaluatedValue();
    }
    return await this.evaluatedValuePromise;
  }

  coerce<TCoerced = unknown>(target: BarekeyCoerceTarget): BarekeyEnvHandle<TCoerced> {
    return new BarekeyEnvHandle<TCoerced>(
      async () => await this.getEvaluatedValue(),
      async (resolved) => {
        return coerceEvaluatedValue(resolved, target) as TCoerced;
      },
    );
  }

  then<TResult1 = TValue, TResult2 = never>(
    onfulfilled?: ((value: TValue) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolveValue().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TValue | TResult> {
    return this.resolveValue().catch(onrejected ?? undefined);
  }

  finally(onfinally?: (() => void) | null): Promise<TValue> {
    return this.resolveValue().finally(onfinally ?? undefined);
  }
}
