import katex from "katex";
import { Fragment } from "react";
import type { AnswerSheetRebuild, EvidenceRebuild, MessageRebuild, QuestionsRebuild, ScorecardRebuild, ScoreValue } from "../content/evidence-rebuilds";
import { toPersianDigits } from "../lib/format";

const fa = (value: number) => value.toLocaleString("fa-IR", { maximumFractionDigits: 2, useGrouping: false });

/** Text with inline $…$ math, rendered on the server. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const html = katex.renderToString(part.slice(1, -1), { throwOnError: false, output: "html" });
          return <bdi className="rb-math" dir="ltr" key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

function Percent({ value }: { value: ScoreValue }) {
  if (value === "سفید") return <b className="rb-blank">سفید</b>;
  return <b>{fa(value)}٪</b>;
}

function Scorecard({ rebuild }: { rebuild: ScorecardRebuild }) {
  const best = rebuild.codes?.length ? Math.min(...rebuild.codes.map((row) => row.rank)) : null;
  const codeWord = rebuild.codeWord ?? "کد ضریب";
  return (
    <figure className="rb rb-card">
      <header className="rb-card-head">
        <span className="rb-card-tag">کارنامه</span>
        <b>{rebuild.exam}</b>
        {rebuild.attendees && <small>بین {toPersianDigits(rebuild.attendees)} نفر حاضر در جلسه</small>}
      </header>

      {rebuild.subjects && (
        <div className="rb-subjects" aria-label="درصد درس‌ها">
          {rebuild.subjects.map((subject) => (
            <div className={subject.percent === 100 ? "rb-subject rb-subject-full" : "rb-subject"} key={subject.name}>
              <span>{subject.name}</span>
              <Percent value={subject.percent} />
              <i aria-hidden="true">
                {subject.percent !== "سفید" && <em style={{ inlineSize: `${Math.max(subject.percent, 1.5)}%` }} />}
              </i>
            </div>
          ))}
        </div>
      )}

      {rebuild.codes && (
        <div className="rb-codes" aria-label={`رتبه در هر ${codeWord}`}>
          {rebuild.codes.map((row) => (
            <div className={row.rank === best ? "rb-code rb-code-best" : "rb-code"} key={row.code}>
              <span className="rb-code-name">
                {codeWord} {toPersianDigits(row.code)}
                {row.label && <em>{row.label}</em>}
              </span>
              <b>
                <small>رتبهٔ</small>
                {toPersianDigits(row.rank)}
              </b>
              <span className="rb-code-meta">
                در سهمیه
                {row.rankNoQuota && <> · بدون سهمیه {toPersianDigits(row.rankNoQuota)}</>}
              </span>
              {row.score !== undefined && <span className="rb-code-meta">نمرهٔ کل {toPersianDigits(row.score)}</span>}
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}

type Verdict = "correct" | "wrong" | "blank" | "void";

function verdictOf(row: AnswerSheetRebuild["rows"][number]): Verdict {
  if (row.key === "حذف") return "void";
  if (row.answer === "سفید") return "blank";
  return row.answer === row.key ? "correct" : "wrong";
}

const VERDICT_LABEL: Record<Verdict, string> = { correct: "درست", wrong: "غلط", blank: "سفید", void: "حذف‌شده" };

function AnswerSheet({ rebuild }: { rebuild: AnswerSheetRebuild }) {
  const verdicts = rebuild.rows.map(verdictOf);
  const count = (verdict: Verdict) => verdicts.filter((row) => row === verdict).length;
  return (
    <figure className="rb rb-sheet">
      <header className="rb-sheet-head">
        <b>پاسخ‌برگ · {rebuild.section}</b>
        <span className="rb-tally">
          {(["correct", "wrong", "blank", "void"] as Verdict[]).map((verdict) =>
            count(verdict) > 0 ? (
              <span className={`rb-tally-${verdict}`} key={verdict}>
                {toPersianDigits(count(verdict))} {VERDICT_LABEL[verdict]}
              </span>
            ) : null,
          )}
        </span>
      </header>
      <ol className="rb-grid">
        {rebuild.rows.map((row, index) => {
          const verdict = verdicts[index];
          const label = `سؤال ${toPersianDigits(row.q)}: پاسخ ${row.answer === "سفید" ? "سفید" : toPersianDigits(row.answer)}، کلید ${row.key === "حذف" ? "حذف" : toPersianDigits(row.key)}، ${VERDICT_LABEL[verdict]}`;
          return (
            <li className={`rb-q rb-q-${verdict}`} key={row.q} aria-label={label} title={row.keyNote}>
              <span className="rb-q-num">{toPersianDigits(row.q)}</span>
              <span className="rb-bubbles" aria-hidden="true">
                {[1, 2, 3, 4].map((option) => {
                  const picked = row.answer === option;
                  const isKey = row.key === option;
                  return (
                    <i className={[picked ? "is-picked" : "", isKey ? "is-key" : ""].join(" ").trim() || undefined} key={option}>
                      {toPersianDigits(option)}
                    </i>
                  );
                })}
              </span>
              <span className="rb-q-mark" aria-hidden="true">
                {verdict === "correct" ? "✓" : verdict === "wrong" ? "✗" : verdict === "blank" ? "—" : "حذف"}
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption className="rb-legend">
        <span><i className="is-picked" />پاسخ داوطلب</span>
        <span><i className="is-key" />کلید</span>
      </figcaption>
    </figure>
  );
}

function Questions({ rebuild }: { rebuild: QuestionsRebuild }) {
  return (
    <figure className="rb rb-questions">
      {rebuild.panels.map((panel, index) => (
        <Fragment key={panel.label}>
          {index > 0 && panel.tone === "class" && rebuild.panels[index - 1].tone === "konkur" && (
            <span className="rb-link" aria-hidden="true">⇅ همان ایده، پیش از کنکور</span>
          )}
          <section className={`rb-panel rb-panel-${panel.tone}`} dir={panel.ltr ? "ltr" : undefined}>
            <span className="rb-panel-tag" dir="rtl">{panel.label}</span>
            <p><RichText text={panel.text} /></p>
            {panel.options && (
              <ol className="rb-options">
                {panel.options.map((option, optionIndex) => (
                  <li key={option}>
                    <span>{toPersianDigits(optionIndex + 1)}</span>
                    <RichText text={option} />
                  </li>
                ))}
              </ol>
            )}
            {panel.notes && (
              <ul className="rb-notes">
                {panel.notes.map((note) => <li key={note}><RichText text={note} /></li>)}
              </ul>
            )}
          </section>
        </Fragment>
      ))}
    </figure>
  );
}

function Message({ rebuild }: { rebuild: MessageRebuild }) {
  return (
    <figure className="rb rb-chat">
      <div className="rb-bubble">
        {rebuild.quoted && <span className="rb-quoted">{rebuild.quoted}</span>}
        {rebuild.lines.map((line) => <p key={line}>{line}</p>)}
        <small>{rebuild.date}</small>
      </div>
      <figcaption>پیام شاگرد، همان‌طور که فرستاده بود</figcaption>
    </figure>
  );
}

export function EvidenceRebuildView({ rebuild }: { rebuild: EvidenceRebuild }) {
  switch (rebuild.kind) {
    case "scorecard":
      return <Scorecard rebuild={rebuild} />;
    case "answers":
      return <AnswerSheet rebuild={rebuild} />;
    case "questions":
      return <Questions rebuild={rebuild} />;
    case "message":
      return <Message rebuild={rebuild} />;
  }
}
