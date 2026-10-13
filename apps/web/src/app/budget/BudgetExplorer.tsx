"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toPersianDigits } from "../../lib/format";

export interface BudgetSubject {
  name: string;
  counts: number[];
  total: number;
  in1406: boolean;
  article: string | null;
}
export interface BudgetTrack {
  code: string;
  name: string;
  years: number[];
  totals: number[] | null;
  subjects: BudgetSubject[];
  new1406: string[];
  note?: string;
}
export interface RankCell {
  med: number;
  q1: number;
  q3: number;
  net: number;
  tests: number;
  zero: number;
}
export interface RankYear {
  sections: string[];
  bands: { band: string; n: number; cells: RankCell[] }[];
}
export interface BudgetData {
  tracks: Record<"ce" | "it" | "cs", BudgetTrack>;
  rankMap: Record<string, RankYear>;
}

const fa = (v: number | string) => toPersianDigits(String(v)).replace(".", "٫");
const bandLabel = (b: string) => {
  const [lo, hi] = b.split("-");
  return `رتبهٔ ${fa(lo)} تا ${fa(hi)}`;
};

/**
 * The budget page's three tools: a heatmap of how many questions each subject
 * had in each year's booklet, the rank map (net correct questions per section
 * for each rank band, from published report cards) and the step between two
 * bands -- which section separates them most. Everything is rendered on the
 * server with its default state, so the numbers are in the page HTML.
 */
export function BudgetExplorer({ data }: { data: BudgetData }) {
  const [trackKey, setTrackKey] = useState<"ce" | "it" | "cs">("ce");
  const [allYears, setAllYears] = useState(false);
  const track = data.tracks[trackKey];
  const shown = allYears ? track.years : track.years.slice(-8);
  const offset = track.years.length - shown.length;
  const max = Math.max(...track.subjects.flatMap((s) => s.counts));

  const rank = data.rankMap["1404"];
  const [from, setFrom] = useState(rank.bands.length - 1);
  const [to, setTo] = useState(2);
  const [target, setTarget] = useState(1);

  const steps = useMemo(() => {
    const a = rank.bands[from].cells;
    const b = rank.bands[to].cells;
    return rank.sections
      .map((name, i) => ({ name, from: a[i].net, to: b[i].net, tests: b[i].tests, delta: Math.round((b[i].net - a[i].net) * 10) / 10 }))
      .sort((x, y) => y.delta - x.delta);
  }, [rank, from, to]);
  const stepMax = Math.max(...steps.map((s) => Math.abs(s.delta)), 1);
  const totalDelta = Math.round(steps.reduce((sum, s) => sum + s.delta, 0) * 10) / 10;

  return (
    <div className="bd-body">
      <section className="bd-card" aria-labelledby="bd-heat-title">
        <header className="bd-card-head">
          <h2 id="bd-heat-title">هر درس در هر سال چند تست داشت؟</h2>
          <div className="bd-tabs" role="group" aria-label="مجموعهٔ امتحانی">
            {(["ce", "it", "cs"] as const).map((key) => (
              <button type="button" key={key} aria-pressed={trackKey === key} onClick={() => setTrackKey(key)}>
                {data.tracks[key].name} <span>{fa(data.tracks[key].code)}</span>
              </button>
            ))}
          </div>
        </header>
        <p className="bd-lede">
          رنگ تیره‌تر یعنی تست بیشتر. درس‌هایی که در ۱۴۰۶ نیستند کم‌رنگ آمده‌اند؛ تست‌هایشان برای ۱۴۰۶ به کار نمی‌آید.
          {track.note ? ` ${track.note}` : ""}
        </p>
        <div className="bd-heat-wrap">
          <table className="bd-heat">
            <thead>
              <tr>
                <th scope="col">درس</th>
                {shown.map((y) => <th scope="col" key={y}>{fa(y)}</th>)}
                <th scope="col">تست تمرینی در بانک</th>
              </tr>
            </thead>
            <tbody>
              {track.subjects.map((s) => (
                <tr key={s.name} data-out={!s.in1406 || undefined}>
                  <th scope="row">
                    {s.article ? <Link href={s.article}>{s.name}</Link> : s.name}
                    {!s.in1406 && <span className="bd-chip bd-chip-out">در ۱۴۰۶ نیست</span>}
                  </th>
                  {s.counts.slice(offset).map((c, i) => (
                    <td key={i} style={{ "--a": c ? 0.12 + (0.88 * c) / max : 0 } as React.CSSProperties}>{c ? fa(c) : "–"}</td>
                  ))}
                  <td className="bd-total">{fa(s.total)}</td>
                </tr>
              ))}
              {track.new1406.map((name) => (
                <tr key={name} data-new>
                  <th scope="row">{name} <span className="bd-chip bd-chip-new">تازه در ۱۴۰۶</span></th>
                  <td colSpan={shown.length + 1}>در این مجموعه سابقهٔ سؤال ندارد؛ تعداد تستش را از تاریخچه نمی‌شود حدس زد.</td>
                </tr>
              ))}
              {track.totals && (
                <tr className="bd-sum">
                  <th scope="row">کل دفترچه</th>
                  {track.totals.slice(offset).map((t, i) => <td key={i}>{fa(t)}</td>)}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button type="button" className="bd-more" onClick={() => setAllYears(!allYears)}>
          {allYears ? "فقط هشت سال اخیر" : `همهٔ سال‌ها از ${fa(track.years[0])}`}
        </button>
      </section>

      <section className="bd-card" aria-labelledby="bd-step-title">
        <header className="bd-card-head">
          <h2 id="bd-step-title">رتبه کجا ساخته می‌شود؟</h2>
        </header>
        <p className="bd-lede">
          از کارنامه‌های قبولی ارشد مهندسی کامپیوتر ۱۴۰۴ ({fa(rank.bands.reduce((a, b) => a + b.n, 0))} کارنامه): داوطلبی که می‌خواهد از یک بازهٔ رتبه به بازهٔ بهتر برسد، در هر بخش دفترچه چند «تست خالص» بیشتر لازم دارد؟ تست خالص یعنی درست‌ها منهای یک‌سوم غلط‌ها.
        </p>
        <div className="bd-pickers">
          <label>
            الان حدود
            <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>
              {rank.bands.map((b, i) => <option value={i} key={b.band}>{bandLabel(b.band)}</option>)}
            </select>
          </label>
          <label>
            هدف
            <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
              {rank.bands.map((b, i) => <option value={i} key={b.band}>{bandLabel(b.band)}</option>)}
            </select>
          </label>
        </div>
        {from === to ? (
          <p className="bd-note">دو بازهٔ متفاوت انتخاب کن.</p>
        ) : (
          <>
            <p className="bd-headline">
              {totalDelta > 0
                ? <>جمعاً حدود <b>{fa(totalDelta)}</b> تست خالص بیشتر؛ بیشترین فاصله در <b>{steps[0].name}</b> است ({fa(steps[0].delta)} تست).</>
                : <>این بازه از بازهٔ فعلی پایین‌تر است.</>}
            </p>
            <ul className="bd-steps">
              {steps.map((s) => (
                <li key={s.name}>
                  <span className="bd-step-name">{s.name}</span>
                  <span className="bd-step-bar" aria-hidden="true">
                    <span style={{ width: `${(100 * Math.max(s.delta, 0)) / stepMax}%` }} />
                  </span>
                  <span className="bd-step-val">{s.delta > 0 ? "+" : ""}{fa(s.delta)}</span>
                  <span className="bd-step-sub">از {fa(s.from)} به {fa(s.to)} از {fa(s.tests)} تست</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="bd-card" aria-labelledby="bd-target-title">
        <header className="bd-card-head">
          <h2 id="bd-target-title">برای هر رتبه، هر بخش چند درصد؟</h2>
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="بازهٔ رتبه">
            {rank.bands.map((b, i) => <option value={i} key={b.band}>{bandLabel(b.band)}</option>)}
          </select>
        </header>
        <p className="bd-lede">
          میانهٔ درصد قبول‌شده‌های {bandLabel(rank.bands[target].band)} در ۱۴۰۴ ({fa(rank.bands[target].n)} کارنامه) و بازهٔ نیمهٔ میانی آن‌ها. «صفر یا منفی» یعنی چند درصد از همین رتبه‌ها آن بخش را صفر یا منفی زده بودند.
        </p>
        <div className="bd-heat-wrap">
          <table className="bd-table">
            <thead>
              <tr><th scope="col">بخش دفترچهٔ ۱۴۰۴</th><th scope="col">میانهٔ درصد</th><th scope="col">نیمهٔ میانی</th><th scope="col">تست خالص</th><th scope="col">صفر یا منفی</th></tr>
            </thead>
            <tbody>
              {rank.sections.map((name, i) => {
                const c = rank.bands[target].cells[i];
                return (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{fa(c.med)}٪</td>
                    <td>{fa(c.q1)} تا {fa(c.q3)}٪</td>
                    <td>{fa(c.net)} از {fa(c.tests)}</td>
                    <td>{fa(c.zero)}٪</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="bd-note">بخش‌ها همان بخش‌های دفترچهٔ ۱۴۰۴ هستند؛ در ۱۴۰۶ شبکه، پایگاه داده و سیگنال حذف و جبر خطی و برنامه‌سازی اضافه شده‌اند، پس این‌ها را راهنمای ترتیب اهمیت بدان، نه نسخهٔ دقیق ۱۴۰۶.</p>
      </section>
    </div>
  );
}
