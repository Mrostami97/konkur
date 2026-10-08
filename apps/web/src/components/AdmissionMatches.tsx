import { formatPersianNumber, toPersianDigits } from "../lib/format";
import { roundRank, type AdmissionFit, type AdmissionMatch } from "../lib/rank-model";
import "./admission-matches.css";

const FIT_LABEL: Record<AdmissionFit, string> = {
  strong: "بهتر از بیشتر قبولی‌ها",
  within: "در محدودهٔ قبولی‌ها",
  edge: "نزدیک مرز قبولی",
  far: "دور",
};

const fa = (value: number) => formatPersianNumber(value, { maximumFractionDigits: 0 });

/**
 * Programs whose admitted students had ranks like this one, from published
 * report cards (aggregates of at least ten cards each). Each row says how
 * close the rank is in words, not by colour alone.
 */
export function AdmissionMatches({ matches, limit }: { matches: AdmissionMatch[]; limit?: number }) {
  const shown = limit ? matches.slice(0, limit) : matches;
  return (
    <ul className="am-list">
      {shown.map(({ pair, rank, fit }) => (
        <li key={`${pair.program}-${pair.university}-${pair.period ?? ""}`} data-fit={fit}>
          <div>
            <strong>
              {pair.program} {pair.university}
              {pair.period && pair.period !== "روزانه" && <span className="am-period">{pair.period}</span>}
            </strong>
            <span className="tnum">
              کد {toPersianDigits(pair.code)} · نیمهٔ وسط رتبهٔ قبولی‌ها {fa(pair.p25)} تا {fa(pair.p75)}
            </span>
          </div>
          <em>
            {FIT_LABEL[fit]}
            <small className="tnum"> · رتبهٔ تو حدود {fa(roundRank(rank))}</small>
          </em>
        </li>
      ))}
    </ul>
  );
}
