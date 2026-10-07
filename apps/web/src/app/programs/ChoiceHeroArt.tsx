/**
 * The finder's hero picture: booklet codes as tickets, one flying into the
 * next empty row of the field-selection form. Pure SVG and CSS (see
 * admissions.css, .cha-*); motion stops for prefers-reduced-motion.
 */
const FILLED = ["۲۲۸۲۴", "۲۲۷۰۲", "۲۲۹۹۵"];
const TICKETS = [
  { code: "۲۳۰۱۱", tone: "#7fb2f5", y: 168, rotate: 7 },
  { code: "۲۲۵۹۳", tone: "#f4b860", y: 120, rotate: -5 },
  { code: "۲۲۷۸۲", tone: "#19c2a6", y: 72, rotate: 2 },
];

function Ticket({ code, tone }: { code: string; tone: string }) {
  return (
    <g>
      <rect width="156" height="58" rx="10" fill="#13263d" stroke="rgba(255,255,255,0.18)" />
      {/* the perforation between stub and body */}
      <line x1="112" y1="8" x2="112" y2="50" stroke="rgba(255,255,255,0.28)" strokeDasharray="3 4" />
      <circle cx="112" cy="0" r="6" fill="#0c1b2e" />
      <circle cx="112" cy="58" r="6" fill="#0c1b2e" />
      <rect x="14" y="14" width="78" height="7" rx="3.5" fill="rgba(255,255,255,0.55)" />
      <rect x="14" y="27" width="54" height="6" rx="3" fill="rgba(255,255,255,0.22)" />
      <rect x="14" y="39" width="34" height="9" rx="4.5" fill={tone} opacity="0.85" />
      <text x="134" y="34" textAnchor="middle" className="cha-code" fill={tone} transform="rotate(-90 134 34)">{code}</text>
    </g>
  );
}

export function ChoiceHeroArt() {
  return (
    <svg className="cha" viewBox="0 0 440 300" role="img" aria-label="کدهای رشته‌محل که به ترتیب در فرم انتخاب رشته می‌نشینند">
      <defs>
        <linearGradient id="cha-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
        </linearGradient>
      </defs>

      {/* the form */}
      <rect x="14" y="20" width="196" height="262" rx="18" fill="url(#cha-panel)" stroke="rgba(255,255,255,0.16)" />
      <text x="194" y="48" textAnchor="end" className="cha-title">فرم انتخاب رشته</text>
      <text x="30" y="48" className="cha-count">۴ / ۱۰۰</text>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 66 + i * 42;
        const filled = i < 3;
        return (
          <g key={i} className={i === 3 ? "cha-target" : undefined}>
            <circle cx="186" cy={y + 15} r="12" fill={filled || i === 3 ? "#19c2a6" : "rgba(255,255,255,0.1)"} className={i === 3 ? "cha-dot" : undefined} />
            <text x="186" y={y + 20} textAnchor="middle" className="cha-num">{["۱", "۲", "۳", "۴", "۵"][i]}</text>
            <rect
              x="30"
              y={y}
              width="140"
              height="30"
              rx="8"
              fill={filled ? "rgba(25,194,166,0.14)" : "transparent"}
              stroke={filled ? "rgba(25,194,166,0.5)" : "rgba(255,255,255,0.22)"}
              strokeDasharray={filled ? undefined : "4 4"}
            />
            {filled && <text x="156" y={y + 20} textAnchor="end" className="cha-row-code">{FILLED[i]}</text>}
            {filled && <rect x="42" y={y + 12} width={46 - i * 8} height="6" rx="3" fill="rgba(255,255,255,0.3)" />}
            {i === 3 && <text x="156" y={y + 20} textAnchor="end" className="cha-row-code cha-landed">۲۲۸۰۶</text>}
          </g>
        );
      })}

      {/* the path a code takes */}
      <path id="cha-route" d="M282 96 C 250 96, 250 210, 172 207" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="2 6" />
      <circle r="4" fill="#19c2a6" className="cha-pulse">
        <animateMotion dur="4s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.45;1" calcMode="linear">
          <mpath href="#cha-route" />
        </animateMotion>
      </circle>

      {/* the booklet's codes */}
      {TICKETS.map((ticket) => (
        <g key={ticket.code} transform={`translate(272 ${ticket.y}) rotate(${ticket.rotate} 78 29)`}>
          <Ticket code={ticket.code} tone={ticket.tone} />
        </g>
      ))}
      <g className="cha-fly">
        <g transform="translate(272 72) rotate(2 78 29)">
          <Ticket code="۲۲۸۰۶" tone="#19c2a6" />
        </g>
      </g>
    </svg>
  );
}
