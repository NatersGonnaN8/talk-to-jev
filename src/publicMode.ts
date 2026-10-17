import { useEffect, useState } from "react";

/**
 * Public mode on the client: the free tier, and a visitor's own OpenRouter key.
 *
 * The key lives only in this browser. Default: sessionStorage (gone when the
 * tab closes). Opt-in "remember on this device": localStorage. It is sent in
 * one request header (never in a body, never in the Inspector or history) to
 * our server, which uses it for that request only.
 */

export const GITHUB_URL = "https://github.com/NatersGonnaN8/talk-to-jev";
export const BYOK_HEADER = "X-Jev-OpenRouter-Key";

const KEY_STORE = "talk-to-jev:byok-key";
const CHANGE = "talk-to-jev:byok-change";

export type FreeModel = { id: string; name: string };
export type PublicInfo = {
  /** True on the hosted public copy. */
  public: boolean;
  freeAvailable: boolean;
  freeModels: FreeModel[];
  defaultFreeModel: string;
};

let info: PublicInfo = {
  public: false,
  freeAvailable: false,
  freeModels: [],
  defaultFreeModel: "",
};
const infoListeners = new Set<() => void>();

export function setPublicInfo(next: PublicInfo) {
  info = next;
  for (const fn of infoListeners) fn();
}

export function getPublicInfo(): PublicInfo {
  return info;
}

export function usePublicInfo(): PublicInfo {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((n) => n + 1);
    infoListeners.add(fn);
    return () => {
      infoListeners.delete(fn);
    };
  }, []);
  return info;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The visitor's key, or "". Session first, then the remembered one. */
export function readByokKey(): string {
  return safe(
    () => sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE) || "",
    "",
  );
}

export function byokRemembered(): boolean {
  return safe(() => Boolean(localStorage.getItem(KEY_STORE)), false);
}

function announce() {
  safe(() => window.dispatchEvent(new Event(CHANGE)), undefined);
}

/** Looks like an OpenRouter key (url-safe token). The server checks again. */
export function looksLikeKey(raw: string): boolean {
  return /^[A-Za-z0-9_-]{20,512}$/.test(raw.trim());
}

export function saveByokKey(raw: string, remember: boolean): boolean {
  const key = raw.trim();
  if (!looksLikeKey(key)) return false;
  safe(() => sessionStorage.removeItem(KEY_STORE), undefined);
  safe(() => localStorage.removeItem(KEY_STORE), undefined);
  if (remember) safe(() => localStorage.setItem(KEY_STORE, key), undefined);
  else safe(() => sessionStorage.setItem(KEY_STORE, key), undefined);
  announce();
  return true;
}

export function clearByokKey() {
  safe(() => sessionStorage.removeItem(KEY_STORE), undefined);
  safe(() => localStorage.removeItem(KEY_STORE), undefined);
  announce();
}

export function lastFour(key: string): string {
  return key.length > 4 ? key.slice(-4) : "";
}

/** Header for the three requests that spend a key. Empty when the visitor has none. */
export function byokHeaders(): Record<string, string> {
  const key = readByokKey();
  return key ? { [BYOK_HEADER]: key } : {};
}

export function useByokKey(): string {
  const [key, setKey] = useState(readByokKey);
  useEffect(() => {
    const onChange = () => setKey(readByokKey());
    window.addEventListener(CHANGE, onChange);
    return () => window.removeEventListener(CHANGE, onChange);
  }, []);
  return key;
}

/** On the free tier (public copy, no visitor key) the picker and every request are limited to the free list. */
export function freeOnly(): boolean {
  return info.public && !readByokKey();
}

/** The model to actually send: a stored pick that is not free falls back to the free default. */
export function effectiveModel(stored: string): string {
  if (!freeOnly()) return stored;
  if (info.freeModels.some((m) => m.id === stored)) return stored;
  return info.defaultFreeModel || stored;
}
