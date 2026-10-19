import { subjects } from "../../content/editorial";
import { readingByChapter, type ListedArticle, type ReadingLink } from "../../content/article-topics";
import { apiGetPublic } from "../../lib/api";
import { SYLLABUS } from "../../lib/syllabus";
import { QuestionBank } from "./QuestionBank";
import "./questions.css";

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** What to read for every syllabus chapter: lesson notes first, then topic-test articles. */
async function chapterReading(): Promise<Record<string, ReadingLink[]>> {
  try {
    const listed = await apiGetPublic<ListedArticle[] | { items: ListedArticle[] }>("/articles?pageSize=200", { revalidate: 600 });
    const articles = Array.isArray(listed) ? listed : listed?.items ?? [];
    return readingByChapter(articles, Object.values(SYLLABUS).flat());
  } catch {
    return {};
  }
}

/**
 * Server shell: resolves the Persian subject names here so the client bundle
 * carries a small list of names, not the whole editorial corpus. A link with
 * `?subject=`, `&chapter=`, `&topic=`, `&year=`, `&track=`, `&solved=1`, `&sample=1`,
 * `&set=today` or `&page=` (from a question page, or a shared filtered bank) opens the bank
 * already filtered.
 */
export default async function QuestionBankPage({ searchParams: pendingSearchParams }: { searchParams: Promise<Params> }) {
  const searchParams = await pendingSearchParams;
  const catalog = subjects.map((subject) => ({ code: subject.slug, title: subject.title }));
  const page = Number.parseInt(one(searchParams.page), 10);
  return (
    <QuestionBank
      catalog={catalog}
      reading={await chapterReading()}
      initialPage={Number.isFinite(page) && page > 0 ? page : 1}
      initial={{
        subjectCode: one(searchParams.subject),
        chapter: one(searchParams.chapter),
        topic: one(searchParams.topic),
        examYear: one(searchParams.year),
        examMajor: one(searchParams.track),
        collection: one(searchParams.collection),
        solved: one(searchParams.solved) ? "1" : "",
        sample: one(searchParams.sample) ? "1" : "",
        set: one(searchParams.set) === "today" ? "today" : "",
      }}
    />
  );
}
