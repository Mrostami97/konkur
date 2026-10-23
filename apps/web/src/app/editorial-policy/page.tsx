import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "مطالب کنکور کامپیوتر را چه کسی می‌نویسد",
  description: "نویسندهٔ مطالب، این‌که عددها و حل تست‌ها از کجا می‌آیند و اگر اشتباهی دیدی چه کنی.",
  path: "/editorial-policy",
});

// Written in the owner's own voice (owner, 2026-10-24): no production steps, no
// writer/reviewer pair -- both read as "a machine writes, a person checks".
const notes = [
  [
    "عددها از کجا می‌آیند",
    "تعداد سؤال‌ها، کلیدها و ضریب‌ها از دفترچه‌ها و اطلاعیه‌های خود سازمان سنجش است. رتبه‌ها و درصدها از کارنامه‌هایی است که داوطلب‌ها برایمان فرستاده‌اند؛ از این کارنامه‌ها فقط آمار جمعی منتشر می‌شود و نام و مشخصات کسی نه.",
  ],
  [
    "حل تست‌ها",
    "متن هر تست با تصویر دفترچه مقابله می‌شود و پاسخ با کلید نهایی سنجش. اگر به نظرمان کلید سنجش اشتباه باشد، همین را می‌گوییم و دلیلش را هم می‌نویسیم.",
  ],
  [
    "دوره‌ها و بانک سؤال",
    "کنکور کامپیوتر دوره و بانک سؤال خودش را می‌فروشد. هر جا مطلبی به دوره‌ای لینک می‌دهد، آن دوره مال خودمان است و این را پنهان نمی‌کنیم.",
  ],
] as const;

export default function EditorialPolicyPage() {
  return (
    <main className="page-container trust-page">
      <PageHeader
        eyebrow="دربارهٔ مطالب"
        title="این مطالب را چه کسی می‌نویسد"
        description="مطالب کنکور کامپیوتر را محمد رستمی می‌نویسد؛ فارغ‌التحصیل کارشناسی ارشد شریف در گرایش الگوریتم و محاسبات، که کلاس‌های ارشد کامپیوتر سایت را هم خودش درس می‌دهد."
      />

      <div className="policy-steps">
        {notes.map(([title, copy]) => (
          <section className="surface-card" key={title}>
            <h2>{title}</h2>
            <p>{copy}</p>
          </section>
        ))}
      </div>

      <section className="surface-card policy-note">
        <h2>اشتباهی دیدی؟</h2>
        <p>
          نشانی صفحه و جمله‌ای را که به نظرت غلط است بفرست؛ راهش در <Link className="text-link" href="/corrections">اصلاح مطالب</Link> آمده است.
          این‌که از منابع دیگران چطور استفاده می‌کنیم هم در <Link className="text-link" href="/source-policy">منبع و حق نشر</Link> است.
        </p>
      </section>
    </main>
  );
}
