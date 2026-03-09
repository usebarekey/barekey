type MemoryCacheRecord<TValue> = {
  value: TValue;
  storedAtMs: number;
  expiresAtMs: number | null;
};

export class MemoryCache<TValue> {
  private readonly records = new Map<string, MemoryCacheRecord<TValue>>();

  getRecord(key: string): MemoryCacheRecord<TValue> | null {
    const record = this.records.get(key) ?? null;
    if (record === null) {
      return null;
    }
    if (record.expiresAtMs !== null && record.expiresAtMs <= Date.now()) {
      this.records.delete(key);
      return null;
    }
    return record;
  }

  get(key: string): TValue | null {
    return this.getRecord(key)?.value ?? null;
  }

  set(key: string, value: TValue, expiresAtMs: number | null = null): void {
    this.records.set(key, {
      value,
      storedAtMs: Date.now(),
      expiresAtMs,
    });
  }
}
