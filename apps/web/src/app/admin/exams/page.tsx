import { subjects } from "../../../content/editorial";
import { ExamsAdmin } from "./ExamsAdmin";

/** Server shell: hands the client the subject names, not the editorial corpus. */
export default function AdminExamsPage() {
  return <ExamsAdmin subjects={subjects.map((subject) => ({ code: subject.slug, title: subject.title }))} />;
}
