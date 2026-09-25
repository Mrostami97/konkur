import { subjects } from "../../../content/editorial";
import { QuestionView } from "./QuestionView";
import "../questions.css";

/** Server shell: hands the client view the Persian subject names it shows. */
export default function QuestionDetailPage({ params }: { params: { id: string } }) {
  const subjectTitles = Object.fromEntries(subjects.map((subject) => [subject.slug, subject.title]));
  return <QuestionView id={params.id} subjectTitles={subjectTitles} />;
}
