"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";

const STAFF_ROLES = ["ADMIN", "AUTHOR", "REVIEWER", "FINANCE", "MENTOR"];

/** The signed-in staff member's roles, published by AdminGuard so the shell
 * can show only the destinations this person can actually use. Reading it
 * outside the guard yields an empty list, which shows nothing rather than
 * everything. */
const StaffRolesContext = createContext<string[]>([]);

export function useStaffRoles() {
  return useContext(StaffRolesContext);
}

/** Client-side gate: staff-only pages still rely on the API's own RBAC guards
 * for real enforcement -- this only avoids flashing a form a student can't use. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "denied" | "mixed">("checking");
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ user: { roles: string[] } }>("/auth/me")
      .then((res) => {
        const staff = res.user.roles.some((r) => STAFF_ROLES.includes(r));
        // A student is never staff; the API refuses such an account too.
        if (res.user.roles.includes("STUDENT")) {
          setState(staff ? "mixed" : "denied");
        } else if (staff) {
          setRoles(res.user.roles);
          setState("allowed");
        } else {
          setState("denied");
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
        } else {
          setState("denied");
        }
      });
  }, [router]);

  if (state === "checking") return <main className="guard-state">در حال بررسی دسترسی…</main>;
  if (state !== "allowed") {
    return (
      <main className="guard-state">
        <h1>پنل مدیریت برای این حساب نیست</h1>
        <p>
          {state === "mixed"
            ? "این حساب هم نقش دانشجو دارد و هم نقش کارمندی. حساب دانشجو و حساب کارکنان باید جدا باشند؛ مدیر سایت باید از بخش «کاربران» یکی را برای این حساب نگه دارد."
            : "این بخش فقط برای مدیر و کارکنان سایت است."}
        </p>
        <Link href="/account" className="ds-btn ds-btn-primary">رفتن به پنل دانشجو</Link>
      </main>
    );
  }
  return <StaffRolesContext.Provider value={roles}>{children}</StaffRolesContext.Provider>;
}
