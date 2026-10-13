// Worked solutions of the 1404 master's exam, computer engineering (1277),
// booklet 335C, for the subjects that remain in the 1406 exam. Stems and
// options were checked against the booklet pages
// (outputs/completion_review/source_pages/doc-aa34d7e9ba352ebc-pNN.jpg,
// 2026-10-14). Keys: Sanjesh's key for 335C (an initial key sheet; no question
// was deleted or given two keys). Differences from the bank are logged in
// bank-corrections.md.
//
// `image`: the booklet crop of the whole question, shipped as an asset for the
// questions that need their figure.

export const YEAR = 1404;
export const BOOKLET = "335C";
export const DOC = "doc-aa34d7e9ba352ebc";

export const SUBJECTS = {
  english: { title: "زبان عمومی و تخصصی", slug: "english", code: "english", range: "۱ تا ۲۵" },
  statistics: { title: "آمار و احتمال مهندسی", slug: "statistics", code: "statistics", range: "۳۳ تا ۳۹" },
  discrete: { title: "ریاضیات گسسته", slug: "discrete-math", code: "discrete-math", range: "۴۰ تا ۴۵" },
  automata: { title: "نظریه زبان‌ها و ماشین‌ها", slug: "automata", code: "automata", range: "۴۶ تا ۵۰" },
  dsa: { title: "داده‌ساختارها و الگوریتم‌ها", slug: "data-structures-algorithms", code: "data-structures-algorithms", range: "۵۶ تا ۶۷" },
  ai: { title: "هوش مصنوعی", slug: "artificial-intelligence", code: "artificial-intelligence", range: "۶۸ تا ۷۵" },
  logic: { title: "مدارهای منطقی", slug: "digital-logic", code: "digital-logic", range: "۷۶ تا ۸۲" },
  architecture: { title: "معماری کامپیوتر", slug: "computer-architecture", code: "computer-architecture", range: "۸۳ تا ۸۹" },
  os: { title: "سیستم‌های عامل", slug: "operating-systems", code: "operating-systems", range: "۹۶ تا ۱۰۲" },
};

/** Questions whose subjects left the exam in 1406: not solved here. */
export const DROPPED = [
  ["ریاضی عمومی ۱ و ۲", "۲۶ تا ۳۲"],
  ["سیگنال‌ها و سیستم‌ها", "۵۱ تا ۵۵"],
  ["الکترونیک دیجیتال", "۹۰ تا ۹۵"],
  ["شبکه‌های کامپیوتری", "۱۰۳ تا ۱۰۸"],
  ["پایگاه داده‌ها", "۱۰۹ تا ۱۱۵"],
];

export const PASSAGES = {
  cloze: {
    before: 8,
    title: "متن Cloze Test (سؤال‌های ۸ تا ۱۰)",
    text: "Before the 1970s, the Olympic Games were officially limited to competitors with amateur status, but in the 1980s, many events ……(8) to professional athletes. Currently, the Games are open to all, even the top professional athletes in basketball and football. The ancient Olympic Games included several of the sports ……(9) of the Summer Games program, which at times has included events in as many as 32 different sports. In 1924, the Winter Games were sanctioned for winter sports. ……(10) regarded as the world's foremost sports competition.",
  },
  p1: {
    before: 11,
    title: "Passage 1 (سؤال‌های ۱۱ تا ۱۵)",
    text: "The emergence of computers and the Internet is among the most technological advances that has happened in the twentieth century. Individuals have gained greater access to information of all sorts, and the gap that exists between technology and human intellect is getting thinner. As societies utilize the technology in various fields, some new ethical concerns have arisen. Extensive use of the technology has also made possible potentially unethical activities such as violation of individual privacy and other illegal forays into private network spaces. Not all network users are honest individuals, and not all of them adhere to ethical standards of moral behavior.\nSome computer users keep a large amount of their personal information on their computer systems or on the network spaces in social media. The use of social media is on the rise. As a result of this, hackers and other intruders have a greater opportunity to access private data, and use them for unlawful purposes. These concerns contributed to the rise of a field known as computer ethics which deals with the procedures, values and practices that govern the process of consuming computing technology and its related disciplines in a way that does not damage or violate the moral values and beliefs of any individual, organization or society.",
  },
  p2: {
    before: 16,
    title: "Passage 2 (سؤال‌های ۱۶ تا ۲۰)",
    text: "The first “computers” were ancient tools that were used to do addition, subtraction, multiplication, and division. Some early examples of this would be the ancient Chinese invention known as the abacus. These older tools were in a sense computers because they did what modern computers do: take information and turn it into logical operations. Logical operations are instructions that someone gives a computer and tells it what to do. Older tools still required humans to do things to make them work. But modern computers use power and can be programmed to do things automatically.\nThe first computer, as we would think of one today, was created in 1823 by a man named Charles Babbage in England. Charles Babbage invented all the parts that are now used for a modern computer. He called the machine he was working on the “Difference Engine” but unfortunately he never finished it. Ten years later, another man named George Scheutz read about the “Difference Engine” and was excited about what Babbage had been working on. Together with his son Edward, Scheutz began to work on a smaller version. Twenty years later, by 1853, the father and son had constructed a machine that could process 15-digit numbers and calculate fourth-order differences. This was very advanced programming for a machine at that time. Their machine won a gold medal at the Exhibition of Paris in 1855, and later they sold it to the Dudley Observatory in Albany, New York. The Dudley Observatory later used it to calculate the path to the planet Mars.",
  },
  p3: {
    before: 21,
    title: "Passage 3 (سؤال‌های ۲۱ تا ۲۵)",
    text: "Quantum computation is a field of much interest and activity. Much of the interest was stimulated by Shor’s discovery that there is a quantum computation algorithm for the integer factoring problem that is more efficient than any known classical algorithm. [1] This result has stimulated much work that represents steps in the long-term goal of physical construction of quantum computers. This includes work on quantum error-correction codes and physical models of quantum gates, quantum Hall systems, and nuclear magnetic resonance to carry out parallel quantum computation.\nThe optimism about reaching the long-term goal that is implicit in this work is tempered by the work of Landauer. [2] As a critic, Landauer correctly points out the enormous obstacles in the path of construction of efficient quantum computers. These include effects of environmental noise with respect to which quantum computers are exquisitely sensitive, errors in constructing the Hamiltonian, and errors in constructing the initial state. As Landauer notes, these errors can cause unwanted reflections of the computational process that reduce the amplitude of the transmitted component that represents the completed computation. Work in which potential barriers causing reflection are introduced intentionally where the potential distribution is ‘deterministically disordered’, suggests that in some cases, these problems may be less severe than otherwise thought.\nBuilding quantum computers is incredibly difficult. Many candidate qubit systems exist on the scale of single atoms, and the physicists, engineers, and materials scientists who are trying to execute quantum operations on these systems constantly deal with two competing requirements. [3] First, qubits need to be protected from the environment because it can destroy the delicate quantum states needed for computation. The longer a qubit survives in its desired state the longer its “coherence time.” From this perspective, isolation is prized. Second, however, for algorithm execution qubits need to be entangled, shuffled around physical architectures, and controllable on demand. The better these operations can be carried out the higher their “fidelity.” [4]",
  },
};

const Q = (n, subject, answer, stem, options, solution, extra = {}) => ({ n, subject, answer, stem, options, solution, ...extra });
const E = (n, answer, stem, options, solution) => Q(n, "english", answer, stem, options, solution);

export const QUESTIONS = [
  // ------------------------------------------------------------- زبان (۱ تا ۲۵)
  E(1, 4, "One theory holds that humans became highly ………… because evolution selected those of our forefathers who were especially good at solving problems.", ["successive", "concerned", "passionate", "intelligent"],
    "کلید جمله آخر آن است: تکامل نیاکانی را برگزید که در «حل مسئله» خوب بودند؛ نتیجه‌اش انسانِ بسیار «باهوش» است. intelligent یعنی باهوش؛ successive (پی‌درپی)، concerned (نگران) و passionate (پرشور) با حل مسئله ربطی ندارند."),
  E(2, 1, "Is it true that the greenhouse …………, the feared heating of the earth's atmosphere by burning coal and oil, is just another false alarm?", ["effect", "energy", "force", "warmth"],
    "«greenhouse effect» (اثر گلخانه‌ای) یک ترکیب ثابت است و بدل بعد از آن (گرم شدن جو زمین با سوزاندن زغال و نفت) دقیقاً تعریف همین اثر است."),
  E(3, 3, "In most people, the charitable and ………… motives operate in some reasonable kind of balance.", ["obvious", "high", "selfish", "prime"],
    "جمله از «تعادل» میان دو انگیزه حرف می‌زند، پس جای خالی باید نقطهٔ مقابل charitable (نیکوکارانه) باشد: selfish یعنی خودخواهانه."),
  E(4, 2, "Whatever the immediate ………… of the Nigerian-led intervention, West African diplomats said the long-term impact of recent events in Sierra Leone would be disastrous.", ["reciprocity", "outcome", "reversal", "meditation"],
    "«immediate …» در برابر «long-term impact» آمده است: نتیجهٔ فوری در مقابل اثر بلندمدت. outcome یعنی نتیجه؛ reciprocity (معامله به مثل)، reversal (وارونگی) و meditation (تأمل) معنا را نمی‌سازند."),
  E(5, 3, "The last thing I would wish to do is to ………… a sense of ill will, deception or animosity in an otherwise idyllic environment.", ["postpone", "accuse", "foster", "divest"],
    "«آخرین کاری که می‌خواهم بکنم این است که حس بدخواهی و دشمنی را … کنم» یعنی نمی‌خواهم آن را پرورش دهم و دامن بزنم: foster. accuse مفعولِ «حس» نمی‌گیرد و postpone (به تعویق انداختن) و divest (سلب کردن) معنا ندارند."),
  E(6, 4, "While the movie offers unsurpassed action, ………… script makes this the least of the three \"Die Hards.\"", ["an auspicious", "a stirring", "an edifying", "a feeble"],
    "While تضاد می‌سازد: اکشن بی‌نظیر است، ولی فیلمنامه باعث شده این فیلم ضعیف‌ترین «جان‌سخت» باشد. پس فیلمنامه «ضعیف» است: a feeble. سه گزینهٔ دیگر (فرخنده، هیجان‌انگیز، آموزنده) مثبت‌اند."),
  E(7, 2, "Relations between Communist China and the Soviet Union have unfortunately begun to ………… again after a period of relative restraint in their ideological quarrel. We can only hope that common sense prevails again.", ["ameliorate", "deteriorate", "solemnize", "petrify"],
    "unfortunately و «امیدواریم عقل سلیم دوباره غالب شود» نشان می‌دهد روابط دوباره «بدتر» شده است: deteriorate. ameliorate درست برعکس، یعنی بهتر شدن است."),
  E(8, 3, "Choose the best option for blank (8) in the passage above.", ["to be opened", "that were opening", "were opened", "opening"],
    "جمله بعد از but فعل اصلی ندارد: «many events … to professional athletes». رویدادها را «باز کردند»، پس مجهول گذشته لازم است: were opened. گزینه‌های ۱ و ۴ فعل اصلی نیستند و ۲ معلوم است و جمله را ناقص می‌گذارد."),
  E(9, 1, "Choose the best option for blank (9) in the passage above.", ["that are now part", "which now being part", "now are parts", "had now been parts"],
    "جای خالی صفت «the sports» است: ورزش‌هایی که «اکنون بخشی از» برنامهٔ بازی‌های تابستانی‌اند. جملهٔ موصولی کامل: that are now part. گزینهٔ ۲ فعل ندارد، ۳ بدون موصول جمله را می‌شکند و زمان ۴ (ماضی بعید) با now نمی‌خواند."),
  E(10, 2, "Choose the best option for blank (10) in the passage above.", ["The Olympic Games came to have been", "The Olympic Games have come to be", "The fact is the Olympic Games to be", "That the Olympic Games have been"],
    "جمله با «regarded as» ادامه پیدا می‌کند و فاعل و فعل کامل می‌خواهد: «بازی‌های المپیک (به‌مرور) به‌عنوان مهم‌ترین رقابت ورزشی جهان شناخته شده‌اند» یعنی have come to be regarded. گزینهٔ ۴ با That جمله را به یک بند وابستهٔ بی‌فعل تبدیل می‌کند."),
  E(11, 3, "The underlined word “utilize” in paragraph 1 is closest in meaning to ………… .", ["produce", "improve", "employ", "analyze"],
    "utilize یعنی به کار بردن و استفاده کردن؛ هم‌معنی آن employ است."),
  E(12, 4, "The underlined word “them” in paragraph 1 refers to ………… .", ["standards", "network spaces", "activities", "network users"],
    "«Not all network users are honest individuals, and not all of them adhere to ethical standards»: آن‌ها همان کاربران شبکه‌اند که بعضی‌شان به اصول اخلاقی پایبند نیستند."),
  E(13, 2, "According to paragraph 1, the appearance of the computer technology and the internet in the 20th century ………… .", ["fully closed the gap that once existed between technology and human intellect", "in a way resulted in some new questions about their ethical dimensions", "increased the gap between ethical and unethical usage of data", "prevented any opportunity of unethical usage of private data"],
    "پاراگراف می‌گوید با استفادهٔ جامعه از این فناوری «نگرانی‌های اخلاقی تازه‌ای» پیدا شد؛ یعنی گزینهٔ ۲. گزینهٔ ۱ اغراق است (متن می‌گوید فاصله «کمتر» می‌شود، نه اینکه کاملاً بسته شد) و ۴ برعکس متن است."),
  E(14, 3, "All of the following words are mentioned in the passage EXCEPT ………… .", ["unlawful", "moral", "cutting-edge", "honest"],
    "unlawful (unlawful purposes)، moral (moral behavior و moral values) و honest (honest individuals) در متن هست؛ cutting-edge نیامده است."),
  E(15, 1, "According to the passage, which of the following statements is true?", ["Computer ethics was in part developed as a response to the threat posed by hackers and other intruders who do not follow ethical standards.", "Extensive use of the technology has decreased the risk of potentially unethical activities such as violation of individual privacy.", "Hackers utilize computer ethics as an opportunity to employ computing technology and its related disciplines to their own advantage.", "Computer ethics concerns the practices that govern the production of computer units in a way that does not damage the best interest either of corporations or of consumers."],
    "پاراگراف دوم: هکرها و نفوذگرها فرصت بیشتری برای دسترسی به داده‌ها پیدا کردند و «این نگرانی‌ها به پیدایش» اخلاق کامپیوتر کمک کرد؛ یعنی گزینهٔ ۱. گزینهٔ ۲ برعکس متن است و ۴ به‌جای «مصرف» فناوری از «تولید» حرف می‌زند."),
  E(16, 4, "The underlined word “required” in paragraph 1 is closest in meaning to ………… .", ["acted up", "assisted", "empowered", "relied on"],
    "«Older tools still required humans to do things to make them work»: ابزارهای قدیمی برای کار کردن هنوز به انسان «نیاز داشتند و وابسته بودند»؛ نزدیک‌ترین گزینه relied on است."),
  E(17, 1, "The invention known as the abacus was probably a ………… .", ["device", "formula", "game", "sub-discipline"],
    "متن چرتکه را نمونه‌ای از «ابزارهای باستانی» برای جمع و تفریق و ضرب و تقسیم می‌داند؛ پس یک وسیله (device) بوده است."),
  E(18, 2, "According to paragraph 1, ………… .", ["the Chinese were the first people to discover mathematical laws", "early computers were able to do simple mathematical operations", "unlike older tools, modern computers do not require logical operations", "logical operations refer to a unique approach to manufacturing computers"],
    "جملهٔ اول پاراگراف: نخستین «کامپیوترها» ابزارهایی برای جمع و تفریق و ضرب و تقسیم بودند؛ یعنی عملیات ساده ریاضی. گزینهٔ ۱ در متن نیست و ۳ و ۴ با تعریف متن از عملیات منطقی نمی‌خوانند."),
  E(19, 2, "According to paragraph 2, which of the following statements is true?", ["George Scheutz coined the term “Difference Engine” in 1853.", "George Scheutz’s machine was used for astronomical calculations.", "Babbage invented the first modern computer at the beginning of the 18th century.", "Babbage won the gold medal at the Exhibition of Paris for his “Difference Engine.”"],
    "رصدخانهٔ دادلی ماشین شویتز را خرید و با آن مسیر سیارهٔ مریخ را حساب کرد؛ یعنی محاسبات نجومی. نام «Difference Engine» را بابیج گذاشت، ماشین او در ۱۸۲۳ (قرن نوزدهم) بود و مدال طلا را ماشین شویتز گرفت."),
  E(20, 4, "The passage provides sufficient information to answer which of the following questions?\nI. In which country was the first computer as we think of it produced?\nII. In what sense were older tools similar to computers?\nIII. How long is the distance to the planet Mars?", ["Only I", "Only II", "I and III", "I and II"],
    "I: انگلستان (بابیج). II: ابزارهای قدیمی هم اطلاعات را می‌گرفتند و به عملیات منطقی تبدیل می‌کردند. III: متن فقط می‌گوید مسیر مریخ حساب شد، نه فاصله‌اش. پس I و II."),
  E(21, 3, "Which of the following techniques is used in paragraph 1?", ["Definition", "Statistics", "Cause and effect", "Rhetorical question"],
    "پاراگراف اول زنجیرهٔ علت و معلول است: کشف شور «باعث» علاقه شد و این نتیجه «باعث» کارهای زیادی در ساخت کامپیوتر کوانتومی شد (stimulated دو بار آمده است)."),
  E(22, 2, "According to paragraph 2, which of the following is true about Landauer?", ["His ideas ultimately led to solutions for many of the problems of quantum computation.", "His work highlighted the challenges facing the construction of efficient quantum computers.", "He later admitted that the challenges facing quantum computation were negligible.", "He drew attention to the impossibility of constructing quantum computers."],
    "لنداور «موانع بزرگ» ساخت کامپیوتر کوانتومی کارآمد را نشان داد؛ گزینهٔ ۲. او نگفت ساختش «ناممکن» است (گزینهٔ ۴ اغراق است) و راه‌حل‌ها را هم کار دیگران پیشنهاد کرد."),
  E(23, 1, "What does paragraph 3 mainly discuss?", ["The difficulty of constructing quantum computers", "Competing models of computation using quantum technology", "The last challenge to overcome in building quantum computers", "Qubit efficiency and a ground-breaking solution to its optimum realization"],
    "پاراگراف با «Building quantum computers is incredibly difficult» شروع می‌شود و دو نیاز متضاد (جداسازی و تعامل کیوبیت‌ها) را توضیح می‌دهد؛ موضوع اصلی همان دشواری ساخت است. «competing» در متن صفت نیازهاست، نه مدل‌های محاسبه."),
  E(24, 3, "According to the passage, which of the following statements is true?", ["Quantum computers are particularly versatile because qubits are highly robust and efficient in diverse environmental conditions.", "Shor's ideas about different computational methods were highly influential in the development of early traditional computers.", "In quantum computers, qubits must be rearranged across physical architectures, and controllable as needed for algorithms to work.", "Landauer was a computer manufacturer who identified many problems in the field, and his ideas paved the way for transition from classical to quantum computation."],
    "«for algorithm execution qubits need to be entangled, shuffled around physical architectures, and controllable on demand» همان گزینهٔ ۳ است. گزینهٔ ۱ برعکس متن است (کیوبیت‌ها به محیط بسیار حساس‌اند)."),
  E(25, 1, "In which position marked by [1], [2], [3] or [4], can the following sentence best be inserted in the passage?\nBalancing the required isolation and interaction is difficult, but after decades of research a few systems are emerging as top candidates for large-scale quantum information processing.", ["[4]", "[3]", "[2]", "[1]"],
    "جمله از «ایجاد تعادل میان جداسازی و تعامل» حرف می‌زند؛ پس باید بعد از توضیح هر دو نیاز بیاید، یعنی آخر پاراگراف سوم: جایگاه [4] که گزینهٔ ۱ است. در [3] هنوز این دو نیاز معرفی نشده‌اند."),

  // ------------------------------------------------- آمار و احتمال (۳۳ تا ۳۹)
  Q(33, "statistics", 2, "اطلاعات زیر، برای یک مجموعه داده حاصل شده است. چه تعداد نقاط دورافتاده در این مجموعه است؟\nنقاط کمتر از چارک اول: ۷، ۹، ۱۰ — چارک اول: ۱۵/۵ — میانه: ۲۰ — چارک سوم: ۲۱/۵ — نقاط بزرگ‌تر از چارک سوم: ۲۸، ۳۰، ۳۱", ["۰", "۱", "۲", "۳"],
    String.raw`دامنهٔ میان‌چارکی $IQR=Q_3-Q_1=21.5-15.5=6$ است. با قاعدهٔ معمول $1.5\times IQR=9$، مرزها می‌شوند $15.5-9=6.5$ و $21.5+9=30.5$.
از نقاط پایین، ۷ و ۹ و ۱۰ همه بالای $6.5$ هستند؛ از نقاط بالا فقط ۳۱ از $30.5$ بزرگ‌تر است. پس یک نقطهٔ دورافتاده داریم: گزینهٔ ۲.`),
  Q(34, "statistics", 1, "یک فروشگاه سه برند مختلف A، B و C از یک کالا را می‌فروشد. تابع احتمال خرید هریک از برندها در جدول زیر آمده است. احتمال این‌که دو مشتری برند C را خریداری کنند و احتمال این‌که دقیقاً یکی از آنها برند C را خریداری کند، به‌ترتیب کدام است؟\nبرند A: ۰/۱۵ — برند B: ۰/۶۵ — برند C: ۰/۲", ["۰/۰۴ و ۰/۳۲", "۰/۰۴ و ۰/۱۶", "۰/۴ و ۰/۳۲", "۰/۴ و ۰/۱۶"],
    String.raw`خرید دو مشتری مستقل است و هر کدام با احتمال $0.2$ برند C را می‌خرد. هر دو: $0.2^2=0.04$. دقیقاً یکی: دو حالت (اولی بخرد و دومی نه، یا برعکس)، پس $2\times0.2\times0.8=0.32$. گزینهٔ ۱.
دام تستی گزینهٔ ۲: فقط یکی از دو حالت را حساب کرده است ($0.2\times0.8=0.16$).`),
  Q(35, "statistics", 3, "یک سیستم امنیتی کامپیوتری با احتمال ۰/۰۲ حملات غیرواقعی را واقعی و با احتمال ۰/۰۱ حملات واقعی را غیرواقعی تشخیص می‌دهد. اگر ۰/۱٪ از کل درخواست‌های ورودی، حملات واقعی باشند، احتمال این‌که حملهٔ تشخیص‌داده‌شده واقعی باشد، کدام است؟", ["۰/۰۰۱", "۰/۰۲۳", "۰/۰۴۷", "۰/۰۵۶"],
    String.raw`قضیهٔ بیز. احتمال پیشین حملهٔ واقعی $P(R)=0.001$ است (۰/۱ درصد). سیستم حملهٔ واقعی را با احتمال $1-0.01=0.99$ درست تشخیص می‌دهد و درخواست سالم را با احتمال $0.02$ به‌اشتباه حمله می‌داند.
$P(D)=0.001\times0.99+0.999\times0.02=0.00099+0.01998=0.02097$
$P(R\mid D)=\dfrac{0.00099}{0.02097}\approx0.047$؛ گزینهٔ ۳.
نکته: با اینکه سیستم ۹۹٪ دقیق است، کمتر از ۵٪ هشدارهایش واقعی‌اند، چون حمله‌های واقعی بسیار نادرند.`),
  Q(36, "statistics", 3, String.raw`فرض کنید $X_1$ و $X_2$ متغیرهای تصادفی مستقل و دارای توزیع نمایی با میانگین ۴ باشند. اگر $Y=\max(X_1,X_2)$ آنگاه $E(Y)$ کدام است؟`, ["۲", "۴", "۶", "۱۲"],
    String.raw`کمینهٔ دو نمایی مستقل با نرخ $\lambda=\frac14$ نمایی با نرخ $2\lambda$ است، پس $E(\min)=\frac42=2$. چون $\max+\min=X_1+X_2$، داریم $E(\max)=4+4-2=6$؛ گزینهٔ ۳.
راه دیگر با بی‌حافظگی: تا اولین رخداد به‌طور متوسط ۲ صبر می‌کنیم و بعد دیگری به‌طور متوسط ۴ دیگر طول می‌کشد: $2+4=6$.`),
  Q(37, "statistics", 4, String.raw`یک شرکت نرم‌افزاری، زمان پردازش یک الگوریتم را اندازه‌گیری می‌کند. در یک نمونهٔ ۳۶ تایی، میانگین زمان پردازش $\bar x=72$ میلی‌ثانیه و انحراف معیار $s=8$ میلی‌ثانیه است. فاصلهٔ اطمینان ۹۵٪ برای میانگین واقعی زمان پردازش کدام است؟ (عدد جدول را ۱/۹۶ درنظر بگیرید.)`, ["(۶۹/۴۹ و ۷۳/۵۳)", "(۷۰/۴۷ و ۷۳/۵۳)", "(۷۱/۴۸ و ۷۲/۵۲)", "(۶۹/۳۹ و ۷۴/۶۱)"],
    String.raw`نمونه بزرگ است و از تقریب نرمال استفاده می‌کنیم: $\bar x\pm z\,\frac{s}{\sqrt n}=72\pm1.96\times\frac86=72\pm2.61$، یعنی $(69.39,\ 74.61)$؛ گزینهٔ ۴.
فاصله باید دور ۷۲ متقارن باشد؛ گزینه‌های ۱ و ۲ متقارن نیستند و همین کافی است تا کنار بروند.`),
  Q(38, "statistics", 1, String.raw`فرض کنید متغیر تصادفی X دارای توزیع زیر باشد. می‌خواهیم آزمون $H_0:\theta=5$ را در مقابل $H_1:\theta=2$ انجام دهیم. اگر $x<0.3$ مشاهده شود، فرض $H_0$ رد می‌شود. خطای نوع اول و توان آزمون به‌ترتیب کدام هستند؟
$f_X(x)=\theta x^{\theta-1},\quad 0<x<1,\quad \theta>0$`, [String.raw`$(0.3)^5$ و $(0.3)^2$`, String.raw`$1-(0.3)^5$ و $(0.3)^2$`, String.raw`$(0.3)^5$ و $1-(0.3)^2$`, String.raw`$1-(0.3)^5$ و $1-(0.3)^2$`],
    String.raw`تابع توزیع تجمعی $F(x)=x^\theta$ است. خطای نوع اول احتمال رد $H_0$ وقتی درست است: $P(X<0.3\mid\theta=5)=0.3^5$. توان آزمون احتمال رد $H_0$ وقتی $H_1$ درست است: $P(X<0.3\mid\theta=2)=0.3^2$. گزینهٔ ۱.`),
  Q(39, "statistics", 2, String.raw`یک تیم مهندسی قصد دارد زمان تکمیل پروژه‌ای را با استفاده از یک مدل رگرسیون پیش‌بینی کند. مدل رگرسیونی زیر برازش داده شده است.
$y=120-4x_1+0.05x_2-8x_3$
که در آن، y زمان تکمیل پروژه (برحسب روز)، $x_1$ تعداد اعضای تیم، $x_2$ خطوط کد (برحسب هزار خط) و $x_3$ تجربهٔ تیم (برحسب سال) است. کدام مورد درخصوص هر ضریب با فرض ثابت بودن سایر ضرایب، درست نیست؟`, ["با افزایش هر سال تجربهٔ تیم، زمان تکمیل پروژه ۸ روز کاهش می‌یابد.", "افزایش ۱۰۰۰ خط کد به پروژه، زمان تکمیل پروژه را تغییر نمی‌دهد.", "افزایش یک واحد در تعداد اعضای تیم، زمان پروژه را ۴ روز کاهش می‌دهد.", "افزایش ۶۰۰۰۰ خط کد به پروژه، زمان تکمیل پروژه را ۳ روز افزایش می‌دهد."],
    String.raw`هر ضریب، تغییر y به‌ازای یک واحد افزایش همان متغیر است. $x_2$ برحسب هزار خط است، پس ۱۰۰۰ خط یعنی یک واحد و زمان را $0.05$ روز زیاد می‌کند؛ کم است ولی صفر نیست. پس گزینهٔ ۲ نادرست است.
بقیه درست‌اند: ۸ روز کمتر برای هر سال تجربه، ۴ روز کمتر برای هر عضو بیشتر، و ۶۰۰۰۰ خط یعنی ۶۰ واحد: $60\times0.05=3$ روز بیشتر.`),

  // ------------------------------------------------------ ریاضیات گسسته (۴۰ تا ۴۵)
  Q(40, "discrete", 3, "در قطعه‌برنامهٔ زیر، دستور x++ چند بار اجرا می‌شود؟\n```c\nx = 0;\nfor(i = 1; i <= n; i++)\n    for(j = 1; j <= i; j++)\n        for(k = 1; k <= j; k++)\n            for(t = 1; t <= k; t++)\n                x++;\n```", [String.raw`$\binom{n+2}{3}$`, String.raw`$\binom{n+4}{3}$`, String.raw`$\binom{n+3}{4}$`, String.raw`$\sum_{i=1}^{n}\sum_{j=1}^{i}\sum_{k=1}^{j}\sum_{t=1}^{k}x$`],
    String.raw`هر بار اجرای x++ یعنی یک چهارتایی $(i,j,k,t)$ با $n\ge i\ge j\ge k\ge t\ge1$. پس باید چهار عدد از ۱ تا n را «با تکرار» و بدون توجه به ترتیب برداریم (ترتیب نزولی خودش یکتاست).
تعداد انتخاب ۴ عضو با تکرار از n عضو: $\binom{n+4-1}{4}=\binom{n+3}{4}$؛ گزینهٔ ۳.
آزمایش سریع: برای $n=1$ دستور یک بار اجرا می‌شود و $\binom44=1$؛ گزینهٔ ۱ هم ۱ می‌دهد، ولی برای $n=2$ شمارش مستقیم ۵ است و فقط $\binom54=5$ درست درمی‌آید.`),
  Q(41, "discrete", 1, "در یک شبکهٔ کامپیوتری ۷ نود (گره) داریم و می‌خواهیم ۱۲ بستهٔ داده را بین این نودها توزیع کنیم به‌طوری‌که هر نود، حداقل ۱ بستهٔ داده دریافت کند، چند روش مختلف برای توزیع بسته‌ها به نودها وجود دارد؟", [String.raw`$\binom{11}{5}$`, String.raw`$\binom{12}{5}$`, String.raw`$\binom{12}{7}$`, String.raw`$\binom{18}{7}$`],
    String.raw`گزینه‌ها نشان می‌دهند بسته‌ها یکسان فرض شده‌اند و فقط تعداد بستهٔ هر نود مهم است: جواب‌های صحیح $x_1+\dots+x_7=12$ با $x_i\ge1$.
روش ستاره و میله: ۱۲ بسته در یک ردیف ۱۱ فاصله دارند و باید ۶ جداکننده در این فاصله‌ها بگذاریم: $\binom{11}{6}=\binom{11}{5}$؛ گزینهٔ ۱.
اگر نودی می‌توانست هیچ بسته‌ای نگیرد، جواب $\binom{12+6}{6}=\binom{18}{6}$ می‌شد؛ گزینهٔ ۴ ($\binom{18}{7}$) حتی آن هم نیست.`),
  Q(42, "discrete", 2, "نقیض گزارهٔ زیر چیست؟\nاگر آن ترک شیرازی به‌دست آرد دل ما را\nبه خال هندویش بخشم سمرقند و بخارا را", ["ترک شیرازی دل ما را به‌دست می‌آورد و به خال هندویش سمرقند و بخارا را نمی‌بخشم.", "ترک شیرازی دل ما را به‌دست می‌آورد و به خال هندویش سمرقند یا بخارا را نمی‌بخشم.", "اگر به خال هندوی ترک شیرازی سمرقند و بخارا را ببخشم آنگاه دل ما را به‌دست می‌آورد.", "ترک شیرازی دل ما را به‌دست نمی‌آورد و به خال هندویش سمرقند و بخارا را نمی‌بخشم."],
    String.raw`گزاره به شکل $p\to(q\wedge r)$ است: $p$ «ترک شیرازی دل ما را به‌دست آورد»، $q$ «سمرقند را می‌بخشم» و $r$ «بخارا را می‌بخشم».
نقیض شرطی: $\neg(p\to s)\equiv p\wedge\neg s$، و با قانون دمورگان $\neg(q\wedge r)\equiv\neg q\vee\neg r$. پس نقیض: «دل ما را به‌دست می‌آورد و سمرقند **یا** بخارا را نمی‌بخشم»؛ گزینهٔ ۲.
دام تستی گزینهٔ ۱: «سمرقند و بخارا را نمی‌بخشم» یعنی هیچ‌کدام را نمی‌بخشد، که قوی‌تر از نقیض است. گزینهٔ ۳ عکس گزاره است و نقیض نیست.`),
  Q(43, "discrete", 2, String.raw`فرض کنید $A=\{1,2,3,4,5\}$ و R یک رابطه روی A باشد که با گراف جهت‌دار زیر نشان داده شده است. کدام مورد درخصوص R صحیح است؟
(چنانچه یالی از گره i به گره j وجود داشته باشد، i با j رابطهٔ R دارد.)`, ["R خاصیت پاد تقارنی دارد.", "R یک رابطهٔ هم‌ارزی است.", "R یک رابطهٔ ترتیب است.", "R خاصیت تعدی ندارد."],
    String.raw`در شکل هر پنج گره حلقه دارند، پس R بازتابی است. هر یال یک یال برگشتی هم دارد ($1\leftrightarrow2$، $1\leftrightarrow3$، $2\leftrightarrow3$ و $4\leftrightarrow5$)، پس متقارن است.
گره‌ها دو دسته‌اند: $\{1,2,3\}$ که هر دو عضوش با هم رابطه دارند، و $\{4,5\}$ که آن هم کامل است؛ بین دو دسته یالی نیست. چنین رابطه‌ای تعدی هم دارد. پس R هم‌ارزی است با دو کلاس $\{1,2,3\}$ و $\{4,5\}$؛ گزینهٔ ۲.
پادتقارنی نیست (۱ با ۲ و ۲ با ۱ رابطه دارند ولی $1\ne2$) و به همین دلیل رابطهٔ ترتیب هم نیست.`, { image: true }),
  Q(44, "discrete", 4, String.raw`اگر $f(x)$ تابع مولد معمولی دنبالهٔ $\{n!\}$ باشد، تابع مولد معمولی دنبالهٔ $\{n(n!)\}$ کدام است؟`, [String.raw`$x\int f(x)$`, String.raw`$xf(x)$`, String.raw`$\dfrac{f(x)}{x}$`, String.raw`$xf'(x)$`],
    String.raw`$f(x)=\sum_{n\ge0} n!\,x^n$. با مشتق‌گیری $f'(x)=\sum n\cdot n!\,x^{n-1}$ و با ضرب در x: $xf'(x)=\sum n\cdot n!\,x^n$، یعنی همان تابع مولد $\{n(n!)\}$؛ گزینهٔ ۴.
قاعدهٔ کلی: اگر $f$ تابع مولد $\{a_n\}$ باشد، $xf'(x)$ تابع مولد $\{na_n\}$ است. گزینهٔ ۲ ($xf(x)$) فقط دنباله را یک خانه جابه‌جا می‌کند.`),
  Q(45, "discrete", 1, String.raw`جواب رابطهٔ بازگشتی روبه‌رو، کدام است؟
$a_n=na_{n-1}+n!,\quad a_1=1$`, [String.raw`$n(n!)$`, "$n$", String.raw`$n^2-1+2^{n-1}$`, String.raw`$n!\,2^{n-1}$`],
    String.raw`دو طرف را بر $n!$ تقسیم می‌کنیم و $b_n=\frac{a_n}{n!}$ می‌گیریم: $b_n=b_{n-1}+1$ با $b_1=1$. پس $b_n=n$ و $a_n=n\cdot n!$؛ گزینهٔ ۱.
آزمایش: $a_2=2\cdot1+2=4=2\cdot2!$ و $a_3=3\cdot4+6=18=3\cdot3!$.`),

  // --------------------------------------------- نظریه زبان‌ها و ماشین‌ها (۴۶ تا ۵۰)
  Q(46, "automata", 3, "کدام‌یک از زبان‌های زیر، منظم است؟", [String.raw`$L=\{a^nb^mc^nd^{2n}\mid 3n+m>5,\ n,m,k,t>0\}$`, String.raw`$L=\{a^nb^tc^kd^t\mid n+2t+k>5,\ n,m,k,t>0\}$`, String.raw`$L=\{a^nb^mc^kd^t\mid n+m+k+t>5,\ n,m,k,t>0\}$`, String.raw`$L=\{a^nb^mc^kd^m\mid n+2m+k>5,\ n,m,k,t>0\}$`],
    String.raw`در گزینهٔ ۳ چهار توان به هم ربطی ندارند و شرط $n+m+k+t>5$ فقط می‌گوید طول رشته از ۵ بیشتر است. یعنی $L=a^+b^+c^+d^+$ منهای چند رشتهٔ کوتاه؛ یک زبان منظم منهای تعداد متناهی رشته منظم می‌ماند. گزینهٔ ۳.
بقیه باید تعداد دو حرف را برابر نگه دارند: در ۱ تعداد a و c (و d دو برابر آن)، در ۲ تعداد b و d، و در ۴ تعداد b و d. برای هر کدام با لم تزریق (یا با اشتراک با یک زبان منظم مثل $ab^*cd^*$ در گزینهٔ ۲ که $\{ab^tcd^t\}$ را می‌دهد) نامنظم بودن دیده می‌شود.`),
  Q(47, "automata", 2, "زبان کدام‌یک از عبارت‌های منظم زیر، با بقیه فرق دارد؟", [String.raw`$(0+\varepsilon)(1+10)^*$`, String.raw`$(0+\varepsilon)(11+10)^*$`, String.raw`$(1+01)^*(0+\varepsilon)$`, String.raw`$(0+\varepsilon)(11^*0)^*1^*$`],
    String.raw`گزینه‌های ۱، ۳ و ۴ هر سه «همهٔ رشته‌هایی که 00 ندارند» را می‌سازند:
• در ۱ هر صفرِ بعد از اولین نماد، درست بعد از یک ۱ می‌آید ($1$ یا $10$).
• در ۳ هر صفر (جز شاید آخرین نماد) درست قبل از یک ۱ است ($1$ یا $01$).
• در ۴ هر بلوک $11^*0$ صفر را بعد از دست‌کم یک ۱ می‌گذارد.
گزینهٔ ۲ فرق دارد: بعد از صفر اختیاری، فقط بلوک‌های دوحرفی می‌آیند، پس رشتهٔ «1» (که 00 ندارد) در آن نیست. گزینهٔ ۲.`),
  Q(48, "automata", 3, String.raw`درخصوص گرامر مستقل از متن زیر، کدام مورد درست است؟
$S\to A0\mid S1\mid 1$
$A\to 1S\mid 1A\mid 0$`, ["گرامر در تولید رشتهٔ 1111 ابهام دارد.", "گرامر در تولید رشتهٔ 1101 ابهام دارد.", "گرامر در تولید رشتهٔ 1110 ابهام دارد.", "این گرامر مبهم نیست."],
    String.raw`رشتهٔ 1110 با 0 تمام می‌شود، پس از $S\to A0$ می‌آید و A باید 111 را بسازد. A دو راه دارد:
• $A\Rightarrow 1A\Rightarrow 11S\Rightarrow 111$
• $A\Rightarrow 1S\Rightarrow 1S1\Rightarrow 111$
دو درخت تجزیهٔ متفاوت برای یک رشته، یعنی ابهام؛ گزینهٔ ۳.
1111 فقط با زنجیرهٔ $S\to S1$ ساخته می‌شود (هر قاعدهٔ دیگر یک 0 می‌آورد) و یکتاست. در 1101 هم بخش 110 فقط از $S\to A0$ و $A\Rightarrow1S\Rightarrow11$ می‌آید، چون A به‌تنهایی «1» نمی‌سازد.`),
  Q(49, "automata", 1, String.raw`فرض کنیم $L_1$، $L_2$ و $L_3$ سه زبان مستقل از متن دلخواه باشند. آنگاه کدام مورد زیر درست است؟ (منظور از $L'$ متمم مجموعهٔ L است.)`, [String.raw`زبان $L_1\cdot(L_2\cup L_3)$ حتماً مستقل از متن است.`, String.raw`زبان $L_1\cdot(L_2\cup L_3)$ حتماً مستقل از متن نیست.`, String.raw`زبان $L_1'\cdot(L_2\cup L_3)$ حتماً مستقل از متن است.`, String.raw`زبان $L_1'\cdot(L_2\cup L_3)$ حتماً مستقل از متن نیست.`],
    String.raw`زبان‌های مستقل از متن تحت اجتماع و الحاق بسته‌اند: $L_2\cup L_3$ مستقل از متن است و الحاقش با $L_1$ هم. گزینهٔ ۱.
تحت متمم بسته نیستند، پس $L_1'$ ممکن است مستقل از متن باشد یا نباشد؛ برای همین هیچ‌کدام از دو «حتماً» در گزینه‌های ۳ و ۴ درست نیست (مثلاً اگر $L_1$ منظم باشد، $L_1'$ هم منظم است و حاصل مستقل از متن می‌شود).`),
  Q(50, "automata", 3, "کدام‌یک از مسائل زیر، در مورد یک اتوماتون پشته‌ای غیرقطعی (NPDA) دلخواه به‌نام M، تصمیم‌پذیر (decidable) است؟", ["زبان اتوماتون M، توسط یک گرامر مستقل از متن نامبهم تشخیص داده می‌شود.", "زبان اتوماتون M، برابر زبان یک گرامر مستقل از متن دلخواه است.", "زبان اتوماتون M، دارای بی‌نهایت رشته است.", String.raw`زبان اتوماتون M، برابر $\Sigma^*$ است.`],
    String.raw`از M یک گرامر مستقل از متن می‌سازیم، آن را ساده می‌کنیم (حذف متغیرهای بی‌فایده، قواعد λ و واحد) و گراف وابستگی متغیرها را می‌کشیم: زبان نامتناهی است اگر و تنها اگر این گراف دور داشته باشد. پس متناهی یا نامتناهی بودن تصمیم‌پذیر است؛ گزینهٔ ۳.
بقیه تصمیم‌ناپذیرند: ذاتاً مبهم بودن زبان (۱)، هم‌ارزی دو زبان مستقل از متن (۲) و برابری با $\Sigma^*$ (۴).`),

  // ------------------------------------------ داده‌ساختارها و الگوریتم‌ها (۵۶ تا ۶۷)
  Q(56, "dsa", 3, String.raw`فرض کنید $T(x)=2T\left(\frac x2\right)+\frac89T\left(\frac{3x}4\right)+\theta\left(\frac{x^2}{\log x}\right)$. در این صورت کدام مورد درست است؟`, [String.raw`$T(x)=\theta(x^2\log x)$`, String.raw`$T(x)=\theta\left(\dfrac{x^2}{\log x}\right)$`, String.raw`$T(x)=\theta(x^2\log(\log x))$`, String.raw`$T(x)=\theta(2\log x-\log(\log x))$`],
    String.raw`دو زیرمسئله اندازه‌های متفاوت دارند، پس قضیهٔ اصلی کار نمی‌کند و سراغ قضیهٔ آکرا–بازی می‌رویم. p را طوری پیدا می‌کنیم که $2\left(\frac12\right)^p+\frac89\left(\frac34\right)^p=1$؛ با $p=2$: $\frac12+\frac89\cdot\frac9{16}=\frac12+\frac12=1$.
$T(x)=\Theta\left(x^p\left(1+\int_1^x\frac{g(u)}{u^{p+1}}du\right)\right)$ با $g(u)=\frac{u^2}{\log u}$؛ انتگرال $\int\frac{du}{u\log u}=\Theta(\log\log x)$ است.
پس $T(x)=\Theta(x^2\log\log x)$؛ گزینهٔ ۳.
نکتهٔ تستی: اگر جملهٔ آخر $x^2$ بود جواب $x^2\log x$ می‌شد؛ تقسیم بر $\log x$ یک $\log$ را به $\log\log$ تبدیل می‌کند.`),
  Q(57, "dsa", 4, "دنبالهٔ A[1..n] یک دنبالهٔ دوآهنگی (Bitonic) است، بدین معنی که هرگاه عناصر دنباله را به‌ترتیب دور یک دایره بنشانیم، یک عنصر یافت می‌شود که دنبالهٔ عناصر بعدی ابتدا صعودی و سپس نزولی هستند. بهترین زمان برای مرتب‌سازی یک دنبالهٔ دوآهنگی، کدام مورد است؟", [String.raw`$O(n\log n)$`, String.raw`$O(n\sqrt n)$`, String.raw`$O(n^2)$`, "$O(n)$"],
    String.raw`کوچک‌ترین عنصر را با یک پیمایش $O(n)$ پیدا می‌کنیم و دنباله را دور دایره از آنجا می‌خوانیم؛ حالا دنباله اول صعودی و بعد نزولی است. بخش نزولی را برعکس می‌خوانیم و دو دنبالهٔ مرتب داریم که با یک ادغام $O(n)$ یکی می‌شوند. کل کار $O(n)$؛ گزینهٔ ۴.
از $O(n)$ هم کمتر نمی‌شود، چون هر عنصر دست‌کم یک بار باید خوانده شود.`),
  Q(58, "dsa", 1, "فرض کنید می‌خواهیم تمام زیردنباله‌های یک دنبالهٔ داده‌شده را با استفاده از روش عقب‌گرد بررسی کنیم. اگر طول دنباله n باشد، پیچیدگی زمانی این روش چیست؟", ["$O(2^n)$", "$O(n^2)$", "$O(n!)$", String.raw`$O(\log n)$`],
    String.raw`هر زیردنباله با یک تصمیم «بردار یا نبردار» برای هر عنصر مشخص می‌شود؛ درخت عقب‌گرد دودویی و n سطحی است و $2^n$ برگ دارد. گزینهٔ ۱.
$O(n!)$ مال جایگشت‌هاست، نه زیردنباله‌ها.`),
  Q(59, "dsa", 4, "فرض کنید مسئله‌ای به نام انتخاب پروژه‌های با بیشترین سود (Maximum Profit Project Selection) داریم. در این مسئله، تعدادی پروژه وجود دارد که در آن پروژهٔ i دارای سود Pi و مدت‌زمان di است. تنها تعداد مشخصی از پروژه‌ها را می‌توان به‌طور هم‌زمان انجام داد و کل مدت‌زمان انجام پروژه‌ها نباید از T بیشتر شود. هدف این است که بیشترین سود ممکن را از بین پروژه‌های انتخاب‌شده به‌دست آوریم. می‌خواهیم از الگوریتم شاخه و حد (Branch and Bound) برای حل این مسئله استفاده کنیم. کدام‌یک از روش‌های زیر، مناسب‌ترین روش برای تعیین حد بالا (Upper Bound) در هر گره است تا به‌سرعت شاخه‌های غیرممکن یا کم‌بازده حذف شوند؟", ["استفاده از میانگین سود پروژه‌های باقی‌مانده و افزودن آن به سود فعلی در گره فعلی به‌عنوان حد بالا", "استفاده از بیشترین سود پروژه‌های باقی‌مانده و افزودن آن به سود فعلی در گره فعلی به‌عنوان حد بالا", "استفاده از مجموع سود تمامی پروژه‌های باقی‌مانده و افزودن آن به سود فعلی در گره فعلی به‌عنوان حد بالا", "انتخاب پروژه‌ها به‌صورت حریصانه، براساس بیشترین نسبت سود به مدت‌زمان و افزودن آنها تا زمانی که زمان کل از T فراتر نرود و سپس در نظر گرفتن نتیجه به‌عنوان حد بالا"],
    String.raw`این همان کولهٔ صفر و یک است: «وزن» مدت‌زمان است و «ارزش» سود. حد بالای استاندارد در شاخه و حد، جواب کولهٔ کسری است: پروژه‌ها را به ترتیب نسبت سود به زمان برمی‌داریم تا ظرفیت T پر شود (و از آخری کسری برمی‌داریم). این حد هم معتبر است (از جواب بهینه کمتر نیست) و هم تنگ است؛ گزینهٔ ۴.
گزینهٔ ۳ هم معتبر است ولی آن‌قدر گشاد است که تقریباً هیچ شاخه‌ای را حذف نمی‌کند. گزینه‌های ۱ و ۲ ممکن است از جواب بهینه کمتر شوند و شاخهٔ درست را به‌اشتباه حذف کنند.`),
  Q(60, "dsa", 2, "در الگوریتم مرتب‌سازی Insertion Sort، اگر برای جستجوی مکان مناسب عنصر جاری به‌جای جستجوی خطی از جستجوی دودویی استفاده کنیم، کدام مورد زیر درخصوص پیچیدگی زمانی آن در بدترین حالت درست است؟", [String.raw`به $O(n\log n)$ کاهش می‌یابد.`, "همچنان $O(n^2)$ باقی می‌ماند.", String.raw`به $O(\log n)$ کاهش می‌یابد.`, "به $O(n)$ کاهش می‌یابد."],
    String.raw`جستجوی دودویی تعداد «مقایسه‌ها» را به $O(n\log n)$ می‌رساند، ولی جا باز کردن برای عنصر هنوز جابه‌جا کردن همهٔ عناصر بزرگ‌تر است. در بدترین حالت (آرایهٔ نزولی) مجموع جابه‌جایی‌ها $1+2+\dots+(n-1)=\Theta(n^2)$ است. گزینهٔ ۲.`),
  Q(61, "dsa", 2, "فرض کنید می‌خواهید از میان دنباله‌ای از اعداد صحیح غیرمنفی تعدادی را انتخاب کنید به‌گونه‌ای که به بیشترین مجموع دست یابید، با این شرط که نمی‌توانید دو عنصر متوالی را انتخاب کنید. به‌عبارت‌دیگر، هر عددی که انتخاب می‌شود، عدد بعد از آن در دنباله نمی‌تواند انتخاب شود. کدام مورد، مناسب‌ترین روش با کمترین پیچیدگی زمانی برای حل این مسئله است؟", ["استفاده از الگوریتم بازگشتی به همراه حافظه‌گذاری (Memorization) برای ذخیرهٔ نتایج زیرمسئله‌ها و جلوگیری از محاسبهٔ مجدد آنها", "استفاده از الگوریتم پویا (Dynamic Programming) که به‌صورت تکراری مقدار بهینه را از سمت چپ به راست محاسبه می‌کند.", "استفاده از الگوریتم تقسیم و حل (Divide and Conquer) برای تقسیم مسئله به زیرمسئله‌های کوچک‌تر", "استفاده از الگوریتم جستجوی کامل (Brute Force) که تمام ترکیب‌های ممکن را بررسی می‌کند."],
    String.raw`رابطهٔ پویا: $best[i]=\max(best[i-1],\ best[i-2]+a_i)$. محاسبهٔ تکراری از چپ به راست $O(n)$ زمان می‌برد و فقط دو مقدار آخر را نگه می‌دارد، یعنی حافظهٔ $O(1)$. گزینهٔ ۲.
حافظه‌گذاری بازگشتی (۱) هم $O(n)$ است ولی حافظهٔ $O(n)$ و پشتهٔ بازگشت به عمق n دارد، پس «مناسب‌ترین» نیست. جستجوی کامل نمایی است.`),
  Q(62, "dsa", 1, "فرض کنید برای حل مسئلهٔ پوشش حداکثر (maximum Coverage)، از الگوریتم حریصانه استفاده می‌کنید که مجموعه‌ای از عناصر را با کمترین هزینهٔ ممکن پوشش دهد. چرا این الگوریتم نمی‌تواند جواب بهینه را تضمین کند؟", ["الگوریتم حریصانه همیشه انتخاب محلی بهینه دارد، اما ممکن است در سطح کلان بهترین نباشد.", "مسئلهٔ پوشش حداکثر یک مسئلهٔ NP- کامل است و نیاز به حل دقیق دارد.", "تمام راه‌حل‌های ممکن را بررسی نمی‌کند.", "پیچیدگی زمانی آن بالا است."],
    String.raw`الگوریتم حریصانه در هر قدم مجموعه‌ای را برمی‌دارد که بیشترین عنصر تازه را پوشش می‌دهد، و این انتخاب‌های محلی لزوماً به بهترین ترکیب کلی نمی‌رسند؛ گزینهٔ ۱. (برای همین فقط ضریب تقریب $1-\frac1e$ را تضمین می‌کند.)
گزینهٔ ۲ علت نیست: سختی مسئله توضیح نمی‌دهد چرا «این» الگوریتم اشتباه می‌کند. حریصانه سریع است، پس گزینهٔ ۴ هم نادرست است.`),
  Q(63, "dsa", 3, String.raw`چند گزاره از گزاره‌های زیر درست است؟
– هر الگوریتم قطعی که n کلید متمایز را فقط با مقایسهٔ کلیدها مرتب‌سازی می‌کند، باید در بدترین حالت حداقل $\lceil\log(n!)\rceil$ مقایسهٔ کلیدها را انجام دهد.
– اگر m تعداد برگ‌ها در یک درخت دودویی و d عمق آن باشد آنگاه $d\ge\lceil\log m\rceil$.
– الگوریتم مرتب‌سازی شمارشی یک الگوریتم مبتنی بر مقایسه است که در بدترین وضعیت از مرتبهٔ O(n) است.`, ["صفر", "۱", "۲", "۳"],
    String.raw`گزارهٔ دوم درست است: درخت دودویی با عمق d حداکثر $2^d$ برگ دارد، پس $m\le2^d$ و $d\ge\lceil\log m\rceil$.
گزارهٔ اول از همین نتیجه می‌شود: درخت تصمیم هر مرتب‌سازی مقایسه‌ای دست‌کم $n!$ برگ دارد، پس عمقش دست‌کم $\lceil\log(n!)\rceil$ است.
گزارهٔ سوم نادرست است: مرتب‌سازی شمارشی اصلاً مقایسه نمی‌کند و زمانش $O(n+k)$ است. دو گزارهٔ درست؛ گزینهٔ ۳.`),
  Q(64, "dsa", 2, "هر الگوریتم قطعی که بتواند بزرگ‌ترین کلید دوم (دومین بزرگ‌ترین کلید) را در هر ورودی ممکن، تنها با مقایسهٔ کلیدها بیابد، باید در بدترین حالت، حداقل چند مقایسه انجام دهد؟ (تعداد عناصر برابر n است.)", [String.raw`$n+\lceil\log n\rceil-1$`, String.raw`$n+\lceil\log n\rceil-2$`, String.raw`$n+\lceil\log n\rceil+2$`, String.raw`$2n+\lceil\log n\rceil$`],
    String.raw`روش تورنمنت: بزرگ‌ترین با $n-1$ مقایسه پیدا می‌شود. دومین بزرگ‌ترین فقط به برنده باخته، پس میان حداکثر $\lceil\log n\rceil$ عنصری است که مستقیم با برنده بازی کرده‌اند؛ بیشینهٔ آنها با $\lceil\log n\rceil-1$ مقایسهٔ دیگر پیدا می‌شود. جمع: $n+\lceil\log n\rceil-2$؛ گزینهٔ ۲.
این کران پایین هم هست (قضیهٔ کیسلیتسین)، پس هیچ الگوریتمی در بدترین حالت با مقایسهٔ کمتر نمی‌تواند.`),
  Q(65, "dsa", 4, String.raw`فرض کنید یک ساختار دادهٔ جدید به نام لیست اولویت‌دار پویا (Dynamic Priority List) دارید. این ساختار داده از لیستی از گره‌ها تشکیل شده است که هر گره دارای یک مقدار کلید و یک اولویت است. عمل‌های زیر، بر روی این ساختار داده تعریف شده‌اند:
– insert(x, p): افزودن یک عنصر با کلید x و اولویت p به لیست
– Delete Max(): حذف گره‌ای که دارای بیشترین اولویت است. اگر چند گره دارای اولویت یکسان باشند، اولین گره از سمت چپ حذف می‌شود.
– Find Median(): یافتن مقدار میانه از بین تمامی کلیدهای موجود در لیست
– Increase Priority(x, k): افزایش اولویت عنصر با کلید x به اندازهٔ k
هر کدام از این عملیات باید در کمترین پیچیدگی زمانی ممکن انجام شوند. حال، کدام‌یک از روش‌های زیر مناسب‌ترین ساختار دادهٔ ترکیبی برای پیاده‌سازی لیست اولویت‌دار پویا است، به‌گونه‌ای که همهٔ عملیات با پیچیدگی بهینه انجام شوند؟`, ["استفاده از یک پشته و یک صف به‌صورت هم‌زمان برای مدیریت ترتیب ورود و خروج عناصر و اولویت آنها", "ترکیب یک درخت فیبوناچی (Fibonacci Heap) و یک لیست پیوندی ساده برای مدیریت عناصر و اولویت‌ها", "ترکیب یک هرم دوتایی (Double-ended Heap) برای مدیریت اولویت‌ها و یک ساختار دادهٔ مرتب برای دسترسی سریع به میانه", "ترکیب یک درخت جستجوی دودویی متوازن (Balanced Binary Search Tree) برای ذخیرهٔ اولویت‌ها و یک جدول درهم‌سازی (Hash Table) برای دسترسی سریع به عناصر"],
    String.raw`سه نیاز داریم: پیدا کردن عنصر با کلیدش (برای Increase Priority)، بیشینه با قاعدهٔ «اولین از چپ» برای اولویت‌های برابر، و میانه.
• جدول درهم‌سازی عنصر x را در $O(1)$ پیدا می‌کند.
• درخت جستجوی متوازن (مثلاً با کلید مرکب «اولویت، ترتیب ورود») بیشینه را در $O(\log n)$ حذف می‌کند و افزایش اولویت را با حذف و درج دوباره در $O(\log n)$ انجام می‌دهد. اگر اندازهٔ زیردرخت‌ها را هم نگه داریم، k‌امین عنصر و در نتیجه میانه در $O(\log n)$ پیدا می‌شود.
پس گزینهٔ ۴ همه را لگاریتمی می‌کند. لیست پیوندی گزینهٔ ۲ پیدا کردن عنصر و میانه را خطی می‌کند، و پشته و صف (۱) هیچ‌کدام را پشتیبانی نمی‌کنند.`),
  Q(66, "dsa", 3, "در دو الگوریتم مرتب‌سازی سریع (Quick Sort) و مرتب‌سازی ادغامی (Merge Sort)، تعداد مقایسه‌ها و جابه‌جایی‌ها متفاوت است. کدام گزارهٔ زیر، دربارهٔ این تفاوت‌ها درست است؟", ["همواره، تعداد مقایسه‌ها در هر دو الگوریتم برابر است، اما مرتب‌سازی سریع، تعداد جابه‌جایی‌های بیشتری دارد.", "همواره، مرتب‌سازی ادغامی، تعداد مقایسه‌های کمتری نسبت به مرتب‌سازی سریع دارد و تعداد جابه‌جایی‌های آن نیز کمتر است.", "در حالت میانگین، مرتب‌سازی سریع، تعداد مقایسه‌های بیشتری نسبت به مرتب‌سازی ادغامی دارد و تعداد جابه‌جایی‌های آن کمتر است.", "در حالت میانگین، مرتب‌سازی سریع، تعداد مقایسه‌های برابری با مرتب‌سازی ادغامی دارد، اما مقدار جابه‌جایی‌های آن بیشتر است."],
    String.raw`در حالت میانگین مرتب‌سازی سریع حدود $2n\ln n\approx1.39\,n\log_2 n$ مقایسه می‌کند و مرتب‌سازی ادغامی حدود $n\log_2 n$؛ پس سریع مقایسهٔ بیشتری دارد. در عوض سریع درجا کار می‌کند و فقط عناصری را که سمت اشتباه محورند جابه‌جا می‌کند، در حالی که ادغامی در هر سطح همهٔ عناصر را به آرایهٔ کمکی می‌برد و برمی‌گرداند. گزینهٔ ۳.
«همواره» در گزینه‌های ۱ و ۲ نادرست است، چون مثلاً روی ورودی مرتب رفتار سریع کاملاً عوض می‌شود.`),
  Q(67, "dsa", 2, String.raw`فرض کنید یک لیست پیوندی یک‌طرفه از n گره داریم و شما می‌خواهید گره‌ای را که در موقعیت $\frac34n$ قرار گرفته پیدا کنید اما مقدار n را نمی‌دانیم. فرض کنید n مضربی از ۴ است. کدام‌یک از گزینه‌ها ما را به نتیجه نمی‌رساند؟`, [String.raw`ابتدا طول لیست را به‌طور کامل محاسبه کنید، سپس به اندازهٔ $\frac{3n}4$ از ابتدا به جلو حرکت کنید تا گره موردنظر را پیدا کنید.`, "با دو اشاره‌گر که یکی از ابتدا با سرعت سه گره و یکی از انتها (پس از پیدا کردن گره انتهایی) با سرعت یک گره حرکت کنند و در لحظهٔ رسیدن به هم، نتیجه حاصل خواهد شد.", String.raw`ابتدا طول لیست را به‌طور کامل محاسبه کنید، از دو اشاره‌گر استفاده کنید. یکی را در ابتدای لیست و دیگری را در گره $\frac n4$ تنظیم کنید. با سرعت یک گره حرکت کنید تا گره جلوتر به انتها برسد تا به هدف برسیم.`, "با دو اشاره‌گر که یکی با سرعت یک گره و دیگری به سرعت دو گره حرکت می‌کند، به نیمه می‌رسیم. یک گره جلو برویم و اشاره‌گر دوم که به انتها رسیده را مجدد برابر اشاره‌گر اول قرار خواهیم داد تا مجدد عمل انجام شود و نتیجه حاصل شود."],
    String.raw`در لیست یک‌طرفه هر گره فقط به گره بعدی اشاره می‌کند؛ اشاره‌گری که از انتها «به عقب» برود ممکن نیست. پس گزینهٔ ۲ اجرا نمی‌شود (حساب سرعت‌ها درست است: سه گره در برابر یک گره در $\frac34n$ به هم می‌رسند، ولی حرکت برگشتی وجود ندارد). گزینهٔ ۲.
بقیه کار می‌کنند: ۱ و ۳ با دانستن طول، و ۴ با دو بار روش اشاره‌گر کند و تند (اول نیمه، بعد نیمهٔ نیمهٔ دوم یعنی $\frac34n$).`),

  // ---------------------------------------------------- هوش مصنوعی (۶۸ تا ۷۵)
  Q(68, "ai", 4, "کدام گزاره درست است؟", ["مرتبهٔ زمانی الگوریتم Iterative Deepening Search به‌دلیل تکرارهای متعدد، بیشتر از BFS است.", "مرتبهٔ زمانی الگوریتم Iterative Deepening Search به‌دلیل تکرارهای متعدد، بیشتر از DFS است.", "مرتبهٔ مصرف حافظهٔ الگوریتم Iterative Deepening Search مانند BFS است، اما برخلاف BFS، جستجو با این الگوریتم کامل است.", "مرتبهٔ مصرف حافظهٔ الگوریتم Iterative Deepening Search مانند DFS است، اما برخلاف DFS، جستجو با این الگوریتم کامل است."],
    String.raw`IDS در هر دور یک DFS با محدودیت عمق است، پس فقط مسیر جاری و برادرهایش را نگه می‌دارد: حافظهٔ $O(bd)$ مثل DFS. چون عمق را یکی‌یکی زیاد می‌کند، اگر جوابی در عمق متناهی باشد پیدایش می‌کند، یعنی کامل است (DFS در درخت نامتناهی ممکن است گم شود). گزینهٔ ۴.
تکرار سطوح بالا مرتبهٔ زمانی را عوض نمی‌کند: زمان IDS همان $O(b^d)$ مثل BFS است، چون بیشتر گره‌ها در سطح آخرند. پس گزینه‌های ۱ و ۲ نادرست‌اند.`),
  Q(69, "ai", 1, "درخت جستجوی زیر را درنظر بگیرید. در جستجوی خصمانه (رقابتی) با هرس آلفا بتا در این درخت، برخی از شاخه‌ها هرس خواهند شد. مقادیر گره‌های ۴ و ۱۵ در چه بازه‌ای قابل تغییر هستند، به‌گونه‌ای که شاخه‌های هرس‌شده هیچ تغییری نکنند و همچنان همان شاخه‌ها هرس شوند؟", [String.raw`گره ۴ بازهٔ $(-\infty,10]$ و گره ۱۵ بازهٔ $(10,20]$`, String.raw`گره ۴ بازهٔ $(-\infty,10]$ و گره ۱۵ بازهٔ $(10,\infty)$`, String.raw`گره ۴ بازهٔ $(3,10]$ و گره ۱۵ بازهٔ $(10,\infty)$`, String.raw`گره ۴ بازهٔ $(3,10]$ و گره ۱۵ بازهٔ $(10,20]$`],
    String.raw`ریشه MAX است و فرزندانش برگ ۱۰ و دو گره MIN؛ زیر هر MIN دو گره MAX. اجرای آلفا–بتا از چپ:
• بعد از برگ ۱۰، در ریشه $\alpha=10$.
• MIN چپ: گره MAX اول (۴، ۳، ۲) مقدار ۴ می‌گیرد (چون $\beta=\infty$ است، داخلش هرسی نیست). حالا MIN چپ $\le4\le\alpha$ است، پس گره MAX دوم (۷، ۱) هرس می‌شود.
• MIN راست: گره MAX اول (۱۵، ۶) مقدار ۱۵ می‌گیرد و $\beta=15$. در گره MAX دوم، برگ ۲۰ از $\beta$ بیشتر است، پس برگ ۲۳ هرس می‌شود.
بازه‌ها: برای اینکه (۷، ۱) باز هم هرس شود، مقدار MAX اول باید $\le10$ بماند: $\max(x,3,2)\le10$ یعنی $x\in(-\infty,10]$. برای گره ۱۵: مقدار $\max(y,6)$ باید از ۱۰ بیشتر باشد (وگرنه کل زیردرخت راست هرس می‌شود) و از ۲۰ بیشتر نباشد (وگرنه ۲۰ دیگر از $\beta$ بیشتر نیست و ۲۳ بررسی می‌شود): $y\in(10,20]$. گزینهٔ ۱.`, { image: true }),
  Q(70, "ai", 3, String.raw`جملهٔ زیر را در منطق گزاره‌ای درنظر بگیرید. کدام مورد درست است؟ (بدیهی = همیشه درست = Tautology) (رزولوشن = Resolution)
$[(A\Rightarrow C)\vee(B\Rightarrow C)]\Rightarrow[(A\vee B)\Rightarrow C]$`, ["با استفاده از روش رزولوشن در کنار استفاده از جدول درستی (Truth Table)، می‌توان بدیهی بودن جمله را نشان داد.", "با استفاده از روش رزولوشن، نمی‌توان راجع به بدیهی بودن/ نبودن این جمله نتیجه‌ای گرفت.", "با استفاده از روش رزولوشن، می‌توان بدیهی نبودن این جمله را نشان داد.", "با استفاده از روش رزولوشن، می‌توان بدیهی بودن این جمله را نشان داد."],
    String.raw`جمله بدیهی نیست: با $A=T$، $B=F$، $C=F$ مقدم درست است ($B\Rightarrow C$ درست است) ولی تالی نادرست ($A\vee B$ درست و C نادرست).
در منطق گزاره‌ای رزولوشن روی نقیض جمله همیشه تمام می‌شود (تعداد بندهای ممکن متناهی است). اگر به بند تهی نرسیم، نقیض ارضاپذیر است، یعنی جمله بدیهی نیست. پس رزولوشن بدیهی نبودن را نشان می‌دهد؛ گزینهٔ ۳.`),
  Q(71, "ai", 3, "کدام گزاره درست است؟", ["اگر تابع هیوریستیک h سازگار (Consistent) باشد، آنگاه مقادیر f(n) در مسیر بهینه از ریشه تا هدف غیرنزولی است و در سایر مسیرها ممکن است صعودی یا نزولی باشد.", String.raw`با فرض نامنفی بودن مقادیر توابع هیوریستیک، زمان اجرای حاصل از تابع هیوریستیک صفر $(h(n)=0)$ در الگوریتم $A^*$، از هیچ تابع هیوریستیک دیگری کمتر نیست.`, String.raw`اگر تابع هیوریستیک h سازگار (Consistent) باشد، هم جستجوی درختی و هم جستجوی گرافی $A^*$ بهینه خواهد بود.`, String.raw`اگر تابع هیوریستیک h قابل قبول (Admissible) باشد، جستجوی گرافی $A^*$ بهینه خواهد بود.`],
    String.raw`هر هیوریستیک سازگار قابل قبول هم هست، پس جستجوی درختی A* بهینه است؛ و سازگاری تضمین می‌کند وقتی گرهی برای اولین بار باز می‌شود بهترین مسیرش پیدا شده، پس جستجوی گرافی هم بهینه است. گزینهٔ ۳.
گزینهٔ ۱: با h سازگار، f در «هر» مسیری غیرنزولی است، نه فقط مسیر بهینه. گزینهٔ ۴: قابل قبول بودن برای جستجوی گرافی (بدون باز کردن دوبارهٔ گره‌ها) کافی نیست. گزینهٔ ۲: یک هیوریستیک بد (مثلاً غیرقابل قبول یا گمراه‌کننده) می‌تواند از $h=0$ هم کندتر باشد.`),
  Q(72, "ai", 3, "از دو الگوریتم تپه‌نوردی استاندارد و پرتو محلی (local beam search)، برای حل یک مسئله استفاده می‌کنیم. کدام مورد درست است؟", ["درصورتی‌که الگوریتم تپه‌نوردی به جواب بهینهٔ سراسری برسد و حالت اولیهٔ الگوریتم تپه‌نوردی یکی از k جواب اولیهٔ الگوریتم پرتو محلی باشد، الگوریتم پرتو محلی نیز حتماً به بهینهٔ سراسری خواهد رسید.", "درصورتی‌که الگوریتم پرتو محلی به جواب بهینهٔ سراسری برسد و حالت اولیهٔ الگوریتم تپه‌نوردی یکی از k جواب اولیهٔ الگوریتم پرتو محلی باشد، الگوریتم تپه‌نوردی نیز حتماً به بهینهٔ سراسری خواهد رسید.", "هر دو الگوریتم ممکن است در بهینهٔ محلی (local) گیر کنند.", "موارد ۱ و ۳"],
    String.raw`هر دو فقط به همسایه‌های بهتر می‌روند، پس هر دو ممکن است در بهینهٔ محلی گیر کنند؛ گزینهٔ ۳.
پرتو محلی k اجرای مستقل تپه‌نوردی نیست: در هر قدم از میان همهٔ جانشین‌های k حالت، k تای بهتر را نگه می‌دارد. ممکن است جانشین‌های مسیری که تپه‌نوردی را به جواب می‌رساند کنار گذاشته شوند، پس گزینهٔ ۱ «حتماً» ندارد. برعکسش (۲) هم درست نیست، چون ممکن است پرتو از حالت دیگری به جواب رسیده باشد.`),
  Q(73, "ai", 1, "در مسئلهٔ CSP زیر (مسئلهٔ رنگ‌آمیزی نقشه)، خانه‌های E و D با رنگ‌های زرد = D، قرمز = E رنگ شده‌اند. کدام گزاره درست است؟", ["با استفاده از هیوریستیک Degree، متغیر A یا B یا C به‌عنوان متغیر بعدی انتخاب خواهد شد (بدون ترجیح یکی بر دیگری).", "با استفاده از هیوریستیک MRV، متغیر B یا C به‌عنوان متغیر بعدی انتخاب خواهد شد (بدون ترجیح یکی بر دیگری).", "با استفاده از هیوریستیک Degree، متغیر A به‌عنوان متغیر بعدی انتخاب خواهد شد.", "با استفاده از هیوریستیک LCV، متغیر A به‌عنوان متغیر بعدی انتخاب خواهد شد."],
    String.raw`هیوریستیک Degree متغیری را برمی‌گزیند که با بیشترین تعداد «متغیر رنگ‌نشده» محدودیت دارد. متغیرهای باقی‌مانده A، B و C هستند و در نقشه هر سه با هم همسایه‌اند: A با B و C، B با A و C، C با A و B. هر کدام دو همسایهٔ رنگ‌نشده دارند، پس تساوی است؛ گزینهٔ ۱. (اگر همسایه‌های رنگ‌شده را هم بشماریم A بیشتر است، ولی Degree فقط محدودیت با متغیرهای باقی‌مانده را می‌شمارد.)
MRV متغیر با کمترین مقدار مجاز را می‌خواهد: A هم با زرد (D) و هم با قرمز (E) همسایه است و کمترین گزینه را دارد، پس MRV سراغ A می‌رود نه B یا C. LCV دربارهٔ ترتیب «مقدارها»ست، نه انتخاب متغیر.`, { image: true }),
  Q(74, "ai", 2, "در مسئلهٔ جستجوی زیر، دو تابع هیوریستیک h1 و h2 مفروض است. کدام مورد، ویژگی‌های این دو تابع را نشان می‌دهد؟ (قابل قبول = Admissible، سازگار = Consistent)", ["h1 قابل قبول است، اما سازگار نیست.", "h2 قابل قبول است، اما سازگار نیست.", "h1 قابل قبول نیست، اما سازگار است.", "h2 هم قابل قبول و هم سازگار است."],
    String.raw`هزینه‌های واقعی تا هدف: $h^*(S)=6$ (از B)، $h^*(A)=6$، $h^*(B)=4$، $h^*(D)=2+4=6$ و $h^*(C)=3+6=9$ (یال‌ها جهت ندارند).
h2 قابل قبول است: $5\le6$، $6\le6$، $3\le4$، $3\le9$ و $6\le6$. ولی سازگار نیست: روی یال D–B باید $h_2(D)\le c(D,B)+h_2(B)$ باشد، یعنی $6\le2+3=5$ که برقرار نیست. گزینهٔ ۲.
h1 هم قابل قبول است و هم سازگار (همهٔ یال‌ها شرط را دارند، مثلاً $h_1(S)=5\le2+h_1(B)=5$)، پس گزینه‌های ۱ و ۳ نادرست‌اند.`, { image: true }),
  Q(75, "ai", 2, String.raw`یک مسئلهٔ ارضای محدودیت‌ها (CSP) با چهار متغیر W، Z، Y و X تعریف شده است. دامنهٔ مقادیر هر متغیر، به‌صورت زیر است:
$D(X)=\{1,2,3\},\ D(Y)=\{1,2,3,4\},\ D(Z)=\{1,2,3\},\ D(W)=\{2,3\}$
محدودیت‌های مسئله، عبارتند از:
– $X\ne Y$
– $Z=W$
– $X+W\le4$
– $Z\ne3$
پس از اعمال الگوریتم حذف مقادیر ناسازگار (Arc Consistency)، کدام مورد زیر، دامنه‌های به‌روزرسانی‌شده را نشان می‌دهد؟`, [String.raw`$D(X)=\{1,2\},\ D(Y)=\{1,2,3\},\ D(Z)=\{2\},\ D(W)=\{2\}$`, String.raw`$D(X)=\{1,2\},\ D(Y)=\{1,2,3,4\},\ D(Z)=\{2\},\ D(W)=\{2\}$`, String.raw`$D(X)=\{1,2,3\},\ D(Y)=\{1,2,3,4\},\ D(Z)=\{2\},\ D(W)=\{2\}$`, String.raw`$D(X)=\{1,2,3\},\ D(Y)=\{2,3,4\},\ D(Z)=\{1,2\},\ D(W)=\{2\}$`],
    String.raw`• $Z\ne3$: $D(Z)=\{1,2\}$.
• $Z=W$: W فقط مقداری می‌ماند که در Z هم باشد: $D(W)=\{2\}$؛ و در نتیجه Z هم فقط ۲ پشتیبان دارد: $D(Z)=\{2\}$.
• $X+W\le4$ با $W=2$: $X\le2$، پس $D(X)=\{1,2\}$.
• $X\ne Y$: هر مقدار Y با یکی از دو مقدار X متفاوت است، پس چیزی از Y حذف نمی‌شود: $D(Y)=\{1,2,3,4\}$.
گزینهٔ ۲.`),

  // ------------------------------------------------------ مدارهای منطقی (۷۶ تا ۸۲)
  Q(76, "logic", 2, "اگر فقط دروازه‌های NAND دو ورودی در دسترس داشته باشیم، برای پیاده‌سازی تابع AB+CD+EF+GH چند دروازه نیاز است؟", ["۱۰", "۹", "۸", "۷"],
    String.raw`سطح اول: چهار NAND که $\overline{AB}$، $\overline{CD}$، $\overline{EF}$ و $\overline{GH}$ را می‌سازند (۴ گیت).
با یک NAND دیگر $\overline{\overline{AB}\cdot\overline{CD}}=AB+CD$ ساخته می‌شود، و همین‌طور $EF+GH$ (۲ گیت). برای OR کردن این دو با NAND باید اول معکوسشان کنیم (۲ گیت NAND به‌عنوان NOT) و بعد یک NAND آخر: $\overline{\overline{(AB+CD)}\cdot\overline{(EF+GH)}}$.
جمع: $4+2+2+1=9$؛ گزینهٔ ۲.`),
  Q(77, "logic", 3, "در مدار زیر، ورودی A در لحظهٔ صفر از مقدار یک به مقدار صفر تغییر می‌کند. تأخیر گیت‌ها درون آنها نوشته شده و فرض می‌کنیم فلیپ‌فلاپ که با لبهٔ بالارونده پالس ساعت کار می‌کند، هیچ تأخیری ندارد. اگر خروجی Z در ابتدا صفر باشد، در چه زمانی یک می‌شود؟", ["۱۰", "۱۵", "۳۰", "۳۵"],
    String.raw`پیش از صفر: $A=1$ و $C=1$، پس $Y=1$ و $W=1$؛ و چون $Z=0$، ورودی D (که $\overline Z$ است) برابر ۱ است.
• $Y=A\cdot C$ با تأخیر ۵: در $t=5$ صفر می‌شود، پس W (OR با تأخیر ۵) در $t=10$ صفر می‌شود. این لبهٔ پایین‌رونده است و فلیپ‌فلاپ کاری نمی‌کند.
• $\overline A$ با تأخیر ۲۰ در $t=20$ یک می‌شود، $X=\overline A\cdot B$ در $t=25$ و W در $t=30$ دوباره یک می‌شود.
این اولین لبهٔ بالارونده است و $D=1$ را به Z می‌برد: $Z=1$ در $t=30$؛ گزینهٔ ۳.`, { image: true }),
  Q(78, "logic", 2, "اگر در جدول حالت زیر، حالت‌های معادل را حذف کنیم، چند حالت باقی می‌ماند؟", ["۴", "۵", "۶", "۷"],
    String.raw`گام ۱، دسته‌بندی با خروجی‌ها (x=0، x=1): $\{a,b,c,e\}$ با (0,0)، $\{d,h\}$ با (1,0)، $\{f\}$ با (1,1) و $\{g\}$ با (0,1).
گام ۲، حالت بعدی‌ها: a به (f، b) و c به (f، e) می‌روند؛ b و e هر دو به (d، c). پس $\{a,b,c,e\}$ به $\{a,c\}$ و $\{b,e\}$ می‌شکند. d و h هر دو به (g، a) می‌روند و معادل‌اند.
گام ۳: a و c به (f، b) و (f، e) می‌روند و b و e در یک دسته‌اند، پس دسته‌ها پایدارند: $\{a,c\}$، $\{b,e\}$، $\{d,h\}$، $\{f\}$ و $\{g\}$؛ یعنی ۵ حالت. گزینهٔ ۲.`, { image: true }),
  Q(79, "logic", 1, String.raw`کمترین تعداد گیت AND که مخاطرهٔ پنهان در تابع زیر (که به‌صورت مجموع حاصل‌ضرب‌ها پیاده‌سازی می‌شود) را از بین می‌برد، چند عدد است؟
$F(a,b,c,d,e)=bc'e'+a'cd'e+bcd'e+a'b'c'd+ab'de$`, ["۲", "۱", "۴", "۳"],
    String.raw`مخاطرهٔ ایستای ۱ وقتی است که دو جملهٔ مجاور فقط در یک متغیر با هم تفاوت متمم دارند و جملهٔ اجماع (consensus) آنها در تابع نیست. جفت‌ها را بررسی می‌کنیم:
• $bc'e'$ و $a'b'c'd$ (روی b): اجماع $a'c'de'$؛ هیچ جمله‌ای آن را نمی‌پوشاند.
• $a'b'c'd$ و $ab'de$ (روی a): اجماع $b'c'de$؛ پوشانده نشده.
• بقیهٔ جفت‌ها یا متغیر متمم ندارند یا اجماعشان صفر می‌شود (مثلاً $bc'e'$ و $bcd'e$ هم در c و هم در e متمم‌اند).
پس دو جملهٔ AND اضافه لازم است: $a'c'de'$ و $b'c'de$؛ گزینهٔ ۱.`),
  Q(80, "logic", 4, "مدار زیر، چه تابعی را پیاده‌سازی می‌کند؟", ["XNOR", "XOR", "NAND", "NOR"],
    String.raw`مالتی‌پلکسر اول با انتخاب b: ورودی ۰ آن «1» و ورودی ۱ آن «0» است، پس خروجی‌اش $\overline b$ است.
مالتی‌پلکسر دوم با انتخاب a: ورودی ۰ آن $\overline b$ و ورودی ۱ آن «0» است، پس $out=\overline a\,\overline b=\overline{a+b}$، یعنی NOR؛ گزینهٔ ۴.`, { image: true }),
  Q(81, "logic", 3, "فرکانس نوسان نوسانگر حلقه‌ای زیر، چند مگاهرتز است؟ (فرض کنید تأخیر هر معکوس‌کننده، ۵ نانوثانیه (5 ns) است.)", ["۵", "۱۰", "۲۰", "۴۰"],
    String.raw`حلقه پنج معکوس‌کننده دارد. یک تغییر سطح، حلقه را در $5\times5=25$ نانوثانیه دور می‌زند و خروجی را برمی‌گرداند؛ یک دورهٔ کامل (یک بار بالا و یک بار پایین) دو دور حلقه است: $T=2\times5\times5=50\ \text{ns}$.
فرکانس: $f=\frac1{50\ \text{ns}}=20\ \text{MHz}$؛ گزینهٔ ۳.`, { image: true }),
  Q(82, "logic", 4, "کدام مورد، خروجی مدار زیر را به‌صورت حاصل‌ضرب ماکسترم‌ها به‌نحو درست نشان می‌دهد؟", ["۰, ۲, ۵, ۶, ۹, ۱۰, ۱۳, ۱۵", "۰, ۲, ۵, ۶, ۹, ۱۱, ۱۲, ۱۵", "۱, ۳, ۵, ۷, ۹, ۱۰, ۱۳, ۱۵", "۱, ۳, ۴, ۷, ۸, ۱۱, ۱۲, ۱۴"],
    String.raw`با $C_{in}=1$: $Sum=\overline{a\oplus b}$ و $C_{out}=a+b$. خروجی XOR: $Sum\oplus C_{out}=\overline{ab}$ (فقط وقتی $a=b=1$ صفر است).
ورودی‌های مالتی‌پلکسر (با انتخاب $c\,d$): ۰: $\overline{C_{out}}=\overline{a+b}$؛ ۱: $C_{out}=a+b$؛ ۲: $\overline{ab}$؛ ۳: معکوس XOR، یعنی $ab$.
مینترم‌ها (abcd): از ورودی ۰ فقط 0؛ از ۱: 5، 9 و 13؛ از ۲: 2، 6 و 10؛ از ۳: فقط 15. پس $f=\sum m(0,2,5,6,9,10,13,15)$ و ماکسترم‌ها بقیه‌اند: $\prod M(1,3,4,7,8,11,12,14)$؛ گزینهٔ ۴.
دام تستی: گزینهٔ ۱ همان فهرست مینترم‌هاست، نه ماکسترم‌ها.`, { image: true }),

  // ------------------------------------------------------ معماری کامپیوتر (۸۳ تا ۸۹)
  Q(83, "architecture", 2, "در یک کامپیوتر دارای ۱۶ ثبات عام‌منظوره و گذرگاه آدرس ۱۰ بیتی، قالب دستورالعمل‌ها ۲۴ بیتی است. چنانچه ۲۵۶ دستور تک‌آدرسی از نوع حافظه‌ای مستقیم و ۱۰۲۴ دستور تک‌آدرسی ثباتی مستقیم و غیرمستقیم باشد، حداکثر چند دستور دوآدرسی که یکی آدرس حافظه و دیگری ثبات باشد، می‌توان داشت؟", ["۵۱۲", "۱۰۰۷", "۱۰۲۴", "۱۰۶۴"],
    String.raw`کد عملیاتی گسترش‌پذیر: کل فضای کد $2^{24}$ است. آدرس حافظه ۱۰ بیت و شمارهٔ ثبات ۴ بیت است.
• هر دستور دوآدرسی (حافظه + ثبات) $2^{10+4}=2^{14}$ کد مصرف می‌کند.
• ۲۵۶ دستور تک‌آدرسی حافظه‌ای: $256\times2^{10}=2^{18}$ کد، یعنی معادل $2^4=16$ دستور دوآدرسی.
• ۱۰۲۴ دستور تک‌آدرسی ثباتی: $1024\times2^4=2^{14}$ کد، یعنی معادل یک دستور دوآدرسی.
پس $x\cdot2^{14}+2^{18}+2^{14}\le2^{24}$ و $x\le1024-16-1=1007$؛ گزینهٔ ۲.`),
  Q(84, "architecture", 3, "فرض کنید که در یک پردازنده برای اجرای پایپ‌لاین دستورات از پنج مرحلهٔ واکشی دستور (IF)، به‌دست آوردن عملوندها (ID)، اجرا در ALU (EX)، مراجعه به حافظه (DM) و نوشتن نتایج در ثبات مقصد (WB) استفاده می‌شود و هیچ‌گونه امکان رفع وابستگی (hazard) به‌صورت نرم‌افزاری و یا forwarding وجود نداشته باشد. هر مرحله در یک پالس ساعت انجام می‌شود. درصورت وجود وابستگی، به کمک اضافه کردن تأخیر (Stall) رفع می‌شود. برای اجرای دستورات زیر، به چند پالس ساعت نیاز است؟ (عملیات ثباتی در دستورات، از راست به چپ است.)\n```\nADD R1, R2, R3\nSUB R4, R1, R2\nAND R5, R2, R1\n```", ["۸", "۹", "۱۰", "۱۱"],
    String.raw`«از راست به چپ» یعنی مقصد اولین ثبات است: ADD در R1 می‌نویسد و SUB و AND هر دو R1 را می‌خوانند.
ADD: IF۱، ID۲، EX۳، DM۴، WB۵. SUB باید R1 را بعد از WB دستور ADD بخواند؛ با این فرض که خواندن ثبات پالس بعد از نوشتن است، ID آن در پالس ۶ است: EX۷، DM۸، WB۹. AND پشت SUB منتظر می‌ماند: ID۷، EX۸، DM۹، WB۱۰. جمع: ۱۰ پالس؛ گزینهٔ ۳.
اگر فرض کنیم ثبات در نیمهٔ اول پالس نوشته و در نیمهٔ دوم خوانده می‌شود، ID دستور SUB در پالس ۵ می‌افتد و جواب ۹ می‌شد؛ کلید این آزمون فرض اول را گرفته است.`),
  Q(85, "architecture", 1, String.raw`شکل زیر جزء iام یک واحد حسابی (Arithmetic Unit) n بیتی است که عملکرد آن با خطوط $S_1S_0$ براساس ورودی‌های n بیتی A و B و تک‌بیت $C_{in}$ کنترل می‌شود. $FA_i$ یک تمام‌افزا (Full adder) است. اگر $S_1=1$، کدام حالت مربوط به عملکرد این واحد حسابی است؟`, [String.raw`$S_0C_{in}=00:\ A-1$؛ $01:\ A$؛ $10:\ A-B-1$؛ $11:\ A-B$`, String.raw`$S_0C_{in}=00:\ A-1$؛ $01:\ A$؛ $10:\ A-B-1$؛ $11:\ A-B+1$`, String.raw`$S_0C_{in}=00:\ A$؛ $01:\ A-1$؛ $10:\ A-B-1$؛ $11:\ A-B$`, String.raw`$S_0C_{in}=00:\ A$؛ $01:\ A+1$؛ $10:\ A-B$؛ $11:\ A-B+1$`],
    String.raw`ورودی دوم جمع‌کننده از مالتی‌پلکسر می‌آید: ۰ → $b_i$، ۱ → 0، ۲ → 1، ۳ → $\overline{b_i}$. با $S_1=1$ فقط ورودی‌های ۲ و ۳ انتخاب می‌شوند.
• $S_0=0$: همهٔ بیت‌ها ۱ است، یعنی عدد $-1$ در مکمل دو: $F=A-1+C_{in}$؛ با $C_{in}=0$ می‌شود $A-1$ و با $C_{in}=1$ می‌شود $A$.
• $S_0=1$: $\overline B$ که برابر $-B-1$ است: $F=A-B-1+C_{in}$؛ یعنی $A-B-1$ و $A-B$.
گزینهٔ ۱.`, { image: true }),
  Q(86, "architecture", 3, "در یک سامانهٔ پردازشی، ۴۰٪ زمان برای دسترسی به حافظهٔ RAM و ۳۰٪ زمان برای دسترسی به هارددیسک صرف می‌شود. اگر سرعت دسترسی به حافظهٔ RAM و دیسک را به‌ترتیب دو و سه برابر کنیم، تسریع چقدر می‌شود؟", ["۱/۳۳", "۱/۵", "۱/۶۶", "۲/۵"],
    String.raw`قانون آمدال: زمان جدید $=0.3+\frac{0.4}{2}+\frac{0.3}{3}=0.3+0.2+0.1=0.6$ زمان قبلی است. تسریع $\frac1{0.6}\approx1.66$؛ گزینهٔ ۳.`),
  Q(87, "architecture", 4, "کد معادل با معماری زیر، در زبان RTL چیست؟", [String.raw`$CLK:\ R2\leftarrow R1$`, String.raw`$CLK:\ R1\leftarrow R2$`, String.raw`$P:\ R1\leftarrow R2$`, String.raw`$P:\ R2\leftarrow R1$`],
    String.raw`خروجی n بیتی R1 به ورودی R2 وصل است و سیگنال P از مدار کنترل به ورودی Load ثبات R2 می‌رود. پس در لبهٔ ساعت، اگر P یک باشد، محتوای R1 در R2 بار می‌شود: $P:\ R2\leftarrow R1$؛ گزینهٔ ۴.
در RTL شرط کنترلی (P) نوشته می‌شود، نه خود ساعت؛ ساعت در همهٔ انتقال‌ها مشترک است.`, { image: true }),
  Q(88, "architecture", 2, String.raw`حافظهٔ نهان مجموعه‌انجمنی ۲ تایی که اندازهٔ هر مجموعه ۲ بلوک و اندازهٔ هر بلوک ۴ کلمه و از الگوریتم جایگزینی LRU بهره می‌برد، مفروض است. چنانچه اندازهٔ حافظهٔ نهان ۱۶ کلمه باشد، نرخ موفقیت پس از انجام درخواست‌های کلمات زیر، به‌ترتیب از چپ به راست چیست؟
$21-51-8-76-30-10-08-77-79-78-23-20-18-76-8-30-31-11-9-22$`, [String.raw`$\frac{12}{20}$`, String.raw`$\frac{11}{20}$`, String.raw`$\frac{10}{20}$`, String.raw`$\frac9{20}$`],
    String.raw`۱۶ کلمه با بلوک ۴ کلمه‌ای یعنی ۴ بلوک، و در هر مجموعه ۲ بلوک یعنی ۲ مجموعه. شمارهٔ بلوک $\lfloor w/4\rfloor$ و مجموعه زوج یا فرد بودن آن است.
بلوک‌ها به ترتیب: ۵، ۱۲، ۲، ۱۹، ۷، ۲، ۲، ۱۹، ۱۹، ۱۹، ۵، ۵، ۴، ۱۹، ۲، ۷، ۷، ۲، ۲، ۵.
• مجموعهٔ زوج: ۱۲ (عدم برخورد)، ۲ (عدم)، ۲، ۲ (برخورد)، ۴ (عدم؛ ۱۲ بیرون می‌رود)، ۲، ۲، ۲ (برخورد). ۵ برخورد.
• مجموعهٔ فرد: ۵، ۱۹، ۷ (هر سه عدم؛ ۵ بیرون می‌رود)، ۱۹، ۱۹، ۱۹ (برخورد)، ۵ (عدم؛ ۷ بیرون)، ۵، ۱۹ (برخورد)، ۷ (عدم؛ ۵ بیرون)، ۷ (برخورد)، ۵ (عدم). ۶ برخورد.
جمع: $5+6=11$ برخورد از ۲۰؛ گزینهٔ ۲.`),
  Q(89, "architecture", 1, "تکه‌کد زیر، مربوط به کدام معماری است؟\n```\nPush A\npush B\nAdd\nPop C\n```", ["مبتنی بر پشته", "مبتنی بر انباشتگر", "مبتنی بر ثبات ـ حافظه", "مبتنی بر ثبات ـ ثبات / بارگذاری ـ ذخیره‌سازی"],
    String.raw`دستور Add هیچ عملوندی ندارد: دو عنصر بالای پشته را برمی‌دارد و حاصل را روی پشته می‌گذارد؛ Push و Pop هم داده را بین حافظه و پشته جابه‌جا می‌کنند. این ماشین صفرآدرسی، یعنی معماری مبتنی بر پشته است؛ گزینهٔ ۱.
در معماری انباشتگر همین کار به شکل Load A، Add B، Store C نوشته می‌شد.`),

  // ------------------------------------------------------- سیستم‌های عامل (۹۶ تا ۱۰۲)
  Q(96, "os", 3, "هدف اصلی از مکانیزم حالت دوگانه (Dual Mode)، حفاظت از کدام مورد است و در کجا پیاده‌سازی شده است؟", ["امنیت سیستم در برابر فرایندهای هک‌شده ـ پردازنده", "سایر فرایندها در برابر فرایند مخرب ـ سیستم عامل", "منابع سیستم در برابر عملکرد مخرب فرایندها ـ پردازنده", "سیستم عامل در برابر عملکرد مخرب فرایندها ـ سیستم عامل"],
    String.raw`حالت دوگانه (کاربر و هسته) با یک بیت حالت در «سخت‌افزار پردازنده» پیاده می‌شود: دستورهای ممتاز (ورودی/خروجی، تنظیم تایمر، دسترسی به جدول صفحه و...) فقط در حالت هسته اجرا می‌شوند. هدفش این است که هیچ فرایندی نتواند مستقیم به منابع سیستم دست بزند و کار خرابی بکند؛ گزینهٔ ۳.
سیستم عامل از این سازوکار «استفاده» می‌کند، ولی جایی که پیاده شده پردازنده است؛ برای همین گزینه‌های ۲ و ۴ نادرست‌اند.`),
  Q(97, "os", 1, "چهار فرایند مشابه نیاز به ۲۰ms پردازش دارند که اجرای آنها به‌صورت ۵ms پردازش و ۵ms انتظار برای تکمیل IO است. اگر سربار تعویض زمینه صفر باشد، اجرای دسته‌ای (batch) این فرایندها روی یک پردازندهٔ دوهسته‌ای (dual core) چند ms طول می‌کشد؟", ["۸۰", "۵۰", "۴۰", "۲۵"],
    String.raw`هر فرایند ۲۰ میلی‌ثانیه پردازش دارد، یعنی چهار نوبت «۵ پردازش + ۵ انتظار IO»: $4\times(5+5)=40$ میلی‌ثانیه.
در اجرای دسته‌ای، هسته هنگام انتظار IO سراغ فرایند دیگری نمی‌رود؛ هر فرایند تا آخر اجرا می‌شود و بعد نوبت بعدی است. هر هسته دو فرایند را پشت سر هم اجرا می‌کند: $2\times40=80$ میلی‌ثانیه؛ گزینهٔ ۱.
اگر چندبرنامگی داشتیم، هر هسته در زمان IO یک فرایند، فرایند دیگرش را اجرا می‌کرد و زمان کمتر می‌شد؛ همین تفاوت دسته‌ای و چندبرنامگی است.`),
  Q(98, "os", 4, "کدام مورد، درخصوص هم‌روندی (concurrency) درست است؟", ["هم‌روندی، لازمهٔ داشتن چندبرنامگی است.", "چندوظیفگی (multitasking)، یک نوع هم‌روندی است.", "چندبرنامگی (multiprogramming)، همان هم‌روندی است.", "چندریسمانی (multithreading)، یک نوع هم‌روندی است."],
    String.raw`هم‌روندی یعنی چند کار در بازه‌های زمانی هم‌پوشان پیش بروند. چندریسمانی دقیقاً همین را درون یک برنامه می‌سازد: چند ریسمان که هم‌زمان (یا یک‌درمیان روی یک هسته) جلو می‌روند. کلید سنجش گزینهٔ ۴ است.
گزینهٔ ۳ نادرست است: چندبرنامگی یکی از راه‌های ایجاد هم‌روندی است، نه خود آن. گزینهٔ ۱ برعکس است: چندبرنامگی هم‌روندی می‌سازد، نه اینکه به آن نیاز داشته باشد.
گزینهٔ ۲ هم از نظر بسیاری از کتاب‌ها قابل دفاع است، چون چندوظیفگی هم کارها را هم‌روند اجرا می‌کند؛ کلید آن را نپذیرفته است.`, { disputed: true }),
  Q(99, "os", 4, "در یک سیستم عامل ۳ فرایند در حافظه بارگذاری شده است. فرایند اول دارای ۲ ریسمان هسته‌ای، فرایند دوم دارای یک ریسمان هسته و ۲ ریسمان کاربری و فرایند سوم دارای ۲ ریسمان سطح کاربری است. در هستهٔ این سیستم عامل، چند ریسمان برای این سه فرایند وجود دارد؟ (نگاشت چند به یک حالت پیش‌فرض است.)", ["۸", "۶", "۵", "۴"],
    String.raw`هسته فقط ریسمان‌های هسته را می‌بیند. با نگاشت چند به یک، همهٔ ریسمان‌های کاربری یک فرایند روی یک ریسمان هسته سوار می‌شوند.
• فرایند اول: ۲ ریسمان هسته.
• فرایند دوم: ریسمان‌های کاربری‌اش روی همان یک ریسمان هسته‌اش نگاشت می‌شوند: ۱.
• فرایند سوم: دو ریسمان کاربری روی یک ریسمان هسته: ۱.
جمع: $2+1+1=4$؛ گزینهٔ ۴.`),
  Q(100, "os", 1, "مانیتور (monitor) در همگام‌سازی ریسمان‌ها به چه مفهومی است؟", ["یک مکانیزم همگام‌سازی سطح بالا است که دو ساختار دادهٔ مجزا برای انحصار متقابل و متغیرهای شرطی تعریف می‌کند.", "یک مکانیزم انحصار متقابل است که بر استفاده از دستورات سخت‌افزاری و انتظار فعال (busy wating) تأکید دارد.", "یک مکانیزم همگام‌سازی سطح بالا است که انحصار متقابل و متغیرهای شرطی را در یک ساختار داده ادغام می‌کند.", "یک ریسمان خاص برای پایش و نظارت وضعیت همگامی سایر ریسمان‌ها است."],
    String.raw`مانیتور یک سازوکار سطح بالای زبان برنامه‌نویسی است: فقط یک ریسمان در هر لحظه داخل آن است (انحصار متقابل) و ریسمان‌ها با متغیرهای شرطی (wait و signal) منتظر شرط‌ها می‌مانند. در پیاده‌سازی کتاب سیلبرشاتس، این دو کار با ساختارهای جدا انجام می‌شود: یک صف ورود برای انحصار متقابل و برای هر متغیر شرطی یک صف جدا. کلید سنجش با همین دید گزینهٔ ۱ است.
گزینهٔ ۳ هم توصیف رایجی از مانیتور است (همه‌چیز در یک ساختار کپسوله می‌شود) و از نظر ما قابل دفاع است؛ کلید آن را نپذیرفته است. گزینهٔ ۲ توصیف قفل چرخشی (spinlock) است و گزینهٔ ۴ اصلاً مانیتور همگام‌سازی نیست.`, { disputed: true }),
  Q(101, "os", 2, "کدام روش زمان‌بندی، از نوع تقدم اکید و غیرقبضه‌ای (non preemptive) است؟", ["کوتاه‌ترین کار (Shortest Job First)", "صف (FIFO)", "نوبتی چرخشی (Round Robin)", "نرخ یکنواخت (Rate Monotonic)"],
    String.raw`FIFO همیشه به ترتیب ورود و بی‌چون‌وچرا (تقدم اکید) اجرا می‌کند و هیچ فرایندی را وسط کار کنار نمی‌گذارد؛ گزینهٔ ۲.
نوبتی چرخشی با کوانتوم زمانی قبضه می‌کند، نرخ یکنواخت زمان‌بندی اولویت‌دار قبضه‌ای سیستم‌های بی‌درنگ است، و کوتاه‌ترین کار هم نسخهٔ قبضه‌ای دارد (SRTF) و ترتیبش به پیش‌بینی طول کار بستگی دارد، نه تقدم ثابت.`),
  Q(102, "os", 2, "کدام مورد درست است؟", ["اگر در یک سیستم، بهره‌وری پردازنده ۱۵٪ و دیسک ۹۷٪ باشد این سیستم قطعاً دچار کوبیدگی (thrashing) شده است.", "زمانی‌که یک فرایند درحال اجرای یک تابع بازگشتی است، مجموعهٔ کاری (working set) می‌تواند بدون تغییر بماند.", "روش مدیریت حافظه سگمنت کردن (Segmentation)، ممکن است دچار کوبیدگی (thrashing) شود.", "روش LFU (least frequently used) می‌تواند دچار بدرفتاری بیلیدی (Belady Anomality) شود."],
    String.raw`تابع بازگشتی بارها همان کد و همان صفحه‌های پشته را لمس می‌کند؛ اگر عمق بازگشت در همان صفحه‌ها جا شود، مجموعهٔ صفحه‌هایی که در پنجرهٔ اخیر ارجاع شده‌اند ثابت می‌ماند. «می‌تواند» این را ممکن می‌داند، نه حتمی؛ گزینهٔ ۲.
• ۱: بهره‌وری پایین پردازنده و بالای دیسک نشانهٔ کوبیدگی است، ولی «قطعاً» نیست؛ یک بار کاری سنگین ورودی/خروجی هم همین را می‌سازد.
• ۳: کوبیدگی پدیدهٔ حافظهٔ مجازی صفحه‌بندی‌شده است؛ قطعه‌بندی تنها صفحه‌خطا و رفت‌وبرگشت صفحه ندارد.
• ۴: LFU با شمارش همهٔ ارجاع‌ها یک الگوریتم پشته‌ای است (اولویت صفحه‌ها به تعداد قاب‌ها بستگی ندارد) و بدرفتاری بیلیدی ندارد؛ این بدرفتاری مال FIFO است.`),
];
