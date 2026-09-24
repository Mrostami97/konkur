import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon } from "../../components/ComingSoon";
import { apiGetPublic } from "../../lib/api";
import { pageMetadata } from "../../lib/seo";
import { formatPersianNumber, formatRial } from "../../lib/format";
import { BuyButton } from "../../components/BuyButton";

interface Offering {
  id: string;
  kind: "SINGLE_SESSION" | "PACKAGE";
  sessionQuota: number;
  durationMinutes: number;
  validUntil: string | null;
  headline: string;
  description: string;
  instructorProfile: {
    slug: string;
    displayName: string;
    roleTitle: string | null;
    avatarUrl: string | null;
  };
  productId: string;
  amountRial: number | null;
}

async function loadOfferings() {
  try {
    return await apiGetPublic<Offering[]>("/consultations");
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const offerings = await loadOfferings();
  return pageMetadata({
    title: "مشاورهٔ کنکور ارشد و دکتری کامپیوتر",
    description:
      "رزرو مشاورهٔ تک‌جلسه‌ای یا بستهٔ سالیانه تا کنکور با مدرسان کنکورصفریک. زمان جلسه را با خود مدرس هماهنگ می‌کنید.",
    path: "/consultations",
    // An empty or unreachable catalogue is a thin page; keep it out of the
    // index until there is something real on it.
    noIndex: offerings === null || offerings.length === 0,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });
}

export default async function ConsultationsPage() {
  const offerings = await loadOfferings();

  return (
    <>
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">مشاوره</p>
          <h1>مشاوره با مدرسان کنکورصفریک</h1>
          <p className="pg-lede">
            مشاوره یا تک‌جلسه‌ای است یا بسته‌ای که تا تاریخ کنکور ادامه دارد. بعد از خرید چند زمان پیشنهاد
            می‌دهید و مدرس یکی را تأیید می‌کند؛ اگر زمانِ تعیین‌شده به شما نخورد می‌توانید لغو کنید و جلسه به
            سهمیه‌تان برمی‌گردد.
          </p>
        </div>
      </div>

      <section className="pg-shell pg-sec" aria-labelledby="offerings-title">
        <div className="pg-head">
          <h2 id="offerings-title">مشاوره‌های قابل رزرو</h2>
          <Link href="/instructors">همهٔ مدرسان ←</Link>
        </div>

        {offerings === null ? (
          <p className="pg-eyebrow">فهرست مشاوره‌ها در دسترس نیست. کمی بعد دوباره امتحان کنید.</p>
        ) : offerings.length === 0 ? (
          <ComingSoon
            icon="chat"
            title="رزرو آنلاین مشاوره به‌زودی"
            text="مشاورهٔ تک‌جلسه‌ای و بستهٔ سالیانه تا کنکور به‌زودی از همین صفحه قابل خرید و رزرو است. زمان راه‌اندازی در کانال تلگرام اعلام می‌شود."
            alternatives={[
              { href: "/articles/study-plan-from-zero", label: "شروع از صفر" },
              { href: "/guides/twelve-month-study-plan", label: "برنامهٔ دوازده‌ماهه" },
              { href: "/guides/working-candidate-study-plan", label: "برنامهٔ داوطلب شاغل" },
            ]}
          />
        ) : (
          <div className="pg-grid pg-grid-wide">
            {offerings.map((offering) => (
              <article className="pg-card" key={offering.id}>
                <span className="pg-badge">
                  {offering.kind === "PACKAGE" ? "بستهٔ مشاوره" : "مشاورهٔ تک‌جلسه‌ای"}
                </span>
                <h3>{offering.headline}</h3>
                <span className="pg-card-meta">
                  {offering.instructorProfile.displayName}
                  {offering.instructorProfile.roleTitle ? ` — ${offering.instructorProfile.roleTitle}` : ""}
                </span>
                <p>{offering.description}</p>

                <span className="pg-card-meta">
                  {formatPersianNumber(offering.sessionQuota)} جلسهٔ{" "}
                  {formatPersianNumber(offering.durationMinutes)} دقیقه‌ای
                  {offering.validUntil ? ` · اعتبار تا ${formatDate(offering.validUntil)}` : ""}
                </span>

                {offering.amountRial !== null && (
                  <p className="pg-price">{formatRial(offering.amountRial)}</p>
                )}

                <div className="pg-card-action">
                  <BuyButton productId={offering.productId} label="ثبت سفارش و پرداخت" />
                  <p className="pg-card-meta" style={{ marginTop: "var(--sp-2)" }}>
                    <Link href={`/authors/${offering.instructorProfile.slug}`}>دربارهٔ مدرس</Link>
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
