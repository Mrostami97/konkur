"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DocumentReader } from "../../../../components/DocumentReader";
import type { PublicResourceRecord } from "../../../../components/PublicContent";
import { apiFetch, ApiError } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
import { AccountShell } from "../../AccountShell";
import { READABLE_HOSTING } from "../../data";
import { studentName, useStudent } from "../../student-context";

/**
 * A handout read inside the student panel. Whether this student may read it
 * is the resource's own answer (bought, or open to members); the file itself
 * is fetched by the reader, which receives a copy stamped with this
 * student's name and number.
 */
/**
 * On a free sample (e.g. the first chapters): which paid handout it comes
 * from, and the way to get all of it -- once above the reader and again
 * after the last page.
 */
function SampleCta({ resource, end = false }: { resource: PublicResourceRecord; end?: boolean }) {
  const paid = resource.sampleFor ?? [];
  if (paid.length === 0) return null;
  return (
    <div className="st-sample-cta" data-end={end || undefined}>
      <p>
        {end ? "نمونه تمام شد. " : "این نمونهٔ رایگان است. "}
        جزوهٔ کامل: <b>{paid[0].title}</b>
      </p>
      <Link href={`/resources/${paid[0].slug}`} className="st-btn st-btn-primary">
        {end ? "تهیهٔ جزوهٔ کامل" : "دیدن جزوهٔ کامل"}
      </Link>
    </div>
  );
}

export default function LibraryReaderPage({ params }: { params: { slug: string } }) {
  const { me, profile } = useStudent();
  const [resource, setResource] = useState<PublicResourceRecord | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch<PublicResourceRecord>(`/resources/${encodeURIComponent(params.slug)}`)
      .then(setResource)
      .catch((error) => (error instanceof ApiError && error.status === 404 ? setResource(null) : setFailed(true)));
  }, [params.slug]);

  const identity = `${profile ? studentName(profile) : ""} · ${toPersianDigits(me?.user.phone ?? "")}`;

  return (
    <AccountShell
      title={resource?.title ?? "جزوه"}
      subtitle="نسخهٔ شخصی تو، با نام و شماره‌ات روی هر صفحه؛ فقط همین‌جا خوانده می‌شود."
      action={<Link href="/account/library" className="st-btn st-btn-soft">همهٔ جزوه‌ها</Link>}
    >
      {failed ? (
        <p className="st-alert st-alert-danger">جزوه الان بارگذاری نشد. صفحه را دوباره باز کن.</p>
      ) : resource === undefined ? (
        <div className="st-skel st-skel-card-lg" aria-busy="true" />
      ) : resource === null ? (
        <div className="st-card">
          <div className="st-empty st-empty-lg">
            <strong>این جزوه پیدا نشد</strong>
            <Link href="/account/library" className="st-btn st-btn-primary">جزوه‌ها و منابع من</Link>
          </div>
        </div>
      ) : !resource.canAccess ? (
        <div className="st-card">
          <div className="st-empty st-empty-lg">
            <strong>این جزوه هنوز برای تو باز نشده</strong>
            <p>اگر خریده‌ای و پرداختت هنوز تأیید نشده، بعد از تأیید همین‌جا باز می‌شود.</p>
            <Link href={`/resources/${resource.slug}`} className="st-btn st-btn-primary">صفحهٔ جزوه</Link>
          </div>
        </div>
      ) : !READABLE_HOSTING.has(resource.hostingMode) ? (
        <div className="st-card">
          <div className="st-empty st-empty-lg">
            <strong>این منبع فایل قابل خواندن ندارد</strong>
            <Link href={`/resources/${resource.slug}`} className="st-btn st-btn-primary">صفحهٔ منبع</Link>
          </div>
        </div>
      ) : (
        <>
          <SampleCta resource={resource} />
          <DocumentReader slug={resource.slug} identity={identity} />
          <SampleCta resource={resource} end />
        </>
      )}
    </AccountShell>
  );
}
