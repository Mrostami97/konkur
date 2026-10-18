import { notFound } from "next/navigation";
import { subjects } from "../../../../content/editorial";
import { SYLLABUS } from "../../../../lib/syllabus";
import { SubjectBank } from "./SubjectBank";
import "../../questions.css";

export function generateStaticParams() {
  return subjects.filter((subject) => SYLLABUS[subject.slug]).map((subject) => ({ subject: subject.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const title = subjects.find((item) => item.slug === subject)?.title;
  return { title: title ? `بانک سؤال ${title} فصل‌به‌فصل` : "بانک سؤال" };
}

/** Server shell: one subject's 1406 chapters and topics, for the chapter-by-chapter bank. */
export default async function SubjectBankPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: code } = await params;
  const subject = subjects.find((item) => item.slug === code);
  if (!subject || !SYLLABUS[code]) notFound();
  return <SubjectBank code={code} title={subject.title} chapters={SYLLABUS[code]} />;
}
