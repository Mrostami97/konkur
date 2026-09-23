import Link from "next/link";
import { Glyph, type GlyphName } from "../SubjectIcon";

/** Where a reader of an article or guide can go next, from the subject it is about. */
export function readingNextSteps(subject?: { slug: string; shortTitle: string }): NextStep[] {
  return [
    subject
      ? { href: `/subjects/${subject.slug}`, icon: "book", title: `صفحهٔ درس ${subject.shortTitle}`, text: "سرفصل، جایگاه در کنکور ۱۴۰۶ و مسیر شروع", tone: "teal" }
      : { href: "/subjects", icon: "book", title: "نقشهٔ درس‌ها", text: "ضریب، پیش‌نیاز و سرفصل هر درس", tone: "teal" },
    { href: "/free-videos", icon: "play", title: "ویدیوی رایگان هر درس", text: "کلاس‌های ضبط‌شدهٔ دانشگاهی برای شروع", tone: "blue" },
    { href: "/courses", icon: "trophy", title: "دوره‌های کنکوری", text: "کلاس کامل درس‌به‌درس تا تست کنکور", tone: "violet" },
    { href: "/consultations", icon: "chat", title: "مشاوره با مدرس", text: "برنامهٔ هفتگی شخصی و رفع اشکال", tone: "amber" },
  ];
}

export interface NextStep {
  href: string;
  icon: GlyphName;
  title: string;
  text: string;
  /** A publisher's page, opened in a new tab. */
  external?: boolean;
  tone?: "teal" | "blue" | "violet" | "amber";
}

/**
 * Where a reader goes after the last paragraph: the free video, the course,
 * a practice exam or a consultation for what they just read about. A page
 * that ends on its sources leaves the reader nowhere to go.
 */
export function NextSteps({ title = "قدم بعدی تو", lead, steps }: { title?: string; lead?: string; steps: NextStep[] }) {
  if (steps.length === 0) return null;
  return (
    <section className="rd-next" aria-labelledby="rd-next-title">
      <div className="rd-next-head">
        <h2 id="rd-next-title">{title}</h2>
        {lead && <p>{lead}</p>}
      </div>
      <div className="rd-next-grid">
        {steps.map((step) => {
          const body = (
            <>
              <span className="rd-next-icon"><Glyph name={step.icon} /></span>
              <strong>{step.title}</strong>
              <small>{step.text}</small>
              <span className="rd-next-go">{step.external ? "رفتن به صفحهٔ درس ↗" : "شروع ←"}</span>
            </>
          );
          const className = `rd-next-card rd-next-${step.tone ?? "blue"}`;
          return step.external ? (
            <a key={step.href} href={step.href} className={className} target="_blank" rel="noopener noreferrer">{body}</a>
          ) : (
            <Link key={step.href} href={step.href} className={className}>{body}</Link>
          );
        })}
      </div>
    </section>
  );
}
