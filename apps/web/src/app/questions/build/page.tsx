import { subjects } from "../../../content/editorial";
import { SYLLABUS } from "../../../lib/syllabus";
import { ExamBuilder } from "./ExamBuilder";
import "../questions.css";

export const metadata = { title: "آزمون‌ساز مبحثی" };

/** Server shell: the 1406 subjects that have a syllabus tree, with their Persian names. */
export default async function ExamBuilderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const catalog = subjects.filter((subject) => SYLLABUS[subject.slug]).map((subject) => ({ code: subject.slug, title: subject.title }));
  // A chapter page links here with its subject already chosen.
  const asked = (await searchParams).subject;
  const initialSubject = typeof asked === "string" && catalog.some((item) => item.code === asked) ? asked : undefined;
  return <ExamBuilder catalog={catalog} initialSubject={initialSubject} />;
}
