import { notFound } from "next/navigation";
import { subjects } from "../../../../content/editorial";
import { SYLLABUS } from "../../../../lib/syllabus";
import { SubjectBank } from "./SubjectBank";
import { pageMetadata } from "../../../../lib/seo";
import "../../questions.css";

export function generateStaticParams() {
  return subjects.filter((subject) => SYLLABUS[subject.slug]).map((subject) => ({ subject: subject.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const title = subjects.find((item) => item.slug === subject)?.title;
  if (!title) return { title: "بانک سؤال" };
  return {
    ...pageMetadata({
      title: `تست‌های کنکور ارشد ${title} فصل‌به‌فصل`,
      description: `تست‌های کنکور ارشد ${title} به ترتیب فصل‌های سرفصل ۱۴۰۶، با تعداد تست هر فصل، تمرین تست‌به‌تست و آزمون زمان‌دار.`,
      path: `/questions/subjects/${subject}`,
    }),
    robots: { index: true, follow: true },
  };
}

/** Server shell: one subject's 1406 chapters and topics, for the chapter-by-chapter bank. */
export default async function SubjectBankPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: code } = await params;
  const subject = subjects.find((item) => item.slug === code);
  if (!subject || !SYLLABUS[code]) notFound();
  return <SubjectBank code={code} title={subject.title} chapters={SYLLABUS[code]} />;
}
