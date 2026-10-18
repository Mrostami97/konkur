// Worked solutions for bank questions outside the public samples, in three
// layers: `hint` (a nudge before answering, without the answer), `shortcut`
// (the quick way under exam time) and `solution` (the full reasoning).
// build.mjs adds them to their questions and refuses to build if `answer`
// (the option the solution reaches) differs from the key. Written by Claude
// and waiting for the owner's review (noted on each question).
//
// Key: the question's external id. Only questions whose text and final key
// were checked; a key the mathematics does not reach is logged in
// ../bank-corrections.md instead of solved here.

const t = (text) => ({ type: "text", text });

export const SOLUTIONS = {
  // ------------------------------------------- رشد توابع و روابط بازگشتی
  "kunkurcomputer-q-1209-1382-b0-073": {
    answer: 1,
    hint: "عبارت را ساده کن: $n^2-2n+1$ مربع کامل است.",
    shortcut: String.raw`$(n+1)(n-1)^2$ یک چندجمله‌ای درجهٔ ۳ است، یعنی $\Theta(n^3)$. هر چندجمله‌ای در $O(2^n)$ است؛ گزینهٔ ۱.`,
    solution: [
      t(String.raw`$n^2-2n+1=(n-1)^2$، پس عبارت برابر $(n+1)(n-1)^2=n^3-n^2-n+1$ است که رشدش $\Theta(n^3)$ است.`),
      t(String.raw`گزینهٔ ۲ ($\Theta(n)$) و گزینهٔ ۴ ($O(n^2\log n)$) کران‌هایی کوچک‌تر از $n^3$ می‌دهند و نادرست‌اند؛ گزینهٔ ۳ ($\Omega(n^4)$) کران پایینی بزرگ‌تر از $n^3$ است و آن هم نادرست است.`),
      t(String.raw`گزینهٔ ۱ درست است: $\lim_{n\to\infty}\frac{n^3}{2^n}=0$، پس $n^3\in O(2^n)$ (حتی $o(2^n)$). این کران دقیق نیست، اما درست است و سؤال فقط درستی را می‌پرسد.`),
    ],
  },
  "kunkurcomputer-q-1209-1382-b0-086": {
    answer: 3,
    hint: String.raw`اول $\log(n!)$ را به شکل ساده‌تری بنویس.`,
    shortcut: String.raw`$\log(n!)=\Theta(n\log n)$. با $a=b=2$ داریم $n^{\log_ba}=n$، و $f(n)=n\log n$ یعنی حالت دوم توسعه‌یافتهٔ قضیهٔ اصلی با یک $\log$ اضافه: $\Theta(n\log^2n)$.`,
    solution: [
      t(String.raw`گام اول: $\log(n!)=\sum_{k=1}^n\log k$. این مجموع حداکثر $n\log n$ است و چون نیمهٔ بالایی جمله‌ها هر کدام دست‌کم $\log\frac n2$ هستند، حداقل $\frac n2\log\frac n2$ است؛ پس $\log(n!)=\Theta(n\log n)$.`),
      t(String.raw`رابطه می‌شود $T(n)=2T(\frac n2)+\Theta(n\log n)$. در درخت بازگشت، سطح $i$ام $2^i$ گره دارد که هر کدام $\frac n{2^i}\log\frac n{2^i}$ کار می‌کنند؛ کار کل آن سطح $n(\log n-i)$ است.`),
      t(String.raw`جمع روی $\log n$ سطح: $n\sum_{i=0}^{\log n-1}(\log n-i)=n\cdot\frac{\log n(\log n+1)}2=\Theta(n\log^2n)$؛ گزینهٔ ۳.`),
      t(String.raw`دام تست: گزینهٔ ۲ جواب $T(n)=2T(\frac n2)+n$ است. اینجا جملهٔ اضافه یک $\log$ بیشتر دارد و همین $\log$ به جواب اضافه می‌شود.`),
    ],
  },
  "kunkurcomputer-q-1209-1382-b0-094": {
    answer: 2,
    hint: "کدام یک با برنامه‌ریزی پویا در زمانی چندجمله‌ای بر حسب طول ورودی حل می‌شود؟",
    shortcut: String.raw`طولانی‌ترین زیررشتهٔ مشترک (LCS) با جدول برنامه‌ریزی پویا در $O(mn)$ حل می‌شود؛ گزینهٔ ۲.`,
    solution: [
      t(String.raw`گزینهٔ ۲: برای دو رشته به طول $m$ و $n$، جدول $c[i][j]$ را پر می‌کنیم: اگر دو حرف آخر برابر باشند $c[i][j]=c[i-1][j-1]+1$ و گرنه $\max(c[i-1][j],c[i][j-1])$. جدول $mn$ خانه دارد و هر خانه در $O(1)$ پر می‌شود: $O(mn)$، چندجمله‌ای.`),
      t(String.raw`گزینهٔ ۱: دور هامیلتونی NP-کامل است و الگوریتم چندجمله‌ای برایش شناخته نیست؛ بهترین روش‌های دقیق نمایی‌اند (مثلاً $O(n^22^n)$ با برنامه‌ریزی پویا روی زیرمجموعه‌ها).`),
      t(String.raw`گزینهٔ ۳: کوله‌پشتی ۰/۱ با برنامه‌ریزی پویا در $O(nW)$ حل می‌شود، ولی $W$ عدد ظرفیت است نه طول ورودی؛ ظرفیت با $\log W$ بیت نوشته می‌شود، پس این زمان بر حسب طول ورودی نمایی است (شبه‌چندجمله‌ای). خود مسئله NP-کامل است.`),
      t(String.raw`گزینهٔ ۴: فیبوناچی بازگشتیِ ساده $T(n)=T(n-1)+T(n-2)+1$ را دارد که $\Theta(\varphi^n)$ با $\varphi\approx1.618$ است؛ نمایی.`),
    ],
  },
  "kunkurcomputer-q-1209-1384-b0-061": {
    answer: 3,
    hint: String.raw`$x^y$ را از روی $x^{\lfloor y/2\rfloor}$ بساز.`,
    shortcut: String.raw`توان‌رسانی با مربع‌کردن: $x^y=(x^{y/2})^2$ (و یک ضرب اضافه برای $y$ فرد). هر بار نما نصف می‌شود، پس $O(\log n)$ با $n$ همان نما؛ گزینهٔ ۳.`,
    solution: [
      t(String.raw`الگوریتم بازگشتی: اگر $y=0$ جواب ۱ است. وگرنه $z=x^{\lfloor y/2\rfloor}$ را یک بار حساب می‌کنیم؛ اگر $y$ زوج باشد جواب $z\cdot z$ و اگر فرد باشد $z\cdot z\cdot x$ است.`),
      t(String.raw`هر فراخوانی یک زیرمسئله با نمای نصف و تعداد ثابتی ضرب دارد: $T(n)=T(\frac n2)+O(1)$ که جوابش $O(\log n)$ است ($n$ نمای توان است).`),
      t(String.raw`دام تست: اگر $x^{\lfloor y/2\rfloor}$ را دو بار جداگانه صدا بزنیم، رابطه $T(n)=2T(\frac n2)+O(1)$ و زمان $O(n)$ می‌شود، یعنی همان ضرب ساده؛ نکته این است که زیرمسئله یک بار حل شود.`),
    ],
  },
  "kunkurcomputer-q-1209-1386-309-098": {
    answer: 2,
    hint: String.raw`$\log_{99}100$ را با ۱ مقایسه کن و ببین $n\lg n$ از $n^{\log_{99}100}$ کوچک‌تر است یا بزرگ‌تر.`,
    shortcut: String.raw`$n^{\log_{99}100}\approx n^{1.0022}$ چندجمله‌ای بزرگ‌تر از $\lg(n!)=\Theta(n\lg n)$ است، پس حالت اول قضیهٔ اصلی: $\Theta(n^{\lg100/\lg99})$؛ گزینهٔ ۲.`,
    solution: [
      t(String.raw`$a=100$، $b=99$ و $f(n)=\lg(n!)=\Theta(n\lg n)$. توان بحرانی $\log_{99}100=\frac{\lg100}{\lg99}$ است که کمی بیشتر از ۱ است (حدود $1.0022$).`),
      t(String.raw`برای $\varepsilon=0.001$ داریم $n\lg n=O(n^{1.0022-\varepsilon})$، چون $\lg n$ از هر توان مثبتی از $n$ کندتر رشد می‌کند. پس $f(n)$ چندجمله‌ای از $n^{\log_ba}$ کوچک‌تر است و حالت اول قضیهٔ اصلی برقرار است.`),
      t(String.raw`جواب: $T(n)=\Theta(n^{\log_{99}100})=\Theta(n^{\frac{\lg100}{\lg99}})$؛ گزینهٔ ۲.`),
      t(String.raw`دام تست: چون $\frac{100}{99}\approx1$ وسوسه می‌شویم توان را ۱ بگیریم و گزینهٔ ۳ یا ۴ را بزنیم. فاصلهٔ ۰٫۰۰۲۲ کوچک است ولی چندجمله‌ای است و از هر توان $\lg n$ بیشتر رشد می‌کند.`),
    ],
  },
  "kunkurcomputer-q-1209-1390-372B-057": {
    answer: 2,
    hint: String.raw`کسر $\frac{k-1}{k(k+1)}$ را به کسرهای جزئی بشکن.`,
    shortcut: String.raw`برای $k$ بزرگ $\frac{k-1}{k(k+1)}\approx\frac1k$، پس $T(n)$ مثل سری هارمونیک رشد می‌کند: $\Theta(\ln n)$. دقیق‌ترین کران بین گزینه‌ها $O(\ln n)$ است؛ گزینهٔ ۲.`,
    solution: [
      t(String.raw`با باز کردن رابطه: $T(n)=\sum_{k=1}^n\frac{k-1}{k(k+1)}$. کسر جزئی: $\frac{k-1}{k(k+1)}=\frac2{k+1}-\frac1k$.`),
      t(String.raw`پس $T(n)=2\sum_{k=1}^n\frac1{k+1}-\sum_{k=1}^n\frac1k=2(H_{n+1}-1)-H_n=H_n+\frac2{n+1}-2$، و چون $H_n=\ln n+O(1)$ داریم $T(n)=\Theta(\ln n)$.`),
      t(String.raw`گزینه‌های ۱ و ۴ هم از نظر ریاضی درست‌اند ($\ln n$ از $\sqrt n$ و $n$ کندتر رشد می‌کند)، ولی کران دقیق نیستند؛ گزینهٔ ۳ نادرست است چون $T(n)$ به صفر نمی‌رود. سؤال «مناسب‌تر» را می‌خواهد، یعنی دقیق‌ترین کران: گزینهٔ ۲.`),
    ],
  },
  "kunkurcomputer-q-1209-1390-372B-085": {
    answer: 4,
    hint: String.raw`قضیهٔ اصلی اینجا کار نمی‌کند؛ کار هر سطح درخت بازگشت را بنویس.`,
    shortcut: String.raw`سطح $i$ام کار $\frac n{\log n-i}$ دارد. جمع روی سطوح $n(1+\frac12+\dots+\frac1{\log n})=n\,H_{\log n}=\Theta(n\log\log n)$؛ گزینهٔ ۴.`,
    solution: [
      t(String.raw`با $a=b=2$ توان بحرانی $n^{\log_22}=n$ است و $f(n)=\frac n{\log n}$ از $n$ کوچک‌تر است، اما فقط با ضریب $\log n$ و نه با یک توان $n^\varepsilon$. پس حالت اول قضیهٔ اصلی برقرار نیست و باید مستقیم حساب کنیم.`),
      t(String.raw`در سطح $i$ام درخت بازگشت $2^i$ زیرمسئله به اندازهٔ $\frac n{2^i}$ داریم و هر کدام $\frac{n/2^i}{\log(n/2^i)}$ کار می‌کند؛ کار کل سطح $\frac n{\log n-i}$ است.`),
      t(String.raw`جمع برای $i=0,\dots,\log n-1$ با تغییر متغیر $j=\log n-i$: $n\sum_{j=1}^{\log n}\frac1j=n\,H_{\log n}=\Theta(n\log\log n)$. برگ‌ها هم فقط $\Theta(n)$ اضافه می‌کنند. جواب: گزینهٔ ۴.`),
      t(String.raw`نکتهٔ تستی: اگر جملهٔ اضافه $n$ بود جواب $n\log n$ می‌شد؛ تقسیم آن بر $\log n$، سری $\log n$ جملهٔ برابر را به سری هارمونیک تبدیل می‌کند و $\log n$ به $\log\log n$ تبدیل می‌شود.`),
    ],
  },
  "kunkurcomputer-q-1209-1391-368C-064": {
    answer: 1,
    hint: "جفت‌های ماه nام دو دسته‌اند: آن‌هایی که ماه قبل هم بودند، و نوزادهای این ماه. نوزادها از کدام جفت‌ها به دنیا می‌آیند؟",
    shortcut: String.raw`همهٔ جفت‌های ماه قبل می‌مانند ($f(n-1)$) و هر جفتی که دو ماه پیش بود حالا یک جفت نوزاد می‌آورد ($f(n-2)$): فیبوناچی با $f(1)=f(2)=1$؛ گزینهٔ ۱.`,
    solution: [
      t(String.raw`جفتی که در ماه $m$ به دنیا بیاید، ماه $m+1$ بالغ می‌شود و از ماه $m+2$ هر ماه یک جفت می‌زاید. پس در شروع ماه $n$ دقیقاً جفت‌هایی می‌زایند که در ماه $n-2$ وجود داشتند.`),
      t(String.raw`خرگوش‌ها نمی‌میرند، پس $f(n)=f(n-1)+f(n-2)$: جفت‌های ماه قبل به‌اضافهٔ نوزادهای این ماه.`),
      t(String.raw`شرایط اولیه: ماه ۱ یک جفت نوزاد داریم ($f(1)=1$)؛ ماه ۲ همان جفت بالغ شده ولی هنوز نزاییده ($f(2)=1$)؛ ماه ۳ اولین نوزاد می‌آید ($f(3)=2$). این دقیقاً گزینهٔ ۱ است.`),
      t(String.raw`گزینهٔ ۲ ($f(n)=2f(n-1)$) فرض می‌کند همهٔ جفت‌ها، حتی نوزادها، همان ماه بزایند؛ دنباله‌اش ۱، ۲، ۴ است و با $f(2)=1$ نمی‌خواند.`),
    ],
  },
};
