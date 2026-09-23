"use client";

import { createContext, useContext } from "react";
import type { EducationStatus } from "./profile-options";

export interface StudentProfile {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  educationStatus: EducationStatus | null;
  universityName: string | null;
  fieldOfStudy: string | null;
  entryYear: number | null;
  graduationYear: number | null;
  gpa: number | null;
  targetDegree: "MASTER" | "PHD" | null;
  targetField: string | null;
  targetExamYear: number | null;
  completedAt: string | null;
  completion: { complete: boolean; missing: string[]; percent: number };
}

export interface StudentSession {
  user: { id: string; phone: string; roles: string[] };
}

export interface StudentContextValue {
  me: StudentSession;
  profile: StudentProfile;
  setProfile: (profile: StudentProfile) => void;
  isInstructor: boolean;
  isStaff: boolean;
}

export const StudentContext = createContext<StudentContextValue | null>(null);

/** The signed-in student and their profile, loaded once by the shell. Pages
 * render only inside the shell, so the value is always present there. */
export function useStudent() {
  const value = useContext(StudentContext);
  if (!value) throw new Error("useStudent must be used inside StudentShell");
  return value;
}

export function studentName(profile: StudentProfile) {
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.displayName || "دانشجوی عزیز";
}

export function initials(profile: StudentProfile) {
  const first = profile.firstName?.trim()[0] ?? profile.displayName?.trim()[0] ?? "";
  const last = profile.lastName?.trim()[0] ?? "";
  return `${first}${last ? `‌${last}` : ""}` || "؟";
}
