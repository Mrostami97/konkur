import { subjects } from "../../../../content/editorial";
import { ReviewQueue } from "./ReviewQueue";

/** Server shell: hands the client the subject names it shows. */
export default function AdminQuestionReviewPage() {
  return <ReviewQueue subjects={subjects.map((subject) => ({ code: subject.slug, title: subject.title }))} />;
}
