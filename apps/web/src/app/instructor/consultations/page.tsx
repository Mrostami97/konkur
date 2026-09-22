"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { formatPersianNumber } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Field,
  Input,
  Select,
  Textarea,
} from "../../../components/ds";

type BookingStatus = "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

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
  offering: { id: string; headline: string; kind: "SINGLE_SESSION" | "PACKAGE" };
  student: { id: string; phone: string; profile: { displayName: string | null } | null };
}

const STATUS_LABEL: Record<BookingStatus, { text: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  REQUESTED: { text: "در انتظار زمان‌دهی", tone: "warning" },
  CONFIRMED: { text: "زمان تعیین شد", tone: "info" },
  COMPLETED: { text: "برگزار شد", tone: "success" },
  CANCELLED: { text: "لغو شد", tone: "neutral" },
  NO_SHOW: { text: "غیبت دانشجو", tone: "danger" },
};

/** The API sends UTC ISO strings; the panel is read in Iran. */
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  });
}

/** `datetime-local` wants a local wall-clock string with no zone. */
function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(offsetMs).toISOString().slice(0, 16);
}

export default function InstructorConsultationsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | BookingStatus>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [instructorNote, setInstructorNote] = useState("");

  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : "";
      setRows(await apiFetch<Booking[]>(`/me/instructor/consultations${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن جلسه‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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

  function openConfirm(booking: Booking) {
    setActionError(null);
    setNotice(null);
    // Pre-fill with the student's first suggestion; the instructor is free to
    // pick any other time.
    const first = booking.scheduledAt ?? booking.requestedSlots[0];
    setScheduledAt(first ? toLocalInputValue(first) : "");
    setMeetingUrl(booking.meetingUrl ?? "");
    setInstructorNote(booking.instructorNote ?? "");
    setConfirming(booking);
  }

  async function submitConfirm() {
    const booking = confirming;
    if (!booking || !scheduledAt) return;
    const ok = await run(`${booking.id}:confirm`, async () => {
      await apiFetch(`/me/instructor/consultations/${booking.id}/confirm`, {
        method: "POST",
        body: {
          scheduledAt: new Date(scheduledAt).toISOString(),
          ...(meetingUrl.trim() ? { meetingUrl: meetingUrl.trim() } : {}),
          ...(instructorNote.trim() ? { instructorNote: instructorNote.trim() } : {}),
        },
      });
      return "زمان جلسه ثبت شد. دانشجو آن را در بخش مشاوره‌های خودش می‌بیند.";
    });
    if (ok) setConfirming(null);
  }

  async function submitCancel() {
    const booking = cancelling;
    const reason = cancelReason.trim();
    if (!booking || !reason) return;
    const ok = await run(`${booking.id}:cancel`, async () => {
      await apiFetch(`/me/instructor/consultations/${booking.id}/cancel`, {
        method: "POST",
        body: { reason },
      });
      return "جلسه لغو شد و به سهمیهٔ دانشجو بازگشت.";
    });
    if (ok) {
      setCancelling(null);
      setCancelReason("");
    }
  }

  function close(booking: Booking, outcome: "complete" | "no-show") {
    void run(`${booking.id}:${outcome}`, async () => {
      await apiFetch(`/me/instructor/consultations/${booking.id}/${outcome}`, {
        method: "POST",
        body: {},
      });
      return outcome === "complete"
        ? "جلسه به‌عنوان برگزارشده ثبت شد."
        : "غیبت ثبت شد. این جلسه از سهمیهٔ دانشجو کسر می‌ماند.";
    });
  }

  return (
    <>
      <AdminPageHeader
        title="جلسه‌های مشاوره"
        description="درخواست‌های دانشجویانی که مشاورهٔ شما را خریده‌اند. زمان را شما تعیین می‌کنید؛ تقویمی برای پر کردن وجود ندارد."
      />

      <div className="ds-stack-lg">
        <Card>
          <div className="ds-row">
            <div style={{ width: "16rem" }}>
              <Field label="فیلتر وضعیت">
                {(props) => (
                  <Select
                    {...props}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "" | BookingStatus)}
                  >
                    <option value="">همه</option>
                    <option value="REQUESTED">در انتظار زمان‌دهی</option>
                    <option value="CONFIRMED">زمان تعیین شد</option>
                    <option value="COMPLETED">برگزار شد</option>
                    <option value="CANCELLED">لغو شد</option>
                    <option value="NO_SHOW">غیبت دانشجو</option>
                  </Select>
                )}
              </Field>
            </div>
          </div>
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          {notice && !actionError && <Alert tone="success">{notice}</Alert>}
        </Card>

        <DataState
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          onRetry={load}
          emptyTitle="جلسه‌ای در این وضعیت نیست"
          emptyDescription="وقتی دانشجویی مشاورهٔ شما را بخرد و زمان پیشنهاد دهد، درخواستش اینجا می‌آید."
          skeletonRows={4}
        >
          <div className="ds-stack">
            {rows.map((booking) => {
              const status = STATUS_LABEL[booking.status];
              const studentName = booking.student.profile?.displayName?.trim() || "بدون نام";
              return (
                <Card key={booking.id}>
                  <div className="ds-row-between">
                    <div>
                      <h3 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                        {studentName}
                      </h3>
                      <p className="ds-subtitle" style={{ marginTop: "var(--sp-1)" }}>
                        <a href={`tel:${booking.student.phone}`} className="text-link">
                          {booking.student.phone}
                        </a>
                        {" · "}
                        {booking.offering.headline}
                        {" · "}
                        {formatPersianNumber(booking.durationMinutes)} دقیقه
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.text}</Badge>
                  </div>

                  <div className="ds-stack-sm" style={{ marginTop: "var(--sp-4)" }}>
                    {booking.scheduledAt ? (
                      <p>
                        <strong>زمان جلسه:</strong> {formatDateTime(booking.scheduledAt)}
                      </p>
                    ) : (
                      <div>
                        <strong>زمان‌های پیشنهادی دانشجو:</strong>
                        <ul style={{ margin: "var(--sp-2) 0 0", paddingInlineStart: "1.25rem" }}>
                          {booking.requestedSlots.map((slot) => (
                            <li key={slot}>{formatDateTime(slot)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {booking.meetingUrl && (
                      <p>
                        <strong>لینک جلسه:</strong>{" "}
                        <a href={booking.meetingUrl} className="text-link" target="_blank" rel="noreferrer">
                          {booking.meetingUrl}
                        </a>
                      </p>
                    )}
                    {booking.studentNote && (
                      <p style={{ color: "var(--muted)" }}>
                        <strong style={{ color: "var(--ink)" }}>یادداشت دانشجو:</strong> {booking.studentNote}
                      </p>
                    )}
                    {booking.instructorNote && (
                      <p style={{ color: "var(--muted)" }}>
                        <strong style={{ color: "var(--ink)" }}>یادداشت شما:</strong> {booking.instructorNote}
                      </p>
                    )}
                    {booking.cancelReason && (
                      <p style={{ color: "var(--muted)" }}>
                        <strong style={{ color: "var(--ink)" }}>دلیل لغو:</strong> {booking.cancelReason}
                      </p>
                    )}
                  </div>

                  {(booking.status === "REQUESTED" || booking.status === "CONFIRMED") && (
                    <div className="ds-row" style={{ marginTop: "var(--sp-5)" }}>
                      <Button variant="primary" onClick={() => openConfirm(booking)} disabled={busy !== null}>
                        {booking.status === "REQUESTED" ? "تعیین زمان" : "تغییر زمان"}
                      </Button>
                      {booking.status === "CONFIRMED" && (
                        <>
                          <Button
                            onClick={() => close(booking, "complete")}
                            loading={busy === `${booking.id}:complete`}
                            disabled={busy !== null}
                          >
                            برگزار شد
                          </Button>
                          <Button
                            onClick={() => close(booking, "no-show")}
                            loading={busy === `${booking.id}:no-show`}
                            disabled={busy !== null}
                          >
                            دانشجو نیامد
                          </Button>
                        </>
                      )}
                      <Button
                        variant="danger"
                        onClick={() => {
                          setActionError(null);
                          setNotice(null);
                          setCancelReason("");
                          setCancelling(booking);
                        }}
                        disabled={busy !== null}
                      >
                        لغو جلسه
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </DataState>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="زمان این جلسه را تعیین کنید"
        description="می‌توانید یکی از زمان‌های پیشنهادی دانشجو را بگذارید یا هر زمان دیگری. اگر زمان به دانشجو نخورد، خودش می‌تواند لغو کند و جلسه به سهمیه‌اش برمی‌گردد."
        confirmLabel="ثبت زمان"
        busy={busy === `${confirming?.id}:confirm`}
        confirmDisabled={!scheduledAt}
        onConfirm={() => void submitConfirm()}
        onCancel={() => setConfirming(null)}
      >
        <div className="ds-stack-sm">
          <Field label="زمان جلسه" required>
            {(props) => (
              <Input
                {...props}
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            )}
          </Field>
          <Field label="لینک جلسه" hint="اگر جلسه تلفنی یا حضوری است خالی بگذارید و در یادداشت توضیح دهید">
            {(props) => (
              <Input
                {...props}
                type="url"
                dir="ltr"
                placeholder="https://..."
                value={meetingUrl}
                onChange={(event) => setMeetingUrl(event.target.value)}
              />
            )}
          </Field>
          <Field label="یادداشت برای دانشجو">
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={instructorNote}
                onChange={(event) => setInstructorNote(event.target.value)}
              />
            )}
          </Field>
          {actionError && <Alert tone="danger">{actionError}</Alert>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling !== null}
        title="این جلسه لغو شود؟"
        description="جلسه به سهمیهٔ دانشجو بازمی‌گردد و می‌تواند دوباره رزرو کند."
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
        <Field label="دلیل لغو" hint="برای دانشجو نمایش داده می‌شود" required>
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
    </>
  );
}
