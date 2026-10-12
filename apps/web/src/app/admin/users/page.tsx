"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toEnglishDigits, toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Field,
  FieldRow,
  Input,
  Pagination,
  Select,
  TableWrap,
} from "../../../components/ds";

const PAGE_SIZE = 20;

type Role = "STUDENT" | "MENTOR" | "AUTHOR" | "REVIEWER" | "ADMIN" | "FINANCE";

/** What each role opens, in the words an operator decides by. */
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "STUDENT", label: "دانشجو", hint: "پنل دانشجو، آزمون و دوره‌های خریداری‌شده" },
  { value: "AUTHOR", label: "نویسنده", hint: "نوشتن مقاله، سؤال، آزمون و دوره" },
  { value: "REVIEWER", label: "بازبین", hint: "بازبینی و انتشار محتوا و ورود داده" },
  { value: "MENTOR", label: "مشاور", hint: "CRM و پیگیری دانشجوها" },
  { value: "FINANCE", label: "مالی", hint: "سفارش‌ها و تأیید پرداخت‌ها" },
  { value: "ADMIN", label: "مدیر", hint: "همهٔ بخش‌ها، از جمله همین صفحه" },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((role) => [role.value, role.label])) as Record<Role, string>;

interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  roles: Role[];
  hasPassword: boolean;
  createdAt: string;
}

const joined = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" });

/**
 * Accounts are kept apart (the API enforces the same): the main administrator
 * holds «مدیر» alone, a student holds «دانشجو» alone, and the staff roles may
 * be combined with each other. Ticking one kind clears the others.
 */
function nextRoles(current: Role[], role: Role, on: boolean): Role[] {
  if (!on) return current.filter((item) => item !== role);
  if (role === "ADMIN" || role === "STUDENT") return [role];
  return [...current.filter((item) => item !== "ADMIN" && item !== "STUDENT"), role];
}

/** Every mobile number in one form, 0935…, however it was stored. */
function displayPhone(phone: string) {
  const tail = /9[0-9]{9}$/.exec(phone.replace(/[^0-9]/g, ""));
  return tail ? `0${tail[0]}` : phone;
}

/** An account left from before roles were kept apart: both a student and staff. */
function isMixed(roles: Role[]) {
  return roles.includes("STUDENT") && roles.length > 1;
}

function RolePicker({ value, onChange }: { value: Role[]; onChange: (roles: Role[]) => void }) {
  return (
    <div className="ds-stack">
      <div className="us-roles">
        {ROLES.map((role) => (
          <label key={role.value} className="us-role" data-on={value.includes(role.value) || undefined}>
            <input
              type="checkbox"
              checked={value.includes(role.value)}
              onChange={(event) => onChange(nextRoles(value, role.value, event.target.checked))}
            />
            <span>
              <strong>{role.label}</strong>
              <small>{role.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="ds-help">
        حساب مدیر، حساب دانشجو و حساب کارکنان از هم جدا هستند: «مدیر» و «دانشجو» هر کدام تنها می‌آیند و نقش‌های کارمندی با هم جمع می‌شوند.
        مدرس هم با وصل شدن حسابش به پروفایل مدرس مشخص می‌شود و دانشجو نیست.
      </p>
    </div>
  );
}

function CreateUser({ onCreated }: { onCreated: (user: AdminUser) => void }) {
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["STUDENT"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await apiFetch<AdminUser>("/admin/users", {
        method: "POST",
        body: { phone: toEnglishDigits(phone).replace(/\s/g, ""), firstName, lastName, roles },
      });
      setPhone("");
      setFirstName("");
      setLastName("");
      setRoles(["STUDENT"]);
      onCreated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ساخت کاربر ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="ds-card-title">کاربر تازه</h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
        تا وقتی پیامک وصل نیست، کاربر با شماره و رمزی که اینجا می‌گذارید وارد می‌شود. بعد از ساخت، از فهرست زیر برایش رمز بگذارید.
      </p>
      <form className="ds-form" onSubmit={submit}>
        <FieldRow>
          <Field label="شمارهٔ موبایل" hint="مثلاً ۰۹۱۲۱۲۳۴۵۶۷" required>
            {(props) => (
              <Input {...props} dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
            )}
          </Field>
          <Field label="نام">
            {(props) => <Input {...props} value={firstName} onChange={(event) => setFirstName(event.target.value)} />}
          </Field>
          <Field label="نام خانوادگی">
            {(props) => <Input {...props} value={lastName} onChange={(event) => setLastName(event.target.value)} />}
          </Field>
        </FieldRow>
        <div>
          <span className="ds-label">نقش‌ها</span>
          <RolePicker value={roles} onChange={setRoles} />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <Button type="submit" variant="primary" loading={busy} disabled={roles.length === 0}>ساخت کاربر</Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [applied, setApplied] = useState({ query: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [draftRoles, setDraftRoles] = useState<Role[]>([]);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [password, setPassword] = useState("");
  const [signOutTarget, setSignOutTarget] = useState<AdminUser | null>(null);
  const [phoneTarget, setPhoneTarget] = useState<AdminUser | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (applied.query) params.set("q", toEnglishDigits(applied.query));
      if (applied.role) params.set("role", applied.role);
      const data = await apiFetch<{ users: AdminUser[]; total: number }>(`/admin/users?${params}`);
      setRows(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست کاربران ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function closeDialogs() {
    setRoleTarget(null);
    setPasswordTarget(null);
    setSignOutTarget(null);
    setPhoneTarget(null);
    setDeleteTarget(null);
    setNewPhone("");
    setPassword("");
    setDialogError(null);
  }

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setDialogError(null);
    try {
      const message = await action();
      closeDialogs();
      setNotice(message);
      await load();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "انجام این کار ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (user: AdminUser) => user.name ?? toPersianDigits(displayPhone(user.phone));

  return (
    <>
      <AdminPageHeader
        title="کاربران و نقش‌ها"
        description="جست‌وجوی کاربران، دادن یا گرفتن نقش، گذاشتن رمز ورود، تغییر شمارهٔ ورود، بستن نشست‌ها و حذف حساب. هر تغییر در تاریخچهٔ ممیزی ثبت می‌شود."
      />
      <div className="ds-stack-lg">
        <Card padded={false}>
          <div className="ds-card-head">
            <form
              className="ds-row"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setApplied({ query, role });
              }}
            >
              <div className="ds-grow" style={{ minWidth: "12rem" }}>
                <Input placeholder="شماره یا نام" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="جست‌وجو" />
              </div>
              <div style={{ width: "12rem" }}>
                <Select value={role} onChange={(event) => setRole(event.target.value)} aria-label="نقش">
                  <option value="">همهٔ نقش‌ها</option>
                  {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <Button type="submit" variant="primary">جست‌وجو</Button>
            </form>
          </div>

          {notice && (
            <div style={{ padding: "var(--sp-4) var(--sp-4) 0" }}>
              <Alert tone="success">{notice}</Alert>
            </div>
          )}

          <div style={{ padding: rows.length && !loading && !error ? 0 : "var(--sp-4)" }}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={rows.length === 0}
              onRetry={load}
              emptyTitle="کاربری پیدا نشد"
              emptyDescription="با این جست‌وجو کاربری نیست. شماره را کامل‌تر بنویسید یا فیلتر نقش را بردارید."
              skeletonRows={6}
            >
              <TableWrap pagination={<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}>
                <thead>
                  <tr>
                    <th>کاربر</th>
                    <th>نقش‌ها</th>
                    <th>رمز ورود</th>
                    <th>عضویت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name ?? "بی‌نام"}</strong>
                        <div dir="ltr" style={{ color: "var(--muted)", fontSize: "var(--text-sm)", textAlign: "right" }}>
                          {toPersianDigits(displayPhone(user.phone))}
                        </div>
                      </td>
                      <td>
                        <div className="ds-row" style={{ gap: "var(--sp-1)" }}>
                          {user.roles.map((item) => (
                            <Badge key={item} tone={item === "ADMIN" ? "danger" : item === "STUDENT" ? "neutral" : "info"}>
                              {ROLE_LABEL[item] ?? item}
                            </Badge>
                          ))}
                          {isMixed(user.roles) && <Badge tone="warning">هم دانشجو، هم کارمند؛ یکی را نگه دارید</Badge>}
                        </div>
                      </td>
                      <td>{user.hasPassword ? <Badge tone="success">دارد</Badge> : <Badge>ندارد</Badge>}</td>
                      <td>{joined.format(new Date(user.createdAt))}</td>
                      <td>
                        <div className="ds-table-actions">
                          <Button size="sm" onClick={() => { closeDialogs(); setDraftRoles(user.roles); setRoleTarget(user); }}>نقش‌ها</Button>
                          <Button size="sm" onClick={() => { closeDialogs(); setPasswordTarget(user); }}>رمز ورود</Button>
                          <Button size="sm" onClick={() => { closeDialogs(); setNewPhone(user.phone); setPhoneTarget(user); }}>تغییر شماره</Button>
                          <Button size="sm" variant="ghost" onClick={() => { closeDialogs(); setSignOutTarget(user); }}>بستن نشست‌ها</Button>
                          <Button size="sm" variant="ghost" onClick={() => { closeDialogs(); setDeleteTarget(user); }}>حذف</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>

        <CreateUser
          onCreated={(user) => {
            setNotice(`${nameOf(user)} ساخته شد. برای ورودش از دکمهٔ «رمز ورود» یک رمز بگذارید.`);
            setApplied({ query: user.phone, role: "" });
            setQuery(user.phone);
            setRole("");
            setPage(1);
          }}
        />
      </div>

      <ConfirmDialog
        open={roleTarget !== null}
        title={`نقش‌های ${roleTarget ? nameOf(roleTarget) : ""}`}
        description="نقش‌ها همان لحظه اعمال می‌شوند. نقش مدیر را نمی‌شود از خودتان یا از تنها مدیر سامانه گرفت."
        confirmLabel="ذخیرهٔ نقش‌ها"
        busy={busy}
        confirmDisabled={draftRoles.length === 0}
        onConfirm={() =>
          void run(async () => {
            await apiFetch(`/admin/users/${roleTarget!.id}/roles`, { method: "PUT", body: { roles: draftRoles } });
            return `نقش‌های ${nameOf(roleTarget!)} به‌روز شد.`;
          })
        }
        onCancel={closeDialogs}
      >
        <RolePicker value={draftRoles} onChange={setDraftRoles} />
        {dialogError && <div style={{ marginTop: "var(--sp-3)" }}><Alert tone="danger">{dialogError}</Alert></div>}
      </ConfirmDialog>

      <ConfirmDialog
        open={passwordTarget !== null}
        title={`رمز ورود ${passwordTarget ? nameOf(passwordTarget) : ""}`}
        description="رمز تازه جای رمز قبلی را می‌گیرد و همهٔ نشست‌های باز این کاربر بسته می‌شود. رمز را از راهی امن به خودش بدهید."
        confirmLabel="ذخیرهٔ رمز"
        busy={busy}
        confirmDisabled={password.length < 8}
        onConfirm={() =>
          void run(async () => {
            await apiFetch(`/admin/users/${passwordTarget!.id}/password`, { method: "POST", body: { password } });
            return `رمز ورود ${nameOf(passwordTarget!)} ذخیره شد.`;
          })
        }
        onCancel={closeDialogs}
      >
        <Field label="رمز تازه" hint="دست‌کم ۸ نویسه" required>
          {(props) => (
            <Input {...props} type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          )}
        </Field>
        {dialogError && <div style={{ marginTop: "var(--sp-3)" }}><Alert tone="danger">{dialogError}</Alert></div>}
      </ConfirmDialog>

      <ConfirmDialog
        open={signOutTarget !== null}
        title={`نشست‌های ${signOutTarget ? nameOf(signOutTarget) : ""} بسته شود؟`}
        description="این کاربر از همهٔ دستگاه‌ها خارج می‌شود و باید دوباره وارد شود. برای وقتی که گوشی گم شده یا دسترسی باید فوراً قطع شود."
        confirmLabel="بستن همهٔ نشست‌ها"
        tone="danger"
        busy={busy}
        onConfirm={() =>
          void run(async () => {
            const result = await apiFetch<{ sessionsRevoked: number }>(`/admin/users/${signOutTarget!.id}/sessions/revoke`, { method: "POST" });
            return `${toPersianDigits(result.sessionsRevoked)} نشست بسته شد.`;
          })
        }
        onCancel={closeDialogs}
      >
        {dialogError && <Alert tone="danger">{dialogError}</Alert>}
      </ConfirmDialog>

      <ConfirmDialog
        open={phoneTarget !== null}
        title={`تغییر شمارهٔ ${phoneTarget ? nameOf(phoneTarget) : ""}`}
        description="شمارهٔ موبایل همان نام ورود است. بعد از تغییر، کاربر با شمارهٔ تازه (و همان رمز قبلی) وارد می‌شود. نشست‌های باز او بسته نمی‌شود."
        confirmLabel="ذخیرهٔ شماره"
        busy={busy}
        confirmDisabled={!/^(\+98|0098|98|0)?9[0-9]{9}$/.test(toEnglishDigits(newPhone).replace(/\s/g, ""))}
        onConfirm={() =>
          void run(async () => {
            await apiFetch(`/admin/users/${phoneTarget!.id}/phone`, {
              method: "PUT",
              body: { phone: toEnglishDigits(newPhone).replace(/\s/g, "") },
            });
            return `شمارهٔ ${nameOf(phoneTarget!)} عوض شد.`;
          })
        }
        onCancel={closeDialogs}
      >
        <Field label="شمارهٔ موبایل تازه" hint="مثلاً ۰۹۱۲۱۲۳۴۵۶۷" required>
          {(props) => (
            <Input {...props} dir="ltr" inputMode="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
          )}
        </Field>
        {dialogError && <div style={{ marginTop: "var(--sp-3)" }}><Alert tone="danger">{dialogError}</Alert></div>}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`حذف ${deleteTarget ? nameOf(deleteTarget) : ""}`}
        description="حساب برای همیشه پاک می‌شود، با نشست‌ها، سابقهٔ آزمون و مطالعه، سفارش‌های پرداخت‌نشده و دسترسی‌هایش. این کار برگشت ندارد. کاربری که خرید پرداخت‌شده یا جلسهٔ مشاوره دارد حذف نمی‌شود. نقش مدیر هم از این راه حذف می‌شود، جز حساب خودتان."
        confirmLabel="حذف برای همیشه"
        tone="danger"
        busy={busy}
        onConfirm={() =>
          void run(async () => {
            await apiFetch(`/admin/users/${deleteTarget!.id}`, { method: "DELETE" });
            return `${nameOf(deleteTarget!)} حذف شد.`;
          })
        }
        onCancel={closeDialogs}
      >
        {deleteTarget?.roles.includes("ADMIN") && (
          <div style={{ marginBottom: "var(--sp-3)" }}><Alert tone="warning">این حساب مدیر است.</Alert></div>
        )}
        {dialogError && <Alert tone="danger">{dialogError}</Alert>}
      </ConfirmDialog>
    </>
  );
}
