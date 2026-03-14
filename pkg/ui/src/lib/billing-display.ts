export function formatRequestCount(value: number): string {
  if (value >= 1_000_000 && value % 1_000_000 === 0) {
    return `${value / 1_000_000}M`;
  }
  if (value >= 1_000 && value % 1_000 === 0) {
    return `${value / 1_000}k`;
  }
  return value.toLocaleString();
}

export function formatStorageBytes(value: number): string {
  if (value >= 1_000_000_000 && value % 1_000_000_000 === 0) {
    return `${value / 1_000_000_000} GB`;
  }
  if (value >= 1_000_000) {
    const mb = value / 1_000_000;
    const rounded = mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1);
    return `${rounded} MB`;
  }
  return `${value} B`;
}

export function formatUsageProgress(used: number | null, included: number | null, unit: "requests" | "bytes"): string {
  const usedLabel =
    used === null ? "0" : unit === "bytes" ? formatStorageBytes(used) : formatRequestCount(used);
  const includedLabel =
    included === null
      ? "unlimited"
      : unit === "bytes"
        ? formatStorageBytes(included)
        : formatRequestCount(included);
  return `${usedLabel} / ${includedLabel}`;
}

export function formatOverageHint(overageAllowed: boolean | null | undefined): string {
  if (overageAllowed === true) {
    return "Overages enabled";
  }
  if (overageAllowed === false) {
    return "Overages disabled";
  }
  return "Usage unavailable";
}
