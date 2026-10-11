"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { AdminPageHeader, Alert, Badge, Button, Card, DataState, TableWrap } from "../../../components/ds";

interface GuideItem {
  slug: string;
  title: string;
  category: string;
}

interface Review {
  slug: string;
  reviewerName: string;
  reviewedAt: string;
}

type Filter = "pending" | "reviewed" | "all";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });

export function GuideReviewsAdmin({ guides }: { guides: GuideItem[] }) {
  const [reviews, setReviews] = useState<Map<string, Review>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiFetch<Review[]>("/guide-reviews");
      setReviews(new Map(rows.map((row) => [row.slug, row])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "بارگذاری وضعیت راهنماها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(slug: string, approve: boolean) {
    setBusy(slug);
    setActionError(null);
    try {
      await apiFetch(`/admin/guide-reviews/${slug}`, { method: approve ? "POST" : "DELETE" });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ثبت انجام نشد.");
    } finally {
      setBusy(null);
    }
  }

  const shown = useMemo(
    () => guides.filter((guide) => filter === "all" || (filter === "reviewed") === reviews.has(guide.slug)),
    [guides, reviews, filter],
  );
  const reviewedCount = guides.filter((guide) => reviews.has(guide.slug)).length;

  return (
    <>
      <AdminPageHeader
        title="بازبینی راهنماها"
        description={`راهنما را باز کن و بخوان؛ اگر درست بود «تأیید بازبینی» را بزن تا نامت به‌عنوان بازبین و تاریخ امروز روی صفحه بیاید. ${guides.length.toLocaleString("fa-IR")} راهنما، ${reviewedCount.toLocaleString("fa-IR")} تأییدشده.`}
        action={
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            {(["pending", "reviewed", "all"] as const).map((value) => (
              <Button key={value} size="sm" variant={filter === value ? "primary" : "secondary"} onClick={() => setFilter(value)}>
                {value === "pending" ? "بازبینی‌نشده" : value === "reviewed" ? "تأییدشده" : "همه"}
              </Button>
            ))}
          </div>
        }
      />
      {actionError && <Alert tone="danger">{actionError}</Alert>}
      <Card padded={false}>
        <DataState loading={loading} error={error} onRetry={() => void load()} isEmpty={shown.length === 0} emptyTitle="راهنمایی در این دسته نیست">
          <TableWrap>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>راهنما</th>
                  <th>وضعیت</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((guide) => {
                  const review = reviews.get(guide.slug);
                  return (
                    <tr key={guide.slug}>
                      <td>
                        <a href={`/guides/${guide.slug}`} target="_blank" rel="noreferrer">
                          <strong>{guide.title}</strong>
                        </a>
                        <div className="ds-subtitle">{guide.category}</div>
                      </td>
                      <td>
                        {review ? (
                          <Badge tone="success">{review.reviewerName} · {dateOf(review.reviewedAt)}</Badge>
                        ) : (
                          <Badge tone="warning">بازبینی‌نشده</Badge>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {review ? (
                          <Button size="sm" variant="ghost" loading={busy === guide.slug} onClick={() => void act(guide.slug, false)}>
                            لغو تأیید
                          </Button>
                        ) : (
                          <Button size="sm" variant="primary" loading={busy === guide.slug} onClick={() => void act(guide.slug, true)}>
                            تأیید بازبینی
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </DataState>
      </Card>
    </>
  );
}
