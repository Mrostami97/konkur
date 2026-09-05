"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export function AuthStatus() {
  const [phone, setPhone] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiFetch<{ user: { phone: string } }>("/auth/me")
      .then((res) => setPhone(res.user.phone))
      .catch(() => setPhone(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;

  return phone ? (
    <Link href="/account">{phone}</Link>
  ) : (
    <Link href="/login">ورود</Link>
  );
}
