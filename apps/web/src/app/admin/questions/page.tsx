import { subjects } from "../../../content/editorial";
import { QuestionsAdmin } from "./QuestionsAdmin";

/** Server shell: hands the client the subject names, not the editorial corpus. */
export default function AdminQuestionsPage() {
  return <QuestionsAdmin subjects={subjects.map((subject) => ({ code: subject.slug, title: subject.title }))} />;
}
