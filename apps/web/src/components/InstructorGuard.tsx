"use client";

import { useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";

export interface InstructorProfile {
  id: string;
  slug: string;
  displayName: string;
  roleTitle: string | null;
  avatarUrl: string | null;
  isPublished: boolean;
}

const InstructorContext = createContext<InstructorProfile | null>(null);

export function useInstructor() {
  const profile = useContext(InstructorContext);
  if (!profile) throw new Error("useInstructor must be used inside InstructorGuard");
  return profile;
}

/**
 * Gate for the instructor panel.
 *
 * Asks the API who this account is rather than reading a role off the session:
 * being an instructor means being linked to a contributor profile, which is
 * exactly what the server checks and what scopes every figure in here. A role
 * check on the client could disagree with that; this cannot.
 */
export function InstructorGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    apiFetch<InstructorProfile>("/me/instructor")
      .then((res) => {
        setProfile(res);
        setState("allowed");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.push("/login");
        else setState("denied");
      });
  }, [router]);

  if (state === "checking") {
    return <main style={{ padding: "2rem" }}>در حال بررسی دسترسی...</main>;
  }
  if (state === "denied" || !profile) {
    return (
      <main style={{ padding: "2rem", maxWidth: "36rem" }}>
        <h1 className="ds-title">این حساب پنل مدرس ندارد</h1>
        <p className="ds-subtitle" style={{ marginTop: "var(--sp-3)" }}>
          پنل مدرس برای حسابی فعال می‌شود که به یک پروفایل مدرس متصل شده باشد. اگر باید به آن دسترسی داشته
          باشید، از مدیر بخواهید حساب شما را در «نویسندگان و مدرسان» به پروفایلتان وصل کند.
        </p>
      </main>
    );
  }
  return <InstructorContext.Provider value={profile}>{children}</InstructorContext.Provider>;
}
