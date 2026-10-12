import { useEffect, useState } from "react";
import { apiFetch } from "./api";

/** What GET /site/availability reports: published items per feature. */
export interface Availability {
  smsLogin: boolean;
  /** Whether a requested login code can reach anyone: by SMS, or in development via the API log. */
  otpLogin: boolean;
  courses: number;
  paidCourses: number;
  questions: number;
  exams: number;
  freeVideos: number;
  resources: number;
  consultations: number;
  instructors: number;
  results: number;
  reportCards: number;
  programs: number;
}

/** Below this many questions the bank is still being filled, not usable. */
export const MIN_QUESTIONS_FOR_BANK = 50;

/** The site paths whose feature has nothing published yet. */
export function comingSoonPaths(availability: Availability | null): Set<string> {
  const soon = new Set<string>();
  if (!availability) return soon;
  if (!availability.courses) soon.add("/courses");
  if (!availability.freeVideos) soon.add("/free-videos");
  if (!availability.resources) soon.add("/resources");
  if (!availability.instructors) soon.add("/instructors");
  // /consultations always shows its plans and prices, and /report-cards and
  // /rank-estimate always have the aggregated report-card data, so neither
  // is "coming soon" even before a bookable slot or a consented card exists.
  if (availability.questions < MIN_QUESTIONS_FOR_BANK) soon.add("/questions");
  if (!availability.exams) soon.add("/exams");
  // /results always has something: with no student-submitted result yet it
  // leads to the documented results on /evidence.
  if (!availability.programs) {
    soon.add("/programs");
    soon.add("/choices");
  }
  return soon;
}

// One request per page load, shared by the header, footer and any page that
// asks; a failed read resolves to null, which marks nothing -- an outage must
// not relabel the whole site "coming soon".
let pending: Promise<Availability | null> | null = null;

function loadAvailability() {
  pending ??= apiFetch<Availability>("/site/availability").catch(() => {
    pending = null;
    return null;
  });
  return pending;
}

/**
 * The live availability flags, read in the browser so the pages themselves
 * stay static: marks appear a moment after load and vanish by themselves the
 * moment something is published, with nobody editing code.
 */
export function useAvailability() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  useEffect(() => {
    let live = true;
    void loadAvailability().then((value) => {
      if (live) setAvailability(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return availability;
}

/** The set of hrefs to tag "coming soon"; empty until the flags arrive. */
export function useComingSoon() {
  return comingSoonPaths(useAvailability());
}
