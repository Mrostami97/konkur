"use client";

import { useEffect, useId, useState } from "react";
import { apiFetch } from "../lib/api";
import { toEnglishDigits, toPersianDigits } from "../lib/format";

export interface PickedUser {
  id: string;
  phone: string;
  name: string | null;
}

function localPhone(phone: string) {
  return toPersianDigits(phone.startsWith("+98") ? `0${phone.slice(3)}` : phone);
}

/**
 * Finds a user by part of their number or name. Replaces a <select> that
 * listed every account on the site, which stops being usable -- and starts
 * shipping every phone number to the browser -- well before launch week ends.
 */
export function UserPicker({
  value,
  onChange,
  label = "کاربر",
}: {
  value: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  label?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const q = toEnglishDigits(query).trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      apiFetch<{ users: PickedUser[] }>(`/admin/users?q=${encodeURIComponent(q)}&pageSize=8`)
        .then((res) => {
          setResults(res.users);
          setFailed(false);
        })
        .catch(() => setFailed(true))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  if (value) {
    return (
      <div className="ds-field">
        <span className="ds-label">{label}</span>
        <div className="user-picked">
          <span>
            <b dir="ltr">{localPhone(value.phone)}</b>
            {value.name && <small>{value.name}</small>}
          </span>
          <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => onChange(null)}>
            تغییر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-field user-picker">
      <label className="ds-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="ds-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="بخشی از شماره یا نام، مثلاً ۰۹۱۲۳"
        autoComplete="off"
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="ds-hint" aria-live="polite">
        {failed
          ? "جست‌وجوی کاربر ممکن نشد."
          : toEnglishDigits(query).trim().length < 3
            ? "دست‌کم سه حرف یا رقم وارد کنید."
            : searching
              ? "در حال جست‌وجو…"
              : results.length === 0
                ? "کاربری پیدا نشد."
                : `${toPersianDigits(results.length)} نتیجه`}
      </p>
      {results.length > 0 && (
        <ul className="user-results">
          {results.map((user) => (
            <li key={user.id}>
              <button type="button" onClick={() => { onChange(user); setQuery(""); setResults([]); }}>
                <b dir="ltr">{localPhone(user.phone)}</b>
                <small>{user.name ?? "بدون نام"}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
