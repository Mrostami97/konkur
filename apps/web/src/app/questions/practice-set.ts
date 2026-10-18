/**
 * A practice set from the exam builder, walked one question at a time: the
 * ids live in this tab's session storage, so the question page can offer the
 * next one. Storage may be unavailable (private mode); then there is no set.
 */
const KEY = "kk-practice-set";

export function savePracticeSet(ids: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* no storage: the first question still opens */
  }
}

export function readPracticeSet(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function clearPracticeSet() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
