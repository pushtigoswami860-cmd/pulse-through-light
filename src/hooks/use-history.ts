import { useSyncExternalStore } from "react";
import { addReading, parseHistory, removeReading, type Reading } from "@/lib/history/history";

/** Readings live only in this browser's localStorage — never sent anywhere. */
const KEY = "veyra.history.v1";
const EMPTY: Reading[] = [];
const listeners = new Set<() => void>();
let cache: Reading[] | null = null;

function read(): Reading[] {
  if (cache) return cache;
  try {
    cache = parseHistory(window.localStorage.getItem(KEY));
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Reading[]) {
  cache = next;
  try {
    if (next.length) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage full or blocked (private mode): keep the in-memory copy for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const historyActions = {
  add: (r: Reading) => write(addReading(read(), r)),
  remove: (id: string) => write(removeReading(read(), id)),
  clear: () => write(EMPTY),
};

/** Saved readings, newest first. Empty during server render and before hydration. */
export function useHistory() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
