import { writeFileSync } from "node:fs";
import EXTRA from "./rankwins-extra.mjs";
const R = [
 { key: "10", rank: 10, slug: "master-computer-rank-10-report-card", note: "همهٔ ۲۳ قبولی این بازه در شریف بود و ۱۹ تایشان در هوش مصنوعی. کارنامه‌های این بازه فقط ۳۸ تاست و در هر سال ۳ تا ۱۰ کارنامه دارد؛ عددها را فقط نشانه بدان." },
 { key: "20", rank: 20, slug: "master-computer-rank-20-report-card", note: "۳۳ از ۳۹ قبولی این بازه در شریف بود و ۳۲ تایشان در هوش مصنوعی." },
 { key: "50", rank: 50, slug: "master-computer-rank-50-report-card", note: "بیشتر قبولی‌ها در سه دانشگاه است: شریف ۳۶، دانشگاه تهران ۲۸ و امیرکبیر ۷ از ۷۱." },
 { key: "100", rank: 100, slug: "master-computer-rank-100-report-card", note: "چهار دانشگاه بیشتر قبولی‌ها را دارند: شریف ۴۷، امیرکبیر ۲۶، دانشگاه تهران ۲۴ و علم و صنعت ۱۱ از ۱۱۴. کد معماری بیشتر از همه بهترین کد کارنامه‌ها بود (۶۹ از ۱۶۶)." },
 { key: "200", rank: 200, slug: "master-computer-rank-200-report-card", note: "علم و صنعت با ۴۱ از ۱۳۹ قبولی بیشترین سهم را دارد و بعد امیرکبیر (۲۹) و دانشگاه تهران (۲۰) می‌آیند." },
 { key: "300", rank: 300, slug: "master-computer-rank-300-report-card", note: "قبولی‌ها بین هشت دانشگاه پخش است؛ علم و صنعت ۲۴، تربیت مدرس ۲۱ و شهید بهشتی ۱۹ از ۱۲۳ پیشتازند." },
 { key: "500", rank: 500, slug: "master-computer-rank-500-report-card", note: "قبولی‌ها بین ۱۱ دانشگاه پخش شده و هیچ‌کدام بیشتر از ۱۳ از ۱۰۵ قبولی ندارد." },
 { key: "1000", rank: 1000, slug: "master-computer-rank-1000-report-card", note: "قبولی این بازه پراکنده است: از ۴۹ قبولی فقط شیراز (۱۰) و دانشگاه اصفهان (۷) به ۵ کارنامه رسیدند." },
];
for (const r0 of R) { const r = { ...r0, ...(EXTRA[r0.key] || {}) }; writeFileSync(`articles/${r.slug}.mjs`, `import { rankWindowArticle } from "../lib/rankwin.mjs";\n\nexport default rankWindowArticle(${JSON.stringify(r, null, 2)});\n`);
}
