import Link from "next/link";
import { ContentBlocks, InlineBlocks } from "../ContentBlocks";
import { StructuredData } from "../StructuredData";
import { apiGetPublic } from "../../lib/api";
import { examSetTitle } from "../../lib/admissions";
import { toPersianDigits } from "../../lib/format";
import { tidyQuestionBlocks } from "../../lib/question-text";
import { absoluteUrl } from "../../lib/seo";
import { SampleChoice } from "./SampleChoice";
import "./sample-questions.css";

type Block = { type: string; [key: string]: unknown };
type Asset = { media_key: string; checksum: string };

/** A public sample question as GET /questions/samples returns it: answer and solution included. */
export interface SampleQuestion {
  id: string;
  examYear: number;
  examCode: string | null;
  questionNumber: number | null;
  passage: { blocks: Block[] } | null;
  stemBlocks: Block[];
  options: { number: number; blocks: Block[] }[];
  assets: Asset[];
  correctOption: number;
  acceptedOptions: number[];
  solutionBlocks: Block[];
}

/** The subject's samples; none (or the API down) simply leaves the section out. */
export async function loadSamples(subjectCode: string): Promise<SampleQuestion[]> {
  try {
    return (await apiGetPublic<SampleQuestion[]>(`/questions/samples?subjectCode=${encodeURIComponent(subjectCode)}&limit=6`)) ?? [];
  } catch {
    return [];
  }
}

/** Blocks as plain text, for structured data. */
function plain(blocks: Block[]) {
  return blocks
    .map((block) => (typeof block.text === "string" ? block.text : typeof block.latex === "string" ? block.latex : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function accepted(question: SampleQuestion) {
  return question.acceptedOptions?.length ? question.acceptedOptions : [question.correctOption];
}

function source(question: SampleQuestion) {
  const set = examSetTitle(question.examCode);
  return `کنکور ارشد ${set || "کامپیوتر"} ${toPersianDigits(question.examYear)}${question.questionNumber ? `، سؤال ${toPersianDigits(question.questionNumber)}` : ""}`;
}

/**
 * Past konkur questions of this subject with their worked solutions: try
 * each one on the page, then read the solution. Rendered on the server
 * (formulas included); only option picking runs in the browser.
 */
export function SubjectSamples({ subjectSlug, subjectTitle, samples }: { subjectSlug: string; subjectTitle: string; samples: SampleQuestion[] }) {
  if (samples.length === 0) return null;
  const quiz = {
    "@context": "https://schema.org",
    "@type": "Quiz",
    name: `تست‌های کنکور ارشد ${subjectTitle} با پاسخ تشریحی`,
    about: { "@type": "Thing", name: subjectTitle },
    educationalAlignment: { "@type": "AlignmentObject", alignmentType: "educationalSubject", targetName: subjectTitle },
    inLanguage: "fa-IR",
    url: absoluteUrl(`/subjects/${subjectSlug}#tests`),
    hasPart: samples.map((question) => {
      const right = question.options.find((option) => option.number === question.correctOption);
      return {
        "@type": "Question",
        eduQuestionType: "Multiple choice",
        learningResourceType: "Practice problem",
        name: source(question),
        text: plain([...(question.passage?.blocks ?? []), ...question.stemBlocks]),
        suggestedAnswer: question.options
          .filter((option) => option.number !== question.correctOption)
          .map((option) => ({ "@type": "Answer", position: option.number - 1, text: plain(option.blocks) })),
        acceptedAnswer: {
          "@type": "Answer",
          position: question.correctOption - 1,
          text: right ? plain(right.blocks) : "",
          answerExplanation: { "@type": "Comment", text: plain(question.solutionBlocks) },
        },
      };
    }),
  };

  return (
    <section id="tests" className="rd-block sq-block" aria-labelledby="tests-title">
      <StructuredData data={[quiz]} />
      <div className="rd-block-head">
        <h2 id="tests-title">تست‌های کنکور {subjectTitle} با پاسخ تشریحی</h2>
        <p>
          {toPersianDigits(samples.length)} تست از کنکورهای ارشد سال‌های اخیر، مطابق سرفصل ۱۴۰۶. اول خودت جواب بده، بعد راه‌حل را بخوان.
        </p>
      </div>
      <ol className="sq-list">
        {samples.map((question, index) => (
          <li key={question.id} className="sq-card">
            <header className="sq-head">
              <span className="sq-index">{toPersianDigits(index + 1)}</span>
              <span className="sq-source">{source(question)}</span>
              <Link href={`/questions/${question.id}`} className="sq-link">صفحهٔ تست</Link>
            </header>
            {question.passage && (
              <div className="sq-passage">
                <ContentBlocks blocks={tidyQuestionBlocks(question.passage.blocks)} assets={question.assets} />
              </div>
            )}
            <div className="sq-stem">
              <ContentBlocks blocks={tidyQuestionBlocks(question.stemBlocks)} assets={question.assets} />
            </div>
            <SampleChoice
              accepted={accepted(question)}
              options={question.options.map((option) => ({
                number: option.number,
                content: <InlineBlocks blocks={option.blocks} assets={question.assets} />,
              }))}
              solution={
                <div className="sq-solution-body">
                  <p className="sq-answer">پاسخ: گزینهٔ {accepted(question).map((n) => toPersianDigits(n)).join(" یا ")}</p>
                  <ContentBlocks blocks={question.solutionBlocks} assets={question.assets} />
                </div>
              }
            />
          </li>
        ))}
      </ol>
      <div className="sq-more">
        <Link href={`/questions?subject=${encodeURIComponent(subjectSlug)}`} className="sq-more-primary">همهٔ تست‌های {subjectTitle} در بانک سؤال ←</Link>
        <Link href="/exams">شبیه‌ساز کنکورهای سال‌های قبل</Link>
      </div>
    </section>
  );
}
