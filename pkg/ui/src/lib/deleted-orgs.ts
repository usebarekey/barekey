const DELETED_ORG_STORAGE_KEY = "barekey:deleted-org-ids";
const DELETED_ORG_EVENT = "barekey:deleted-orgs-changed";
const EMPTY_DELETED_ORG_IDS: Array<string> = [];

let cachedRawDeletedOrgIds: string | null = null;
let cachedDeletedOrgIds: Array<string> = EMPTY_DELETED_ORG_IDS;

function readWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

export function listLocallyDeletedOrgIds(): Array<string> {
  const currentWindow = readWindow();
  if (currentWindow === null) {
    return EMPTY_DELETED_ORG_IDS;
  }

  try {
    const raw = currentWindow.sessionStorage.getItem(DELETED_ORG_STORAGE_KEY);
    if (!raw) {
      cachedRawDeletedOrgIds = null;
      cachedDeletedOrgIds = EMPTY_DELETED_ORG_IDS;
      return cachedDeletedOrgIds;
    }

    if (raw === cachedRawDeletedOrgIds) {
      return cachedDeletedOrgIds;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cachedRawDeletedOrgIds = null;
      cachedDeletedOrgIds = EMPTY_DELETED_ORG_IDS;
      return cachedDeletedOrgIds;
    }

    const nextIds = parsed.filter((value): value is string => typeof value === "string");
    cachedRawDeletedOrgIds = raw;
    cachedDeletedOrgIds = nextIds.length === 0 ? EMPTY_DELETED_ORG_IDS : nextIds;
    return cachedDeletedOrgIds;
  } catch {
    cachedRawDeletedOrgIds = null;
    cachedDeletedOrgIds = EMPTY_DELETED_ORG_IDS;
    return cachedDeletedOrgIds;
  }
}

function writeDeletedOrgIds(nextIds: Array<string>) {
  const currentWindow = readWindow();
  if (currentWindow === null) {
    return;
  }

  currentWindow.sessionStorage.setItem(DELETED_ORG_STORAGE_KEY, JSON.stringify(nextIds));
  currentWindow.dispatchEvent(new CustomEvent(DELETED_ORG_EVENT, { detail: nextIds }));
}

export function markOrgDeletedLocally(orgId: string) {
  const ids = new Set(listLocallyDeletedOrgIds());
  ids.add(orgId);
  writeDeletedOrgIds([...ids]);
}

export function unmarkOrgDeletedLocally(orgId: string) {
  const ids = new Set(listLocallyDeletedOrgIds());
  ids.delete(orgId);
  writeDeletedOrgIds([...ids]);
}

export function subscribeToDeletedOrgIds(callback: () => void): () => void {
  const currentWindow = readWindow();
  if (currentWindow === null) {
    return () => {};
  }

  const handleChange = () => {
    callback();
  };

  currentWindow.addEventListener(DELETED_ORG_EVENT, handleChange);
  currentWindow.addEventListener("storage", handleChange);

  return () => {
    currentWindow.removeEventListener(DELETED_ORG_EVENT, handleChange);
    currentWindow.removeEventListener("storage", handleChange);
  };
}
