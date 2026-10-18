// Questions whose text points at a figure, table, code or language that the
// bank never cut out of the booklet: shown alone they cannot be answered, and
// the booklet crop is not shown to students (owner, 2026-10-18). build.mjs
// keeps them in the bank but in the review queue (text not verified) until
// the missing part is typed in or cut as a figure.
export const NEEDS_FIGURE = new Map([
  ["kunkurcomputer-q-1209-1382-b0-144", "زبانی که سؤال به آن اشاره می‌کند در متن نیست"],
  ["kunkurcomputer-q-1209-1384-b0-117", "شکل اتوماتون در متن نیست"],
  ["kunkurcomputer-q-1209-1384-b0-121", "شکل اتوماتون در متن نیست"],
  ["kunkurcomputer-q-1209-1392-370C-088", "ابعاد چهار ماتریس در متن نیست"],
  ["kunkurcomputer-q-1277-1382-b0-060", "شکل گراف در متن نیست"],
  ["kunkurcomputer-q-1277-1383-b0-050", "متن برنامه در سؤال نیست"],
  ["kunkurcomputer-q-1277-1383-b0-052", "شکل درخت در متن نیست"],
  ["kunkurcomputer-q-1277-1383-b0-063", "ماتریس P در متن نیست"],
  ["kunkurcomputer-q-1277-1384-b0-052", "شکل درخت در متن نیست"],
  ["kunkurcomputer-q-1277-1384-b0-053", "متن الگوریتم در سؤال نیست"],
  ["kunkurcomputer-q-1209-1383-b0-139", "متن سؤال ناقص است؛ تعریف تابع f نیامده"],
]);
