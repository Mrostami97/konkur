import { subjects } from "../../../content/editorial";
import { SYLLABUS } from "../../../lib/syllabus";
import { SubjectsIndex, type BankCounts } from "./SubjectsIndex";
import { apiGetPublic } from "../../../lib/api";
import { pageMetadata } from "../../../lib/seo";
import "../questions.css";

// The rest of /questions stays private (layout.tsx); this index is public, so it says so explicitly.
export const metadata = {
  ...pageMetadata({
    title: "بانک سؤال کنکور ارشد کامپیوتر فصل‌به‌فصل",
    description: "تست‌های کنکور ارشد کامپیوتر به تفکیک درس و فصل‌های سرفصل ۱۴۰۶، با تعداد تست هر فصل و پاسخ تشریحی.",
    path: "/questions/subjects",
  }),
  robots: { index: true, follow: true },
};

/** Server shell: every 1406 subject with a syllabus tree, and how many chapters it has. */
export default async function SubjectsIndexPage() {
  const catalog = subjects
    .filter((subject) => SYLLABUS[subject.slug])
    .map((subject) => ({ code: subject.slug, title: subject.title, chapters: SYLLABUS[subject.slug].filter((c) => !c.offSyllabus).length }));
  // Counts on the server, so search engines see them; the student's progress loads in the browser.
  let counts: BankCounts | null = null;
  try {
    counts = await apiGetPublic<BankCounts>("/questions/counts", { revalidate: 600 });
  } catch {
    counts = null;
  }
  return <SubjectsIndex catalog={catalog} initialCounts={counts} />;
}
