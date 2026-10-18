import { subjects } from "../../../content/editorial";
import { SYLLABUS } from "../../../lib/syllabus";
import { SubjectsIndex } from "./SubjectsIndex";
import "../questions.css";

export const metadata = { title: "بانک سؤال فصل‌به‌فصل" };

/** Server shell: every 1406 subject with a syllabus tree, and how many chapters it has. */
export default function SubjectsIndexPage() {
  const catalog = subjects
    .filter((subject) => SYLLABUS[subject.slug])
    .map((subject) => ({ code: subject.slug, title: subject.title, chapters: SYLLABUS[subject.slug].filter((c) => !c.offSyllabus).length }));
  return <SubjectsIndex catalog={catalog} />;
}
