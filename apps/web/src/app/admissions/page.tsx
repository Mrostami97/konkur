import Link from "next/link";

export default function AdmissionsHubPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1>انتخاب‌رشته ۳۶۰</h1>
      <p style={{ fontSize: "0.85rem", color: "#486581" }}>
        از تخمین رتبه تا مقایسه و اولویت‌بندی دانشگاه‌ها و گرایش‌ها.
      </p>
      <ul>
        <li>
          <Link href="/rank-estimate">تخمین رتبه</Link>
        </li>
        <li>
          <Link href="/programs">دانشگاه‌ها و گرایش‌ها</Link>
        </li>
        <li>
          <Link href="/choices">مقایسه و اولویت انتخاب‌ها</Link>
        </li>
      </ul>
    </main>
  );
}
