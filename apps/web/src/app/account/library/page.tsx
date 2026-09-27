"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Glyph } from "../../../components/SubjectIcon";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { AccountShell } from "../AccountShell";
import { faDate, READABLE_HOSTING, RESOURCE_KIND_LABEL, type Library } from "../data";

/**
 * Everything the student has bought that is not a course: handouts, booklets
 * and question-bank access. A handout the site keeps as a file opens in the
 * panel's reader as the student's own stamped copy; anything else opens its
 * resource page.
 */
export default function LibraryPage() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch<Library>("/me/library")
      .then(setLibrary)
      .catch(() => setFailed(true));
  }, []);

  return (
    <AccountShell
      title="جزوه‌ها و منابع من"
      subtitle="هر جزوه یا منبعی که خریده‌ای، بلافاصله بعد از تأیید پرداخت اینجا اضافه می‌شود."
      action={<Link href="/resources" className="st-btn st-btn-soft">فهرست منابع</Link>}
    >
      {failed ? (
        <p className="st-alert st-alert-danger">کتابخانه الان بارگذاری نشد. صفحه را دوباره باز کن.</p>
      ) : !library ? (
        <div className="st-course-grid" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => <div className="st-skel st-skel-card-lg" key={index} />)}
        </div>
      ) : (
        <>
          {library.allAccess && (
            <p className="st-alert st-alert-success">
              طرح سالانهٔ مشاوره‌ات فعال است: همهٔ دوره‌ها، جزوه‌ها و بانک سؤال همهٔ درس‌ها برایت باز است، حتی آن‌هایی که بعداً اضافه می‌شوند.
            </p>
          )}
          {library.resources.length === 0 ? (
            <div className="st-card">
              <div className="st-empty st-empty-lg">
                <span className="st-empty-icon"><Glyph name="book" /></span>
                <strong>هنوز جزوه‌ای نخریده‌ای</strong>
                <p>جزوه‌ها و منابع پولی را از فهرست منابع ببین؛ بعد از خرید، اینجا و روی داشبوردت می‌آیند.</p>
                <Link href="/resources" className="st-btn st-btn-primary">دیدن منابع</Link>
              </div>
            </div>
          ) : (
            <div className="st-library">
              {library.resources.map((resource) => (
                <Link
                  key={resource.id}
                  href={READABLE_HOSTING.has(resource.hostingMode) ? `/account/library/${resource.slug}` : `/resources/${resource.slug}`}
                  className="st-doc"
                >
                  <span className="st-doc-icon">
                    <Glyph name={resource.kind === "VIDEO" ? "play" : "book"} />
                  </span>
                  <span className="st-doc-body">
                    <span className="st-badge st-badge-info">{RESOURCE_KIND_LABEL[resource.kind] ?? "منبع"}</span>
                    <strong>{resource.title}</strong>
                    {resource.summary && <small className="st-doc-summary">{resource.summary}</small>}
                    <small>{resource.course ? `همراه دورهٔ ${resource.course.title}` : `تهیه‌شده در ${faDate(resource.acquiredAt)}`}</small>
                  </span>
                  <span className="st-doc-open">{READABLE_HOSTING.has(resource.hostingMode) ? "مطالعه ←" : "مشاهده ←"}</span>
                </Link>
              ))}
            </div>
          )}

          {library.questionBankSubjects.length > 0 && (
            <section className="st-card">
              <header className="st-card-head">
                <h2>
                  <span className="st-card-icon"><Glyph name="list" /></span>
                  بانک سؤال فعال
                </h2>
                <Link href="/questions" className="st-link">بانک سؤال ←</Link>
              </header>
              <p className="st-card-lead">
                دسترسی کامل به سؤال‌های {toPersianDigits(library.questionBankSubjects.length)} درس، همراه با پاسخ و راه‌حل.
              </p>
              <div className="st-chips">
                {library.questionBankSubjects.map((code) => (
                  <span key={code} className="st-chip st-chip-accent" dir="ltr">{code}</span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AccountShell>
  );
}
