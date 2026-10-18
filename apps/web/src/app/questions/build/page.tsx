import { subjects } from "../../../content/editorial";
import { SYLLABUS } from "../../../lib/syllabus";
import { ExamBuilder } from "./ExamBuilder";
import "../questions.css";

export const metadata = { title: "آزمون‌ساز مبحثی" };

/** Server shell: the 1406 subjects that have a syllabus tree, with their Persian names. */
export default function ExamBuilderPage() {
  const catalog = subjects.filter((subject) => SYLLABUS[subject.slug]).map((subject) => ({ code: subject.slug, title: subject.title }));
  return <ExamBuilder catalog={catalog} />;
}
