import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "سیاست اصلاح، نسخه‌بندی و گزارش خطا",
  description: "نحوهٔ گزارش، بررسی و ثبت اصلاحات مطالب زمان‌حساس در کنکور کامپیوتر.",
  path: "/corrections",
});

export default function CorrectionsPage() {
  return (
    <main className="page-container trust-page">
      <PageHeader
        eyebrow="اصلاح و پاسخ‌گویی"
        title="خطا باید قابل گزارش، بررسی و ردیابی باشد"
        description="هدف اصلاح فقط جایگزین‌کردن یک جمله نیست؛ خواننده باید بداند چه چیزی تغییر کرده و آیا آن تغییر بر تصمیم او اثر می‌گذارد."
      />

      <div className="trust-layout">
        <section className="surface-card">
          <h2>چه چیزی باید گزارش شود؟</h2>
          <ul>
            <li>مغایرت با دفترچه، اطلاعیه یا اصلاحیهٔ رسمی</li>
            <li>عدد، تاریخ، نام، نقل‌قول یا پیوند نادرست</li>
            <li>منبعی که ادعای نوشته را پشتیبانی نمی‌کند</li>
            <li>اطلاعات قدیمی که ممکن است تصمیم داوطلب را تغییر دهد</li>
            <li>انتساب ناقص، بازنشر نامجاز یا مسئلهٔ حریم خصوصی</li>
          </ul>
        </section>

        <section className="surface-card">
          <h2>یک گزارش مفید چه دارد؟</h2>
          <p>نشانی دقیق صفحه، عبارت مورد اعتراض، توضیح کوتاه خطا و ــ اگر ممکن است ــ پیوند سند معتبر را بفرست. اطلاعات شخصی غیرضروری یا مدارک محرمانه را در پیام عمومی منتشر نکن.</p>
          <p>تنها کانال رسمی کنکور کامپیوتر <strong dir="ltr">@kunkurcomputer</strong> است. برای پیدا کردن راه ارتباطی اعلام‌شده و بررسی اصالت حساب، از همین نشانی استفاده کن.</p>
          <a className="button button-primary" href="https://t.me/kunkurcomputer" target="_blank" rel="noreferrer">رفتن به @kunkurcomputer</a>
        </section>
      </div>

      <div className="policy-steps policy-note">
        <section className="surface-card"><span>۱</span><h2>دریافت</h2><p>نشانی صفحه و جمله‌ای که به نظرت غلط است را برایمان بفرست.</p></section>
        <section className="surface-card"><span>۲</span><h2>بررسی</h2><p>متن را با منبعش و اگر سند تازه‌تری آمده با همان سند مقایسه می‌کنیم.</p></section>
        <section className="surface-card"><span>۳</span><h2>تصمیم</h2><p>اگر حق با تو باشد متن را درست می‌کنیم؛ اگر نه، دلیلش را برایت می‌نویسیم.</p></section>
        <section className="surface-card"><span>۴</span><h2>انتشار</h2><p>متن اصلاح‌شده با تاریخ تازه منتشر می‌شود و اگر عدد یا نتیجه‌ای عوض شده باشد، همان‌جا می‌گوییم چه چیزی عوض شد.</p></section>
      </div>

      <div className="trust-layout policy-note">
        <section className="surface-card">
          <h2>نسخه‌بندی تغییرات</h2>
          <p>اصلاح تایپی یا بهبود نگارشی که معنای مطلب را تغییر نمی‌دهد، ممکن است بدون یادداشت جداگانه انجام شود. تغییر عدد، تاریخ، نتیجه‌گیری، منبع اصلی یا توصیه‌ای که بر تصمیم خواننده اثر دارد، باید با تاریخ و خلاصهٔ تغییر مشخص شود.</p>
          <p>وقتی مقرره یا دادهٔ تازه منتشر می‌شود، متن قبلی «خطا» محسوب نمی‌شود اگر در زمان انتشار درست بوده باشد؛ صفحه با منبع و تاریخ جدید به‌روزرسانی و تفاوت مهم توضیح داده می‌شود.</p>
        </section>

        <section className="surface-card">
          <h2>شفافیت در اختلاف</h2>
          <p>اگر منابع معتبر با هم ناسازگار باشند، اختلاف به‌جای انتخاب بی‌توضیح یک روایت ذکر می‌شود. ادعای تأییدنشده حذف یا با برچسب روشن محدود می‌شود. درخواست حذف یا اصلاح دربارهٔ حریم خصوصی و حق نشر نیز بر پایهٔ همان صفحه و شواهد همراه آن بررسی می‌شود.</p>
          <p>روش انتخاب و سنجش منابع در <Link className="text-link" href="/source-policy">سیاست منبع و حق نشر</Link> و نویسندهٔ مطالب در <Link className="text-link" href="/editorial-policy">این صفحه</Link> آمده است.</p>
        </section>
      </div>
    </main>
  );
}
