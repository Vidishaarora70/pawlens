import type { HistoryItem } from "./types";

// localStorage can be missing or throw (private mode, blocked storage) — never crash.
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const HISTORY_KEY = "pawlens-history";
const HISTORY_MAX = 30;

export const history = {
  list: () => readJSON<HistoryItem[]>(HISTORY_KEY, []),
  add(item: HistoryItem) {
    const next = [item, ...history.list().filter((h) => h.id !== item.id)].slice(0, HISTORY_MAX);
    // if storage is full, drop the oldest entries until it fits
    for (let n = next.length; n > 0; n--) if (writeJSON(HISTORY_KEY, next.slice(0, n))) break;
    window.dispatchEvent(new Event("pawlens-history"));
  },
  remove(id: string) {
    writeJSON(HISTORY_KEY, history.list().filter((h) => h.id !== id));
    window.dispatchEvent(new Event("pawlens-history"));
  },
  clear() {
    writeJSON(HISTORY_KEY, []);
    window.dispatchEvent(new Event("pawlens-history"));
  },
};
