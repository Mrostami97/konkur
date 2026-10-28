import { notFound } from "next/navigation";
import { subjects } from "../../../../content/editorial";
import { SYLLABUS } from "../../../../lib/syllabus";
import { SubjectBank, type ChapterStats } from "./SubjectBank";
import { apiGetPublic } from "../../../../lib/api";
import { readingByChapter, solutionArticles, type ListedArticle } from "../../../../content/article-topics";
import { pageMetadata } from "../../../../lib/seo";
import "../../questions.css";

export function generateStaticParams() {
  return subjects.filter((subject) => SYLLABUS[subject.slug]).map((subject) => ({ subject: subject.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const title = subjects.find((item) => item.slug === subject)?.title;
  if (!title) return { title: "بانک سؤال" };
  return {
    ...pageMetadata({
      title: `تست‌های کنکور ارشد و دکتری ${title} فصل‌به‌فصل`,
      description: `تست‌های کنکور ارشد و دکتری ${title} به ترتیب فصل‌های سرفصل ۱۴۰۶، با تعداد تست هر فصل، تمرین تست‌به‌تست و آزمون زمان‌دار.`,
      path: `/questions/subjects/${subject}`,
    }),
    robots: { index: true, follow: true },
  };
}

/** Server shell: one subject's 1406 chapters and topics, for the chapter-by-chapter bank. */
export default async function SubjectBankPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: code } = await params;
  const subject = subjects.find((item) => item.slug === code);
  if (!subject || !SYLLABUS[code]) notFound();
  // Counts are rendered on the server so search engines see them; the student's progress loads in the browser.
  let stats: ChapterStats | null = null;
  try {
    stats = await apiGetPublic<ChapterStats>(`/questions/chapter-stats?subjectCode=${encodeURIComponent(code)}`, { revalidate: 600 });
  } catch {
    stats = null;
  }
  // What to read for each chapter: the lesson notes and topic-test articles that teach its topics.
  let articles: ListedArticle[] = [];
  try {
    const listed = await apiGetPublic<ListedArticle[] | { items: ListedArticle[] }>("/articles?pageSize=200", { revalidate: 600 });
    articles = Array.isArray(listed) ? listed : listed?.items ?? [];
  } catch {
    articles = [];
  }
  return (
    <SubjectBank
      code={code}
      title={subject.title}
      chapters={SYLLABUS[code]}
      initialStats={stats}
      reading={readingByChapter(articles, SYLLABUS[code])}
      solutions={solutionArticles(articles, code)}
    />
  );
}
