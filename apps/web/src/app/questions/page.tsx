import { subjects } from "../../content/editorial";
import { QuestionBank } from "./QuestionBank";
import "./questions.css";

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * Server shell: resolves the Persian subject names here so the client bundle
 * carries a small list of names, not the whole editorial corpus. A link with
 * `?subject=`, `&chapter=`, `&topic=`, `&year=` or `&track=` (from a question
 * page, or a shared filtered bank) opens the bank already filtered.
 */
export default async function QuestionBankPage({ searchParams: pendingSearchParams }: { searchParams: Promise<Params> }) {
  const searchParams = await pendingSearchParams;
  const catalog = subjects.map((subject) => ({ code: subject.slug, title: subject.title }));
  return (
    <QuestionBank
      catalog={catalog}
      initial={{
        subjectCode: one(searchParams.subject),
        chapter: one(searchParams.chapter),
        topic: one(searchParams.topic),
        examYear: one(searchParams.year),
        examMajor: one(searchParams.track),
        collection: one(searchParams.collection),
      }}
    />
  );
}
