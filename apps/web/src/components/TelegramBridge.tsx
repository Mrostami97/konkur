"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { startParamPath } from "../lib/telegram-links";

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { first_name?: string }; start_param?: string };
  ready(): void;
  expand(): void;
  colorScheme?: "light" | "dark";
  setHeaderColor?(color: string): void;
  HapticFeedback?: { impactOccurred(style: "light" | "medium"): void };
  BackButton: { show(): void; hide(): void; onClick(handler: () => void): void; offClick(handler: () => void): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const FLAG = "kk-telegram";
const SIGNED_IN = "kk-telegram-session";
const STARTED = "kk-telegram-started";
const SCRIPT = "https://telegram.org/js/telegram-web-app.js";
const HOME = "/tg";

/**
 * The page a deep link (`t.me/<bot>?startapp=…`) asked for, once per launch:
 * after it has been opened, coming back to /tg shows the home.
 */
function startPage(webApp: TelegramWebApp | null): string | null {
  if (window.location.pathname !== HOME) return null;
  const param = new URLSearchParams(window.location.search).get("tgWebAppStartParam") ?? webApp?.initDataUnsafe?.start_param;
  const path = startParamPath(param);
  if (!path) return null;
  try {
    if (sessionStorage.getItem(STARTED) === param) return null;
    sessionStorage.setItem(STARTED, param ?? "");
  } catch {
    // No storage: the link still opens its page.
  }
  return path;
}

/** Whether this page runs inside the Telegram mini app (remembered for the tab). */
export function insideTelegram() {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.hash.includes("tgWebAppData") || window.location.search.includes("tgWebAppStartParam")) {
      sessionStorage.setItem(FLAG, "1");
    }
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return window.location.hash.includes("tgWebAppData");
  }
}

let loading: Promise<TelegramWebApp | null> | null = null;

/** Telegram's WebApp object; null outside Telegram or when its script cannot load. */
export function loadWebApp(): Promise<TelegramWebApp | null> {
  if (typeof window === "undefined" || !insideTelegram()) return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    // Telegram's script may be unreachable; the site works without it.
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * After a normal sign-in inside the mini app, links the account to this
 * Telegram account so the next launch signs in by itself. Silent outside
 * Telegram and on any failure.
 */
export async function linkTelegramAccount() {
  const webApp = await loadWebApp();
  if (!webApp?.initData) return;
  try {
    await apiFetch("/auth/telegram/link", { method: "POST", body: { initData: webApp.initData } });
  } catch {
    // Linking is a convenience; signing in already worked.
  }
}

/**
 * When the site is opened as the Telegram mini app: full height, signed in
 * automatically once the Telegram account is linked, Telegram's back button
 * instead of the site footer and tab bar. Outside Telegram it does nothing
 * and loads nothing.
 */
export function TelegramBridge() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [app, setApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    if (!insideTelegram()) return;
    document.documentElement.dataset.tg = "1";
    void loadWebApp().then(async (webApp) => {
      // Only after Telegram's script has read its launch data from the address
      // (or failed to load), since moving on drops that data from the address.
      const start = startPage(webApp);
      if (start) router.replace(start);
      if (!webApp) return;
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor?.("bg_color");
      setApp(webApp);
      let tried = false;
      try {
        tried = sessionStorage.getItem(SIGNED_IN) === "1";
        sessionStorage.setItem(SIGNED_IN, "1");
      } catch {
        // No storage: try once per page load instead.
      }
      if (tried || !webApp.initData) return;
      try {
        const result = await apiFetch<{ linked: boolean }>("/auth/telegram/session", { method: "POST", body: { initData: webApp.initData } });
        if (result.linked) {
          window.dispatchEvent(new Event("kk-signed-in"));
          router.refresh();
        }
      } catch {
        // Not linked or Telegram data refused: the visitor signs in normally.
      }
    });
  }, [router]);

  useEffect(() => {
    if (!app) return;
    const back = () => (window.history.length > 1 ? router.back() : router.push(HOME));
    if (pathname === HOME) {
      app.BackButton.hide();
      return;
    }
    app.BackButton.show();
    app.BackButton.onClick(back);
    return () => app.BackButton.offClick(back);
  }, [app, pathname, router]);

  return null;
}
