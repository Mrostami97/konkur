import { subjects } from "../../content/editorial";
import { RankEstimate } from "./RankEstimate";
import "./rank-estimate.css";

/** Server shell: the subject names for the dropdowns, without the corpus. */
export default function RankEstimatePage() {
  return <RankEstimate subjects={subjects.map((subject) => ({ code: subject.slug, title: subject.title }))} />;
}
