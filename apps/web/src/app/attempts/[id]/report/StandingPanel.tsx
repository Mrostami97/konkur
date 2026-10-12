"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { formatRial, toPersianDigits } from "../../../../lib/format";
import type { CourseRecommendation, Standing } from "../../../account/data";

/**
 * Where this attempt sits among everyone who took the exam, by the konkur
 * percentage (a wrong answer costs a third of a right one). Only aggregates
 * are shown; with fewer than the minimum participants, the rank is withheld
 * rather than shown as a number that means little.
 */
export function StandingPanel({ attemptId }: { attemptId: string }) {
  const [standing, setStanding] = useState<Standing | null>(null);
  const [recommended, setRecommended] = useState<CourseRecommendation[]>([]);

  useEffect(() => {
    apiFetch<Standing>(`/attempts/${attemptId}/standing`).then(setStanding).catch(() => setStanding(null));
    apiFetch<CourseRecommendation[]>("/me/recommendations/courses").then(setRecommended).catch(() => setRecommended([]));
  }, [attemptId]);

  if (!standing) return null;
  const mine = Math.min(9, Math.max(0, Math.floor(Math.max(0, standing.konkurPercent) / 10)));
  const tallest = Math.max(1, ...standing.distribution.map((bucket) => bucket.count));

  return (
    <section className="rp-standing">
      <div className="rp-standing-main">
        <div className="rp-rank">
          {standing.rank !== null ? (
            <>
              <span>رتبهٔ تو در این آزمون</span>
              <strong>{toPersianDigits(standing.rank)}</strong>
              <small>از {toPersianDigits(standing.participants)} شرکت‌کننده</small>
            </>
          ) : (
            <>
              <span>شرکت‌کننده‌ها تا الان</span>
              <strong>{toPersianDigits(standing.participants)}</strong>
              <small>رتبه وقتی دست‌کم {toPersianDigits(standing.minimumForRank)} نفر شرکت کنند نشان داده می‌شود</small>
            </>
          )}
        </div>
        <dl className="rp-facts">
          <div>
            <dt>درصد (با نمرهٔ منفی)</dt>
            <dd>{toPersianDigits(standing.konkurPercent.toFixed(1))}٪</dd>
          </div>
          {standing.percentile !== null && (
            <div>
              <dt>بهتر از</dt>
              <dd>{toPersianDigits(standing.percentile)}٪ شرکت‌کننده‌ها</dd>
            </div>
          )}
          {standing.taraz !== null && (
            <div>
              <dt>تراز در این آزمون</dt>
              <dd>{toPersianDigits(standing.taraz)}</dd>
            </div>
          )}
          {standing.average !== null && (
            <div>
              <dt>میانگین / بهترین</dt>
              <dd>
                {toPersianDigits(standing.average.toFixed(1))}٪ / {toPersianDigits((standing.best ?? 0).toFixed(1))}٪
              </dd>
            </div>
          )}
        </dl>
      </div>

      {standing.distribution.length > 0 && (
        <div className="rp-dist" role="img" aria-label="پراکندگی درصد شرکت‌کننده‌ها">
          {standing.distribution.map((bucket, index) => (
            <div className={`rp-dist-col${index === mine ? " rp-dist-mine" : ""}`} key={bucket.from}>
              <span className="rp-dist-bar">
                <span style={{ height: `${(bucket.count / tallest) * 100}%` }} />
              </span>
              <small>{toPersianDigits(bucket.from)}</small>
            </div>
          ))}
        </div>
      )}

      <p className="rp-note">
        {standing.isOfficial
          ? "رتبه با اولین شرکت هر نفر حساب می‌شود؛ تراز نسبت به همین شرکت‌کننده‌هاست، نه تراز رسمی سنجش."
          : "این شرکت دوبارهٔ توست؛ رتبهٔ رسمی تو همان اولین شرکت است و این عدد فقط جایگاه این بار را نشان می‌دهد."}
      </p>

      {recommended.length > 0 && (
        <div className="rp-next">
          <strong>برای قدم بعد</strong>
          <div className="rp-next-grid">
            {recommended.slice(0, 2).map((item) => (
              <Link key={item.course.slug} href={`/courses/${item.course.slug}`} className="rp-next-card">
                <span>{item.course.title}</span>
                {item.reasons[0] && <small>{item.reasons[0]}</small>}
                <b>{formatRial(item.price.amountRial)}</b>
              </Link>
            ))}
            <Link href="/free-videos" className="rp-next-card rp-next-free">
              <span>ویدیوی رایگان همین درس‌ها</span>
              <small>کلاس‌های ضبط‌شدهٔ دانشگاهی برای مرور مباحث</small>
              <b>رایگان</b>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
