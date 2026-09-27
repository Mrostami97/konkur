import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon } from "../../components/ComingSoon";
import { apiGetPublic } from "../../lib/api";
import { pageMetadata } from "../../lib/seo";

interface Instructor {
  id: string;
  slug: string;
  displayName: string;
  roleTitle: string | null;
  shortBio: string | null;
  avatarUrl: string | null;
  thesisUrl: string | null;
  courses: { slug: string; title: string }[];
}

async function loadInstructors() {
  try {
    return await apiGetPublic<Instructor[]>("/instructors");
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const instructors = await loadInstructors();
  return pageMetadata({
    title: "مدرسان کنکور کامپیوتر",
    description:
      "مدرسان دوره‌های کنکور ارشد و دکتری کامپیوتر: سوابق، دوره‌هایی که تدریس می‌کنند و امکان رزرو مشاوره.",
    path: "/instructors",
    noIndex: instructors === null || instructors.length === 0,
  });
}

export default async function InstructorsPage() {
  const instructors = await loadInstructors();

  return (
    <>
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">مدرسان</p>
          <h1>چه کسی این دوره‌ها را تدریس می‌کند</h1>
          <p className="pg-lede">
            هر مدرس صفحهٔ خودش را دارد: سوابق، پایان‌نامه، دوره‌هایی که تدریس می‌کند و مشاوره‌هایی که ارائه
            می‌دهد.
          </p>
        </div>
      </div>

      <section className="pg-shell pg-sec" aria-labelledby="instructors-title">
        <div className="pg-head">
          <h2 id="instructors-title">فهرست مدرسان</h2>
          <Link href="/consultations">رزرو مشاوره ←</Link>
        </div>

        {instructors === null ? (
          <p className="pg-eyebrow">فهرست مدرسان در دسترس نیست. کمی بعد دوباره امتحان کنید.</p>
        ) : instructors.length === 0 ? (
          <ComingSoon
            icon="building"
            title="صفحهٔ مدرسان به‌زودی"
            text="هر مدرس با انتشار اولین دوره‌اش صفحهٔ خودش را می‌گیرد: سوابق، دوره‌ها و مشاوره‌ها. تا آن موقع، سوابق تدریس و نتایج کلاس‌ها را در مستندات ببین."
            alternatives={[
              { href: "/about", label: "دربارهٔ محمد رستمی" },
              { href: "/evidence", label: "مستندات تدریس" },
              { href: "/subjects", label: "نقشهٔ درس‌ها" },
            ]}
          />
        ) : (
          <div className="pg-grid pg-grid-wide">
            {instructors.map((instructor) => (
              <Link className="pg-card" href={`/authors/${instructor.slug}`} key={instructor.id}>
                <h3>{instructor.displayName}</h3>
                {instructor.roleTitle && <span className="pg-card-meta">{instructor.roleTitle}</span>}
                {instructor.shortBio && <p>{instructor.shortBio}</p>}
                <span className="pg-card-meta">
                  {instructor.courses.map((course) => course.title).join("، ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
