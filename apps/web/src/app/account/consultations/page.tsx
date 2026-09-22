"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { AccountShell } from "../AccountShell";
import { formatPersianNumber } from "../../../lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Field,
  Input,
  Textarea,
} from "../../../components/ds";

type BookingStatus = "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

interface Access {
  entitlementId: string;
  offering: {
    id: string;
    headline: string;
    kind: "SINGLE_SESSION" | "PACKAGE";
    sessionQuota: number;
    durationMinutes: number;
    instructorProfile: { slug: string; displayName: string; avatarUrl: string | null };
  };
  endAt: string | null;
  sessionsUsed: number;
  sessionsRemaining: number;
  isExpired: boolean;
  isBookable: boolean;
}

interface Booking {
  id: string;
  status: BookingStatus;
  requestedSlots: string[];
  studentNote: string | null;
  scheduledAt: string | null;
  durationMinutes: number;
  meetingUrl: string | null;
  instructorNote: string | null;
  cancelReason: string | null;
  createdAt: string;
  offering: {
    id: string;
    headline: string;
    instructorProfile: { slug: string; displayName: string; avatarUrl: string | null };
  };
}

const STATUS: Record<BookingStatus, { text: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  REQUESTED: { text: "در انتظار تأیید مدرس", tone: "warning" },
  CONFIRMED: { text: "زمان تعیین شد", tone: "info" },
  COMPLETED: { text: "برگزار شد", tone: "success" },
  CANCELLED: { text: "لغو شد", tone: "neutral" },
  NO_SHOW: { text: "غیبت", tone: "danger" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });
}

export default function MyConsultationsPage() {
  const [access, setAccess] = useState<Access[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [booking, setBooking] = useState<Access | null>(null);
  const [slots, setSlots] = useState<string[]>(["", "", ""]);
  const [studentNote, setStudentNote] = useState("");

  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accessList, bookingList] = await Promise.all([
        apiFetch<Access[]>("/me/consultations/access"),
        apiFetch<Booking[]>("/me/consultations/bookings"),
      ]);
      setAccess(accessList);
      setBookings(bookingList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن مشاوره‌های شما ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این عملیات ممکن نشد.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submitBooking() {
    const target = booking;
    if (!target) return;
    const chosen = slots.map((slot) => slot.trim()).filter(Boolean);
    if (chosen.length === 0) return;

    const ok = await run(`${target.entitlementId}:book`, async () => {
      await apiFetch("/me/consultations/bookings", {
        method: "POST",
        body: {
          offeringId: target.offering.id,
          requestedSlots: chosen.map((slot) => new Date(slot).toISOString()),
          ...(studentNote.trim() ? { studentNote: studentNote.trim() } : {}),
        },
      });
      return "درخواست شما ثبت شد. مدرس یکی از زمان‌ها را تأیید می‌کند و همین‌جا می‌بینید.";
    });
    if (ok) {
      setBooking(null);
      setSlots(["", "", ""]);
      setStudentNote("");
    }
  }

  async function submitCancel() {
    const target = cancelling;
    const reason = cancelReason.trim();
    if (!target || reason.length < 3) return;
    const ok = await run(`${target.id}:cancel`, async () => {
      await apiFetch(`/me/consultations/bookings/${target.id}/cancel`, {
        method: "POST",
        body: { reason },
      });
      return "جلسه لغو شد و به سهمیهٔ شما بازگشت.";
    });
    if (ok) {
      setCancelling(null);
      setCancelReason("");
    }
  }

  const nothingAtAll = access.length === 0 && bookings.length === 0;

  const remaining = access.reduce((sum, item) => sum + item.sessionsRemaining, 0);
  const upcoming = bookings.filter((item) => item.status === "CONFIRMED").length;
  const awaiting = bookings.filter((item) => item.status === "REQUESTED").length;

  return (
    <AccountShell
      title="مشاوره‌های من"
      subtitle="سهمیهٔ جلسه‌هایتان و وضعیت هر جلسه. زمان را شما پیشنهاد می‌دهید و مدرس تأیید می‌کند."
      chips={
        <>
          <span className="acc-chip">{formatPersianNumber(remaining)} جلسهٔ باقی‌مانده</span>
          {upcoming > 0 && <span className="acc-chip">{formatPersianNumber(upcoming)} جلسهٔ زمان‌دار</span>}
          {awaiting > 0 && <span className="acc-chip">{formatPersianNumber(awaiting)} در انتظار تأیید</span>}
        </>
      }
      action={
        <Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/consultations">
          رزرو مشاورهٔ تازه
        </Link>
      }
    >
    <div className="ds-stack-lg">
      {actionError && <Alert tone="danger">{actionError}</Alert>}
      {notice && !actionError && <Alert tone="success">{notice}</Alert>}

      <DataState
        loading={loading}
        error={error}
        isEmpty={nothingAtAll}
        onRetry={load}
        emptyTitle="هنوز مشاوره‌ای نخریده‌اید"
        emptyDescription="می‌توانید یک جلسهٔ تکی رزرو کنید یا بسته‌ای که تا کنکور همراهتان باشد."
        skeletonRows={3}
      >
        <div className="ds-stack-lg">
          {access.length > 0 && (
            <section className="ds-stack">
              <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                سهمیهٔ شما
              </h2>
              {access.map((item) => (
                <Card key={item.entitlementId}>
                  <div className="ds-row-between">
                    <div>
                      <h3 className="ds-title" style={{ fontSize: "var(--text-base)" }}>
                        {item.offering.headline}
                      </h3>
                      <p className="ds-subtitle" style={{ marginTop: "var(--sp-1)" }}>
                        <Link href={`/authors/${item.offering.instructorProfile.slug}`} className="text-link">
                          {item.offering.instructorProfile.displayName}
                        </Link>
                        {" · "}
                        {formatPersianNumber(item.offering.durationMinutes)} دقیقه در هر جلسه
                        {item.endAt ? ` · اعتبار تا ${formatDate(item.endAt)}` : ""}
                      </p>
                    </div>
                    {item.isExpired ? (
                      <Badge tone="danger">منقضی شده</Badge>
                    ) : item.sessionsRemaining === 0 ? (
                      <Badge>سهمیه تمام شد</Badge>
                    ) : (
                      <Badge tone="success">
                        {formatPersianNumber(item.sessionsRemaining)} جلسهٔ باقی‌مانده
                      </Badge>
                    )}
                  </div>

                  <p className="ds-hint" style={{ marginTop: "var(--sp-3)" }}>
                    {formatPersianNumber(item.sessionsUsed)} از{" "}
                    {formatPersianNumber(item.offering.sessionQuota)} جلسه استفاده شده. جلسه‌ای که لغو شود به
                    سهمیه برمی‌گردد.
                  </p>

                  <div className="ds-row" style={{ marginTop: "var(--sp-4)" }}>
                    <Button
                      variant="primary"
                      disabled={!item.isBookable || busy !== null}
                      onClick={() => {
                        setActionError(null);
                        setNotice(null);
                        setSlots(["", "", ""]);
                        setStudentNote("");
                        setBooking(item);
                      }}
                    >
                      رزرو جلسه
                    </Button>
                  </div>
                </Card>
              ))}
            </section>
          )}

          <section className="ds-stack">
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
              جلسه‌ها
            </h2>
            {bookings.length === 0 ? (
              <Card>
                <p className="ds-subtitle" style={{ margin: 0 }}>
                  هنوز جلسه‌ای رزرو نکرده‌اید.
                </p>
              </Card>
            ) : (
              bookings.map((item) => {
                const status = STATUS[item.status];
                return (
                  <Card key={item.id}>
                    <div className="ds-row-between">
                      <div>
                        <h3 className="ds-title" style={{ fontSize: "var(--text-base)" }}>
                          {item.offering.headline}
                        </h3>
                        <p className="ds-subtitle" style={{ marginTop: "var(--sp-1)" }}>
                          {item.offering.instructorProfile.displayName} ·{" "}
                          {formatPersianNumber(item.durationMinutes)} دقیقه
                        </p>
                      </div>
                      <Badge tone={status.tone}>{status.text}</Badge>
                    </div>

                    <div className="ds-stack-sm" style={{ marginTop: "var(--sp-4)" }}>
                      {item.scheduledAt ? (
                        <p>
                          <strong>زمان جلسه:</strong> {formatDateTime(item.scheduledAt)}
                        </p>
                      ) : (
                        <div>
                          <strong>زمان‌هایی که پیشنهاد دادید:</strong>
                          <ul style={{ margin: "var(--sp-2) 0 0", paddingInlineStart: "1.25rem" }}>
                            {item.requestedSlots.map((slot) => (
                              <li key={slot}>{formatDateTime(slot)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.meetingUrl && (
                        <p>
                          <strong>لینک جلسه:</strong>{" "}
                          <a href={item.meetingUrl} className="text-link" target="_blank" rel="noreferrer">
                            {item.meetingUrl}
                          </a>
                        </p>
                      )}
                      {item.instructorNote && (
                        <p style={{ color: "var(--muted)" }}>
                          <strong style={{ color: "var(--ink)" }}>یادداشت مدرس:</strong> {item.instructorNote}
                        </p>
                      )}
                      {item.cancelReason && (
                        <p style={{ color: "var(--muted)" }}>
                          <strong style={{ color: "var(--ink)" }}>دلیل لغو:</strong> {item.cancelReason}
                        </p>
                      )}
                    </div>

                    {(item.status === "REQUESTED" || item.status === "CONFIRMED") && (
                      <div className="ds-row" style={{ marginTop: "var(--sp-4)" }}>
                        <Button
                          variant="danger"
                          disabled={busy !== null}
                          onClick={() => {
                            setActionError(null);
                            setNotice(null);
                            setCancelReason("");
                            setCancelling(item);
                          }}
                        >
                          لغو جلسه
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </section>
        </div>
      </DataState>

      <ConfirmDialog
        open={booking !== null}
        title="چه زمان‌هایی برایتان مناسب است؟"
        description="تا سه زمان پیشنهاد دهید. مدرس یکی از آن‌ها یا زمان دیگری را تأیید می‌کند و همین‌جا به شما نشان داده می‌شود."
        confirmLabel="ثبت درخواست"
        busy={busy === `${booking?.entitlementId}:book`}
        confirmDisabled={slots.every((slot) => !slot.trim())}
        onConfirm={() => void submitBooking()}
        onCancel={() => setBooking(null)}
      >
        <div className="ds-stack-sm">
          {slots.map((slot, index) => (
            <Field
              key={index}
              label={`زمان پیشنهادی ${formatPersianNumber(index + 1)}`}
              required={index === 0}
            >
              {(props) => (
                <Input
                  {...props}
                  type="datetime-local"
                  value={slot}
                  onChange={(event) =>
                    setSlots(slots.map((current, position) => (position === index ? event.target.value : current)))
                  }
                />
              )}
            </Field>
          ))}
          <Field label="می‌خواهید در این جلسه روی چه چیزی کار کنید؟" hint="اختیاری، ولی کمک می‌کند جلسه مفیدتر باشد">
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={studentNote}
                onChange={(event) => setStudentNote(event.target.value)}
              />
            )}
          </Field>
          {actionError && <Alert tone="danger">{actionError}</Alert>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling !== null}
        title="این جلسه لغو شود؟"
        description="جلسه به سهمیهٔ شما بازمی‌گردد و می‌توانید دوباره رزرو کنید."
        confirmLabel="لغو کن"
        tone="danger"
        busy={busy === `${cancelling?.id}:cancel`}
        confirmDisabled={cancelReason.trim().length < 3}
        onConfirm={() => void submitCancel()}
        onCancel={() => {
          setCancelling(null);
          setCancelReason("");
        }}
      >
        <Field label="دلیل لغو" hint="برای مدرس نمایش داده می‌شود" required>
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          )}
        </Field>
        {actionError && (
          <div style={{ marginTop: "var(--sp-3)" }}>
            <Alert tone="danger">{actionError}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </div>
    </AccountShell>
  );
}
