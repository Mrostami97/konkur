"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";

const STAFF_ROLES = ["ADMIN", "AUTHOR", "REVIEWER", "FINANCE", "MENTOR"];

/** Client-side gate: staff-only pages still rely on the API's own RBAC guards
 * for real enforcement -- this only avoids flashing a form a student can't use. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    apiFetch<{ user: { roles: string[] } }>("/auth/me")
      .then((res) => {
        if (res.user.roles.some((r) => STAFF_ROLES.includes(r))) {
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

  if (state === "checking") return <main style={{ padding: "2rem" }}>در حال بررسی دسترسی...</main>;
  if (state === "denied") return <main style={{ padding: "2rem" }}>دسترسی ندارید.</main>;
  return <>{children}</>;
}
