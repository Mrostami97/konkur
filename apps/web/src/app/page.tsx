const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getApiHealth(): Promise<{ status: string; time: string } | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await getApiHealth();

  return (
    <main style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>KonkurCom 360 — فاز صفر</h1>
      <p>این صفحه فقط زیرساخت را نشان می‌دهد؛ پورتال و آکادمی در فاز یک ساخته می‌شوند.</p>
      <p>
        وضعیت API:{" "}
        {health ? (
          <strong style={{ color: "green" }}>{health.status} — {health.time}</strong>
        ) : (
          <strong style={{ color: "crimson" }}>در دسترس نیست</strong>
        )}
      </p>
    </main>
  );
}
