"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  colorScheme?: "light" | "dark";
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  BackButton: { show(): void; hide(): void; onClick(handler: () => void): void; offClick(handler: () => void): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const FLAG = "kk-telegram";
const SCRIPT = "https://telegram.org/js/telegram-web-app.js";
const HOME = "/tg";

function insideTelegram() {
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

function loadWebApp(): Promise<TelegramWebApp | null> {
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
 * When the site is opened as the Telegram mini app: full height, Telegram's
 * own back button instead of the site footer and tab bar, and the header
 * colour matched. Outside Telegram it does nothing and loads nothing.
 */
export function TelegramBridge() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [app, setApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    if (!insideTelegram()) return;
    document.documentElement.dataset.tg = "1";
    void loadWebApp().then((webApp) => {
      if (!webApp) return;
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor?.("bg_color");
      setApp(webApp);
    });
  }, []);

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
