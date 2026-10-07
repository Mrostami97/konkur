// «Solving recurrences in the konkur»: seven past computer-engineering
// master's questions on recurrences, from the owner's bank (text and final
// key checked against the booklets), each with a worked solution that
// reaches the official key. The methods all sit in the 1406 syllabus of
// «داده‌ساختارها و الگوریتم‌ها» (تحلیل الگوریتم: تقسیم‌وحل، قضیهٔ اصلی).
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });

const TESTS = [
  {
    source: "مهندسی کامپیوتر ۱۳۹۱، سؤال ۴۷",
    method: "قضیهٔ اصلی و حالت دوم تعمیم‌یافته",
    stem: String.raw`در رابطهٔ بازگشتی $T(n)=9T(n/3)+f(n)$، به‌ازای چند تا از عبارت‌های $g(n)$ زیر دست‌کم یک تابع $f(n)$ وجود دارد که $T(n)=\Theta(g(n))$ شود؟ $n\lg n$، $n^2$، $n^2\lg^2 n$، $n^3$`,
    options: ["۱", "۲", "۳", "۴"],
    answer: 3,
    solution: String.raw`$n^{\log_3 9}=n^2$. جملهٔ $9T(n/3)$ به‌تنهایی $\Theta(n^2)$ می‌سازد، پس هیچ $f$ نامنفی‌ای جواب را کمتر از $n^2$ نمی‌کند و $n\lg n$ ممکن نیست. بقیه ساختنی‌اند: $f(n)=n$ جواب $\Theta(n^2)$ می‌دهد (حالت اول)، $f(n)=n^2\lg n$ جواب $\Theta(n^2\lg^2 n)$ (حالت دوم تعمیم‌یافته: $f=\Theta(n^{\log_b a}\lg^k n)$ نتیجه می‌دهد $T=\Theta(n^{\log_b a}\lg^{k+1} n)$) و $f(n)=n^3$ جواب $\Theta(n^3)$ (حالت سوم). پس سه عبارت: گزینهٔ ۳.`,
  },
  {
    source: "مهندسی کامپیوتر ۱۳۹۹، سؤال ۸۵",
    method: "قضیهٔ اصلی: مقایسهٔ $a$ با $b^2$",
    stem: String.raw`به‌ازای چند زوج $(a,b)$ از اعداد طبیعی کوچک‌تر از ۵، جواب رابطهٔ بازگشتی $T(n)=aT(n/b)+n^2$ برابر $\Theta(n^2)$ می‌شود؟`,
    options: ["۷", "۸", "۱۱", "۱۲"],
    answer: 3,
    solution: String.raw`جواب $\Theta(n^2)$ است اگر و فقط اگر $n^2$ بر $n^{\log_b a}$ غالب باشد، یعنی $\log_b a<2$ یا $a<b^2$ (اگر $a=b^2$، جواب $n^2\log n$ می‌شود). $b=1$ اصلاً اندازه را کم نمی‌کند و کنار می‌رود. برای $b=2$: $a<4$، یعنی $a=1,2,3$ (۳ زوج). برای $b=3$: $a<9$، همهٔ $a=1,\dots,4$ (۴ زوج). برای $b=4$: باز ۴ زوج. جمع: $3+4+4=11$؛ گزینهٔ ۳.`,
  },
  {
    source: "مهندسی کامپیوتر ۱۳۹۶، سؤال ۵۱",
    method: "تقسیم دو طرف بر $n$",
    stem: String.raw`اگر زمان اجرای یک الگوریتم با رابطهٔ بازگشتی $T(n)=\sqrt n\,T(\sqrt n)+n$ مشخص شود، پیچیدگی زمانی الگوریتم کدام است؟`,
    options: [String.raw`$\Theta(n)$`, String.raw`$\Theta(\sqrt n\log n)$`, String.raw`$\Theta(n\log\log n)$`, String.raw`$\Theta(n\log n)$`],
    answer: 3,
    solution: String.raw`دو طرف را بر $n$ تقسیم کنید و $S(n)=\frac{T(n)}n$ بگیرید: $S(n)=S(\sqrt n)+1$. هر بار جذر گرفتن، $\log n$ را نصف می‌کند، پس بعد از $\log\log n$ گام به ثابت می‌رسیم: $S(n)=\Theta(\log\log n)$ و $T(n)=\Theta(n\log\log n)$؛ گزینهٔ ۳.`,
  },
  {
    source: "مهندسی کامپیوتر ۱۳۹۷، سؤال ۵۳",
    method: "تغییر متغیر $n=2^m$",
    stem: String.raw`جواب رابطهٔ بازگشتی $T(n)=T(\sqrt n)+O(\log\log n)$ کدام است؟`,
    options: [String.raw`$O(\log n)$`, String.raw`$O(\log^2 n)$`, String.raw`$O(\log\log n)$`, String.raw`$O(\log^2\log n)$`],
    answer: 4,
    solution: String.raw`با $n=2^m$ و $S(m)=T(2^m)$: $S(m)=S(m/2)+O(\log m)$. این رابطه را قضیهٔ اصلی (حالت دوم تعمیم‌یافته با $a=1, b=2$) حل می‌کند: $S(m)=O(\log^2 m)$. با برگرداندن $m=\log n$: $T(n)=O(\log^2\log n)$؛ گزینهٔ ۴.`,
  },
  {
    source: "مهندسی کامپیوتر ۱۳۹۸، سؤال ۵۱",
    method: "شمردن گام‌ها",
    stem: String.raw`پاسخ رابطهٔ بازگشتی $T(n)=T(n/\log n)+O(1)$ کدام است؟`,
    options: [String.raw`$O(\log n)$`, String.raw`$O(\log\log n)$`, String.raw`$O(\log n/\log\log n)$`, String.raw`$O(\log n/(\log\log n)^2)$`],
    answer: 3,
    solution: String.raw`هر گام هزینهٔ ثابت دارد، پس جواب تعداد گام‌هاست تا $n$ به ثابت برسد. با $L=\log n$، هر گام $L$ را به $L-\log L$ کم می‌کند. تا وقتی $n$ از $\sqrt n$ بزرگ‌تر است، $\log L$ حدود $\log\log n$ است، پس برای پایین آوردن $L$ تا نصف حدود $\frac{L/2}{\log\log n}$ گام لازم است. نیمه‌های بعدی جمع هندسی‌اند و هم‌مرتبه‌اند. جواب $\Theta\left(\frac{\log n}{\log\log n}\right)$ است؛ گزینهٔ ۳. (برای مقایسه: $T(n)=T(n/2)+O(1)$ جواب $\log n$ دارد؛ تقسیم بر $\log n$ به‌جای ۲ یک $\log\log n$ صرفه‌جویی می‌کند.)`,
  },
  {
    source: "مهندسی کامپیوتر ۱۳۹۲، سؤال ۴۸",
    method: "حدس و جای‌گذاری",
    stem: String.raw`کدام گزینه حل رابطهٔ بازگشتی $T(n,k)=T(n/2,k)+T(n,k/4)+kn$ است؟`,
    options: [String.raw`$\Theta(nk)$`, String.raw`$\Theta(n\log_4(nk))$`, String.raw`$\Theta(n+\log_4(nk))$`, String.raw`$\Theta(nk\log_4(nk))$`],
    answer: 1,
    solution: String.raw`جملهٔ غیربازگشتی $nk$ است؛ حدس بزنید $T(n,k)=c\,nk$ و جای‌گذاری کنید: $c\frac{nk}2+c\frac{nk}4+nk=\left(\frac{3c}4+1\right)nk$. برابری با $c\,nk$ یعنی $c=4$؛ پس حدس درست است. نکته: مجموع ضرایب $\frac12+\frac14<1$ است، پس مثل حالت سوم قضیهٔ اصلی، هزینهٔ سطح ریشه غالب است و جواب $\Theta(nk)$ می‌شود؛ گزینهٔ ۱.`,
  },
  {
    source: "مهندسی کامپیوتر ۱۳۹۱، دفترچهٔ ۲، سؤال ۹۷",
    method: "نوشتن رابطه از روی الگوریتم",
    stem: String.raw`در راه‌حل کلاسیک یافتن میانهٔ $n$ عنصر، عناصر را به دسته‌های ۵تایی تقسیم می‌کنیم، میانهٔ هر دسته و سپس میانهٔ میانه‌ها را به‌صورت بازگشتی به دست می‌آوریم و آن را محور بخش‌بندی می‌کنیم. اگر به‌جای دسته‌های ۵تایی از دسته‌های ۳تایی استفاده کنیم، زمان اجرا با کدام رابطه بیان می‌شود؟`,
    options: [String.raw`$T(n)\le T(2n/3)+cn$`, String.raw`$T(n)\le T(n/3)+cn$`, String.raw`$T(n)\le 2T(n/3)+cn$`, String.raw`$T(n)\le T(n/3)+T(2n/3)+cn$`],
    answer: 4,
    solution: String.raw`با دسته‌های ۳تایی، $n/3$ میانه داریم و یافتن میانهٔ آن‌ها $T(n/3)$ هزینه دارد. محور از نیمی از میانه‌ها بزرگ‌تر است و هر کدام از آن میانه‌ها با یک عنصر دیگر کوچک‌تر از محورند؛ پس دست‌کم حدود $2\cdot\frac n6=\frac n3$ عنصر کوچک‌تر (و به همین ترتیب بزرگ‌تر) از محور است و بازگشت روی حداکثر $\frac{2n}3$ عنصر انجام می‌شود. با بخش‌بندی $cn$: $T(n)\le T(n/3)+T(2n/3)+cn$؛ گزینهٔ ۴. این رابطه $\Theta(n\log n)$ است، چون $\frac13+\frac23=1$؛ برای همین دسته‌های ۵تایی (با $\frac15+\frac7{10}<1$) لازم‌اند تا زمان خطی شود.`,
  },
];

export function recurrencesArticle() {
  const slug = "recurrence-relations-konkur-tests";
  const blocks = [];
  blocks.push(text(`روابط بازگشتی تقریباً هر سال در تست‌های داده‌ساختارها و الگوریتم‌های کنکور ارشد هستند و در سرفصل ۱۴۰۶ هم («تحلیل الگوریتم: تقسیم‌وحل و قضیهٔ اصلی») مانده‌اند. این صفحه ${fa(TESTS.length)} تست واقعی کنکور ارشد مهندسی کامپیوتر را از ۱۳۹۱ تا ۱۳۹۹ با حل تشریحی آورده است. هر تست یک روش را نشان می‌دهد و جواب هر حل با کلید نهایی سازمان سنجش یکی است.`));

  blocks.push(h2("روش‌ها در یک نگاه"));
  blocks.push(text([
    String.raw`• قضیهٔ اصلی برای $T(n)=aT(n/b)+f(n)$: $f$ را با $n^{\log_b a}$ مقایسه کن. اگر $f$ کوچک‌تر باشد (به‌اندازهٔ یک توان)، جواب $n^{\log_b a}$ است؛ اگر هم‌اندازه باشد، یک $\log$ اضافه می‌شود؛ اگر بزرگ‌تر باشد، $f$ برنده است.`,
    String.raw`• حالت دوم تعمیم‌یافته: اگر $f=\Theta(n^{\log_b a}\log^k n)$، جواب $\Theta(n^{\log_b a}\log^{k+1} n)$ است.`,
    String.raw`• تغییر متغیر: برای $\sqrt n$ بگذار $n=2^m$؛ رابطه به $m/2$ تبدیل می‌شود.`,
    String.raw`• تقسیم دو طرف: وقتی ضریب هم به $n$ وابسته است (مثل $\sqrt n\,T(\sqrt n)$)، بر $n$ تقسیم کن.`,
    String.raw`• حدس و جای‌گذاری: جواب را حدس بزن و با جای‌گذاری ثابتش را پیدا کن؛ برای دومتغیره‌ها بهترین راه است.`,
    String.raw`• زیرمسئله‌های نابرابر ($T(n/2)+T(3n/4)$): قضیهٔ آکرا–بازی یا درخت بازگشت. نمونه‌اش در تست‌های صفحهٔ درس هست.`,
  ].join("\n")));

  TESTS.forEach((t, index) => {
    blocks.push(h2(`تست ${fa(index + 1)}: ${t.method}`));
    blocks.push(text(`${t.source}.`));
    blocks.push(text(t.stem));
    blocks.push(text(t.options.map((o, i) => `${fa(i + 1)}) ${o}`).join("\n")));
    blocks.push(text(`پاسخ: گزینهٔ ${fa(t.answer)}. ${t.solution}`));
  });

  blocks.push(h2("کدام روش برای کدام شکل؟"));
  blocks.push({
    type: "table",
    headers: ["شکل رابطه", "روش", "تست"],
    rows: [
      [String.raw`$aT(n/b)+f(n)$`, "قضیهٔ اصلی", "۱ و ۲"],
      [String.raw`$\sqrt n\,T(\sqrt n)+n$`, "تقسیم بر $n$", "۳"],
      [String.raw`$T(\sqrt n)+g(n)$`, "تغییر متغیر $n=2^m$", "۴"],
      [String.raw`$T(n/\log n)+O(1)$`, "شمردن گام‌ها", "۵"],
      ["دومتغیره", "حدس و جای‌گذاری", "۶"],
      [String.raw`$T(\alpha n)+T(\beta n)+cn$`, String.raw`مقایسهٔ $\alpha+\beta$ با ۱`, "۷"],
    ],
  });

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3("قضیهٔ اصلی کی کار نمی‌کند؟"));
  blocks.push(text(String.raw`وقتی زیرمسئله‌ها اندازهٔ برابر ندارند (مثل $T(n/3)+T(2n/3)$)، وقتی ضریب $a$ به $n$ بستگی دارد (مثل $\sqrt n\,T(\sqrt n)$)، یا وقتی اندازه با کم شدن یک مقدار ثابت کوچک می‌شود ($T(n-1)$). در این حالت‌ها از تغییر متغیر، درخت بازگشت یا آکرا–بازی استفاده کن.`));
  blocks.push(h3("روابط بازگشتی در سرفصل ۱۴۰۶ هستند؟"));
  blocks.push(text("بله. فصل «تحلیل الگوریتم» سرفصل ۱۴۰۶ داده‌ساختارها و الگوریتم‌ها، تقسیم‌وحل و قضیهٔ اصلی را دارد."));

  blocks.push(h2("قدم بعدی"));
  blocks.push({
    type: "link_group",
    items: [
      { label: "تست‌های داده‌ساختارها و الگوریتم‌ها با حل", href: "/subjects/data-structures-algorithms#tests" },
      { label: "تحلیل سرشکن", href: "/articles/amortized-analysis" },
      { label: "تعداد تست داده‌ساختارها و الگوریتم‌ها در هر سال", href: "/articles/data-structures-algorithms-questions-per-year" },
      { label: "تست‌های تکراری کنکور ارشد", href: "/articles/repeated-master-computer-questions" },
      { label: "بانک سؤال داده‌ساختارها و الگوریتم‌ها", href: "/questions?subject=data-structures-algorithms" },
    ],
  });

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-lesson-${slug}`,
    content_type: "article",
    title: "حل روابط بازگشتی در کنکور ارشد: ۷ تست کنکور با پاسخ تشریحی",
    slug,
    summary: "قضیهٔ اصلی، تغییر متغیر، تقسیم دو طرف و حدس و جای‌گذاری، هر کدام با یک تست واقعی کنکور ارشد مهندسی کامپیوتر و حل قدم‌به‌قدم.",
    quick_answer: String.raw`برای $T(n)=aT(n/b)+f(n)$ تابع $f$ را با $n^{\log_b a}$ مقایسه کن (قضیهٔ اصلی). برای $\sqrt n$ تغییر متغیر $n=2^m$ بده، وقتی ضریب به $n$ وابسته است بر $n$ تقسیم کن و برای زیرمسئله‌های نابرابر درخت بازگشت یا آکرا–بازی را به کار ببر. این صفحه هر روش را با یک تست کنکور ارشد حل کرده است.`,
    content_blocks: blocks,
    seo: {
      title: "حل روابط بازگشتی کنکور ارشد با تست و پاسخ تشریحی",
      description: "قضیهٔ اصلی و روش‌های حل روابط بازگشتی برای کنکور ارشد کامپیوتر، با ۷ تست کنکور از ۱۳۹۱ تا ۱۳۹۹ و حل تشریحی هم‌خوان با کلید سنجش.",
    },
    taxonomy: { major: ["کامپیوتر و IT"], tags: ["روابط بازگشتی", "قضیه اصلی", "داده‌ساختارها و الگوریتم‌ها", "حل تست"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: ["data-structures-algorithms"], topic_codes: [] },
    validity: { exam_year: 1406, time_sensitive: false, source_checked_at: "2026-10-07T00:00:00.000Z" },
    sources: [
      {
        source_external_id: "editorial-source-bd8f7cb1262dd65dec24",
        relation: "SUPPORTS",
        locator: "دفترچه‌های سؤال و کلیدهای کنکور کارشناسی ارشد مهندسی کامپیوتر (۱۲۷۷)، ۱۳۹۱ تا ۱۳۹۹",
        claim: "صورت، گزینه‌ها و کلید هر تست",
        order: 0,
      },
      {
        source_external_id: "editorial-source-50f3b52142efac0715d8",
        relation: "SUPPORTS",
        locator: "اطلاعیه و جدول مجموعه‌های امتحانی کارشناسی ارشد ناپیوسته سال ۱۴۰۶",
        claim: "جای داده‌ساختارها و الگوریتم‌ها در کنکور ۱۴۰۶",
        order: 1,
      },
    ],
    editorial: { author_slug: "mohammad-rostami" },
    provenance: {
      producer_type: "external_ai",
      producer_name: "حل تشریحی با Claude، هم‌خوان با کلید نهایی هر تست — نیازمند بازبینی و تأیید محمد رستمی",
      source_artifact: `content/import-packages/articles/${slug}.mjs`,
    },
    review_status: "draft",
  };
}
