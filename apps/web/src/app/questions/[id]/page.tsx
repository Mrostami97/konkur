import { subjects } from "../../../content/editorial";
import { QuestionView } from "./QuestionView";
import "../questions.css";

/** Server shell: hands the client view the Persian subject names it shows. */
export default async function QuestionDetailPage({ params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = await pendingParams;
  const subjectTitles = Object.fromEntries(subjects.map((subject) => [subject.slug, subject.title]));
  return <QuestionView key={params.id} id={params.id} subjectTitles={subjectTitles} />;
}
