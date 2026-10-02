import { subjects } from "../../content/editorial";
import { QuestionBank } from "./QuestionBank";
import "./questions.css";

/**
 * Server shell: resolves the Persian subject names here so the client bundle
 * carries a small list of names, not the whole editorial corpus. A
 * `?subject=` link (from a question page) opens the bank already filtered.
 */
export default async function QuestionBankPage({ searchParams: pendingSearchParams }: { searchParams: Promise<{ subject?: string | string[] }> }) {
  const searchParams = await pendingSearchParams;
  const catalog = subjects.map((subject) => ({ code: subject.slug, title: subject.title }));
  const requested = Array.isArray(searchParams.subject) ? searchParams.subject[0] : searchParams.subject;
  return <QuestionBank catalog={catalog} initialSubject={requested ?? ""} />;
}
