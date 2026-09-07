import Link from "next/link";
import { AdminGuard } from "../../components/AdminGuard";

export default function AdminHomePage() {
  return (
    <AdminGuard>
      <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
        <h1>پنل ادمین</h1>
        <ul>
          <li>
            <Link href="/admin/articles">مدیریت مقالات</Link>
          </li>
          <li>
            <Link href="/admin/content-sources">منابع و مستندات تحریریه</Link>
          </li>
          <li>
            <Link href="/admin/contributors">نویسندگان و بازبین‌ها</Link>
          </li>
          <li>
            <Link href="/admin/resources">مدیریت منابع آموزشی</Link>
          </li>
          <li>
            <Link href="/admin/courses">مدیریت دوره‌ها</Link>
          </li>
          <li>
            <Link href="/admin/commerce">فروش و دسترسی‌ها</Link>
          </li>
          <li>
            <Link href="/admin/import">ورود داده (Import)</Link>
          </li>
          <li>
            <Link href="/admin/taxonomy">طبقه‌بندی موضوعی</Link>
          </li>
          <li>
            <Link href="/admin/questions">افزودن سؤال</Link>
          </li>
          <li>
            <Link href="/admin/exams">مدیریت آزمون‌ها</Link>
          </li>
          <li>
            <Link href="/admin/admissions">دانشگاه‌ها و گرایش‌ها</Link>
          </li>
          <li>
            <Link href="/admin/analytics">بک‌تست تخمین رتبه</Link>
          </li>
          <li>
            <Link href="/admin/crm">CRM و رشد</Link>
          </li>
        </ul>
      </main>
    </AdminGuard>
  );
}
