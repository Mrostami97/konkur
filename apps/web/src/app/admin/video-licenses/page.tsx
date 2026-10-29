"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../../../lib/api";
import { toEnglishDigits, toPersianDigits } from "../../../lib/format";

const formatPersianDate = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });
import { AdminPageHeader, Alert, Badge, Button, Card, DataState, TableWrap } from "../../../components/ds";

type Tab = "PENDING" | "DONE" | "ALL";

interface Person {
  id: string;
  phone: string;
  name: string | null;
}

interface Row {
  user: Person;
  licenseKey: string | null;
  requests: { id: string; course: { id: string; title: string; spotPlayerCourseId: string | null }; requestedAt: string; handledAt: string | null }[];
}

interface Issued {
  user: Person;
  licenseKey: string;
  issuedAt: string;
  updatedAt: string;
}

const phoneOf = (phone: string) => toPersianDigits(phone.replace(/^\+98/, "0"));

function IssueForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const [key, setKey] = useState(row.licenseKey ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/video-licenses/${row.user.id}`, { method: "POST", body: { licenseKey: key } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت لایسنس ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-2)", minWidth: 260 }}>
      <input
        className="ds-input"
        dir="ltr"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        placeholder="کد لایسنس اسپات‌پلیر"
        aria-label={`کد لایسنس ${row.user.name ?? row.user.phone}`}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Button size="sm" variant="primary" loading={busy} disabled={!key.trim()} onClick={() => void save()}>
          {row.licenseKey ? "دوره‌ها به لایسنس اضافه شد" : "ثبت لایسنس"}
        </Button>
      </div>
    </div>
  );
}

/**
 * A key for any account, without a request (owner, 2026-10-29): find the
 * person by phone or name, type the key made on SpotPlayer, and it shows in
 * their profile and on the pages of the courses they asked about.
 */
function GrantCard({ issued, onDone }: { issued: Issued[]; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Person | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = toEnglishDigits(query.trim());
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, page: "1", pageSize: "8" });
      const data = await apiFetch<{ users: Person[] }>(`/admin/users?${params}`);
      setMatches(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "جستجوی کاربر ممکن نشد.");
    } finally {
      setSearching(false);
    }
  }

  function pick(person: Person) {
    setPicked(person);
    setKey(issued.find((item) => item.user.id === person.id)?.licenseKey ?? "");
    setSaved(null);
    setError(null);
  }

  async function grant() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/video-licenses/${picked.id}`, { method: "POST", body: { licenseKey: key } });
      setSaved(`لایسنس ${picked.name ?? phoneOf(picked.phone)} ثبت شد و در پروفایلش نمایش داده می‌شود.`);
      setPicked(null);
      setMatches(null);
      setQuery("");
      setKey("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت لایسنس ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  const current = picked ? issued.find((item) => item.user.id === picked.id) : undefined;

  return (
    <Card>
      <span className="ds-eyebrow">بدون درخواست</span>
      <h2 className="ds-title" style={{ fontSize: "var(--text-lg)", marginTop: "var(--sp-2)" }}>دادن لایسنس به هر کاربر</h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
        کاربر را با شمارهٔ موبایل یا نام پیدا کن و کد لایسنسی را که در اسپات‌پلیر ساخته‌ای ثبت کن. کد همان لحظه در پروفایل و صفحهٔ
        «دوره‌های من» او نمایش داده می‌شود.
      </p>

      <form onSubmit={(event) => void search(event)} style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginTop: "var(--sp-4)" }}>
        <input
          className="ds-input"
          style={{ flex: "1 1 220px" }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="شمارهٔ موبایل یا نام"
          aria-label="جستجوی کاربر"
        />
        <Button type="submit" variant="secondary" loading={searching} disabled={!query.trim()}>جستجو</Button>
      </form>

      {saved && <div style={{ marginTop: "var(--sp-3)" }}><Alert tone="success">{saved}</Alert></div>}
      {error && <div style={{ marginTop: "var(--sp-3)" }}><Alert tone="danger">{error}</Alert></div>}

      {matches !== null && !picked && (
        <div style={{ display: "grid", gap: "var(--sp-2)", marginTop: "var(--sp-3)" }}>
          {matches.length === 0 ? (
            <Alert tone="info">کاربری با این مشخصات پیدا نشد.</Alert>
          ) : (
            matches.map((person) => (
              <button
                key={person.id}
                type="button"
                className="ds-btn ds-btn-secondary"
                style={{ justifyContent: "space-between", width: "100%" }}
                onClick={() => pick(person)}
              >
                <span>{person.name ?? "بی‌نام"}</span>
                <span dir="ltr">{phoneOf(person.phone)}</span>
              </button>
            ))
          )}
        </div>
      )}

      {picked && (
        <div style={{ display: "grid", gap: "var(--sp-2)", marginTop: "var(--sp-4)" }}>
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap" }}>
            <strong>{picked.name ?? "بی‌نام"}</strong>
            <span dir="ltr">{phoneOf(picked.phone)}</span>
            {current && <Badge tone="info">لایسنس قبلی دارد</Badge>}
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>تغییر کاربر</Button>
          </div>
          <input
            className="ds-input"
            dir="ltr"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="کد لایسنس اسپات‌پلیر"
            aria-label={`کد لایسنس ${picked.name ?? picked.phone}`}
          />
          <div>
            <Button variant="primary" loading={busy} disabled={!key.trim() || key.trim() === current?.licenseKey} onClick={() => void grant()}>
              {current ? "به‌روزرسانی لایسنس" : "ثبت لایسنس"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const TAB_LABEL: Record<Tab, string> = { PENDING: "در انتظار", DONE: "انجام‌شده", ALL: "همهٔ لایسنس‌ها" };

export default function VideoLicensesAdminPage() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [issued, setIssued] = useState<Issued[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextIssued, nextRows] = await Promise.all([
        apiFetch<Issued[]>("/admin/video-licenses/issued"),
        tab === "ALL" ? Promise.resolve([] as Row[]) : apiFetch<Row[]>(`/admin/video-licenses?status=${tab}`),
      ]);
      setIssued(nextIssued);
      setRows(nextRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "بارگذاری لایسنس‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AdminPageHeader
        title="لایسنس‌های اسپات‌پلیر"
        description="دانشجویی که دورهٔ ویدیودار خریده از صفحهٔ دوره لایسنس درخواست می‌دهد؛ به هر کاربر دیگری هم می‌توانی بی‌درخواست لایسنس بدهی. لایسنس را در پنل اسپات‌پلیر بساز (یا دورهٔ تازه را به لایسنس قبلی‌اش اضافه کن) و کدش را این‌جا ثبت کن. یک لایسنس می‌تواند همهٔ دوره‌ها را داشته باشد."
        action={
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
              <Button key={key} variant={tab === key ? "primary" : "secondary"} onClick={() => setTab(key)}>
                {TAB_LABEL[key]}
              </Button>
            ))}
          </div>
        }
      />

      <GrantCard issued={issued} onDone={() => void load()} />

      <Card padded={false}>
        {tab === "ALL" ? (
          <DataState loading={loading} error={error} onRetry={() => void load()} isEmpty={issued.length === 0} emptyTitle="هنوز لایسنسی ثبت نشده">
            <TableWrap>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>کاربر</th>
                    <th>کد لایسنس</th>
                    <th>آخرین ثبت</th>
                  </tr>
                </thead>
                <tbody>
                  {issued.map((item) => (
                    <tr key={item.user.id}>
                      <td>
                        <strong>{item.user.name ?? "بی‌نام"}</strong>
                        <div dir="ltr" style={{ textAlign: "right" }}>{phoneOf(item.user.phone)}</div>
                      </td>
                      <td><code dir="ltr">{item.licenseKey}</code></td>
                      <td>{formatPersianDate(item.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </DataState>
        ) : (
          <DataState
            loading={loading}
            error={error}
            onRetry={() => void load()}
            isEmpty={rows.length === 0}
            emptyTitle={tab === "PENDING" ? "درخواست تازه‌ای نیست" : "هنوز درخواستی انجام نشده"}
          >
            <TableWrap>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>دانشجو</th>
                    <th>دوره‌های درخواستی</th>
                    <th>{tab === "PENDING" ? "ثبت لایسنس" : "کد لایسنس"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user.id}>
                      <td>
                        <strong>{row.user.name ?? "بی‌نام"}</strong>
                        <div dir="ltr" style={{ textAlign: "right" }}>{phoneOf(row.user.phone)}</div>
                        {tab === "PENDING" && row.licenseKey && <Badge tone="info">لایسنس قبلی دارد</Badge>}
                      </td>
                      <td>
                        {row.requests.map((item) => (
                          <div key={item.id}>
                            {item.course.title}
                            {item.course.spotPlayerCourseId && (
                              <span className="ds-subtitle" dir="ltr"> ({item.course.spotPlayerCourseId})</span>
                            )}
                            <div className="ds-subtitle">
                              {tab === "PENDING" ? `درخواست ${formatPersianDate(item.requestedAt)}` : `ثبت ${formatPersianDate(item.handledAt ?? item.requestedAt)}`}
                            </div>
                          </div>
                        ))}
                      </td>
                      <td>
                        {tab === "PENDING" ? (
                          <IssueForm row={row} onDone={() => void load()} />
                        ) : (
                          <code dir="ltr">{row.licenseKey}</code>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </DataState>
        )}
      </Card>
    </>
  );
}
