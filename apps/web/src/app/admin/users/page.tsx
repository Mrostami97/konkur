"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { formatRial, toEnglishDigits, toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Pagination,
  Select,
  TableWrap,
} from "../../../components/ds";
import { useStaffRoles } from "../../../components/AdminGuard";

type Role = "STUDENT" | "MENTOR" | "AUTHOR" | "REVIEWER" | "ADMIN" | "FINANCE";

const ROLES: { value: Role; label: string; note: string }[] = [
  { value: "STUDENT", label: "دانشجو", note: "هر حساب تازه" },
  { value: "AUTHOR", label: "نویسنده", note: "مقاله، منبع، سؤال، آزمون و دوره" },
  { value: "REVIEWER", label: "بازبین", note: "بازبینی محتوا و ورود داده" },
  { value: "FINANCE", label: "مالی", note: "پرداخت‌ها، سفارش‌ها و سهم مدرسان" },
  { value: "MENTOR", label: "پشتیبان", note: "CRM و پیگیری دانشجوها" },
  { value: "ADMIN", label: "مدیر", note: "همهٔ بخش‌های پنل" },
];
const roleLabel = (role: Role) => ROLES.find((item) => item.value === role)?.label ?? role;

interface UserRow {
  id: string;
  phone: string;
  name: string | null;
  roles: Role[];
  createdAt: string;
  counts: { orders: number; entitlements: number; attempts: number };
}

interface UserDetail {
  id: string;
  phone: string;
  createdAt: string;
  hasPassword: boolean;
  roles: Role[];
  profile: { firstName: string | null; lastName: string | null; displayName: string | null; educationStatus: string | null; universityName: string | null; fieldOfStudy: string | null } | null;
  contributorProfile: { slug: string; displayName: string } | null;
  entitlements: { id: string; grantedVia: string; startAt: string; endAt: string | null; revokedAt: string | null; product: { title: string; kind: string } }[];
  orders: { id: string; status: string; totalAmountRial: number; createdAt: string; items: { product: { title: string } | null }[] }[];
  _count: { attempts: number; sessions: number; studySessions: number };
}

const PAGE_SIZE = 25;
const date = (iso: string) => new Date(iso).toLocaleDateString("fa-IR");
const localPhone = (phone: string) => toPersianDigits(phone.startsWith("+98") ? `0${phone.slice(3)}` : phone);

export default function UsersAdminPage() {
  const staffRoles = useStaffRoles();
  const isAdmin = staffRoles.includes("ADMIN");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: UserRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<{ role: Role; grant: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Typing searches after a pause; each keystroke is not a request.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedQuery(toEnglishDigits(query).trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (appliedQuery) params.set("q", appliedQuery);
    if (role) params.set("role", role);
    apiFetch<{ users: UserRow[]; total: number }>(`/admin/users?${params}`)
      .then(setData)
      .catch(() => setError("فهرست کاربران بارگذاری نشد."))
      .finally(() => setLoading(false));
  }, [page, appliedQuery, role]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(id: string) {
    setDetailError(null);
    setNotice(null);
    try {
      setSelected(await apiFetch<UserDetail>(`/admin/users/${id}`));
    } catch {
      setDetailError("جزئیات این کاربر بارگذاری نشد.");
    }
  }

  async function applyRoleChange() {
    if (!selected || !roleChange) return;
    setBusy(true);
    setDetailError(null);
    try {
      if (roleChange.grant) {
        await apiFetch(`/admin/users/${selected.id}/roles`, { method: "POST", body: { role: roleChange.role } });
      } else {
        await apiFetch(`/admin/users/${selected.id}/roles/${roleChange.role}`, { method: "DELETE" });
      }
      setNotice(`نقش «${roleLabel(roleChange.role)}» ${roleChange.grant ? "داده شد" : "گرفته شد"}.`);
      await open(selected.id);
      load();
    } catch (err) {
      setDetailError(err instanceof Error && err.message.includes("last administrator")
        ? "آخرین مدیر سایت را نمی‌شود برداشت."
        : err instanceof Error && err.message.includes("your own")
          ? "نقش مدیر خودتان را نمی‌توانید بردارید."
          : "تغییر نقش ممکن نشد.");
    } finally {
      setBusy(false);
      setRoleChange(null);
    }
  }

  const name = (detail: UserDetail) =>
    [detail.profile?.firstName, detail.profile?.lastName].filter(Boolean).join(" ") || detail.profile?.displayName || "بدون نام";

  return (
    <>
      <AdminPageHeader
        title="کاربران و نقش‌ها"
        description="جست‌وجوی کاربر با شماره یا نام، دیدن خریدها و دسترسی‌ها، و دادن نقش نویسنده، بازبین، مالی یا مدیر."
      />

      <div className="users-layout">
        <Card padded={false}>
          <div className="ds-card-head users-filters">
            <input
              className="ds-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو: شماره (مثلاً ۰۹۱۲۳) یا نام"
              aria-label="جست‌وجوی کاربر"
            />
            <Select aria-label="نقش" value={role} onChange={(event) => { setRole(event.target.value as Role | ""); setPage(1); }}>
              <option value="">همهٔ نقش‌ها</option>
              {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </div>
          <div className={`ds-card-body ${data?.users.length && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading && !data}
              error={error}
              onRetry={load}
              isEmpty={data?.users.length === 0}
              emptyTitle="کاربری پیدا نشد"
              emptyDescription={appliedQuery || role ? "جست‌وجو یا فیلتر را تغییر دهید." : "هنوز کسی ثبت‌نام نکرده است."}
            >
              {data && (
                <TableWrap
                  pagination={
                    data.total > PAGE_SIZE ? (
                      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
                    ) : undefined
                  }
                >
                  <thead>
                    <tr>
                      <th>شماره</th>
                      <th>نام</th>
                      <th>نقش‌ها</th>
                      <th>خرید / آزمون</th>
                      <th>عضویت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr
                        key={user.id}
                        className={`users-row${selected?.id === user.id ? " is-on" : ""}`}
                        onClick={() => open(user.id)}
                      >
                        <td dir="ltr">
                          <button type="button" className="users-open" onClick={(event) => { event.stopPropagation(); void open(user.id); }}>
                            {localPhone(user.phone)}
                          </button>
                        </td>
                        <td>{user.name ?? "—"}</td>
                        <td>
                          <span className="users-roles">
                            {user.roles.filter((item) => item !== "STUDENT").map((item) => <Badge key={item} tone="info">{roleLabel(item)}</Badge>)}
                            {user.roles.every((item) => item === "STUDENT") && <span className="ds-hint">دانشجو</span>}
                          </span>
                        </td>
                        <td className="ds-table-numeric">
                          {toPersianDigits(user.counts.orders)} / {toPersianDigits(user.counts.attempts)}
                        </td>
                        <td>{date(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </DataState>
          </div>
        </Card>

        <aside className="users-detail" aria-live="polite">
          {detailError && <Alert tone="danger">{detailError}</Alert>}
          {!selected ? (
            <Card>
              <p className="ds-subtitle">برای دیدن جزئیات و نقش‌ها، روی یک کاربر بزنید.</p>
            </Card>
          ) : (
            <Card>
              <div className="ds-stack">
                <div>
                  <h2 className="ds-card-title">{name(selected)}</h2>
                  <p className="ds-subtitle" dir="ltr" style={{ textAlign: "right" }}>{localPhone(selected.phone)}</p>
                  <p className="ds-hint">
                    عضو از {date(selected.createdAt)} · {toPersianDigits(selected._count.attempts)} آزمون ·{" "}
                    {toPersianDigits(selected._count.studySessions)} جلسهٔ مطالعهٔ ثبت‌شده
                    {selected.hasPassword ? " · ورود با رمز فعال" : ""}
                  </p>
                  {selected.profile?.universityName && (
                    <p className="ds-hint">{[selected.profile.fieldOfStudy, selected.profile.universityName].filter(Boolean).join(" · ")}</p>
                  )}
                  {selected.contributorProfile && (
                    <p className="ds-hint">
                      پروفایل مدرس/نویسنده: <Link href={`/authors/${selected.contributorProfile.slug}`}>{selected.contributorProfile.displayName}</Link>
                    </p>
                  )}
                </div>

                {notice && <Alert tone="success">{notice}</Alert>}

                <div>
                  <h3 className="users-h3">نقش‌ها</h3>
                  <ul className="users-role-list">
                    {ROLES.map((item) => {
                      const has = selected.roles.includes(item.value);
                      return (
                        <li key={item.value}>
                          <span>
                            <b>{item.label}</b>
                            <small>{item.note}</small>
                          </span>
                          {isAdmin ? (
                            <Button
                              size="sm"
                              variant={has ? "ghost" : "secondary"}
                              onClick={() => setRoleChange({ role: item.value, grant: !has })}
                            >
                              {has ? "برداشتن" : "دادن"}
                            </Button>
                          ) : (
                            has && <Badge tone="info">دارد</Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h3 className="users-h3">دسترسی‌ها</h3>
                  {selected.entitlements.length === 0 ? (
                    <p className="ds-hint">دسترسی فعالی ندارد.</p>
                  ) : (
                    <ul className="ds-plain-list">
                      {selected.entitlements.map((row) => {
                        const ended = row.revokedAt || (row.endAt && new Date(row.endAt) < new Date());
                        return (
                          <li key={row.id}>
                            {row.product.title}{" "}
                            <Badge tone={ended ? "neutral" : "success"}>{row.revokedAt ? "لغوشده" : ended ? "پایان‌یافته" : "فعال"}</Badge>
                            <span className="ds-hint"> · از {date(row.startAt)}{row.endAt ? ` تا ${date(row.endAt)}` : ""}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Link className="ds-btn ds-btn-ghost ds-btn-sm" href="/admin/commerce">اعطای دسترسی تازه</Link>
                </div>

                <div>
                  <h3 className="users-h3">سفارش‌های اخیر</h3>
                  {selected.orders.length === 0 ? (
                    <p className="ds-hint">سفارشی ندارد.</p>
                  ) : (
                    <ul className="ds-plain-list">
                      {selected.orders.map((order) => (
                        <li key={order.id}>
                          {order.items.map((item) => item.product?.title).filter(Boolean).join("، ") || "سفارش"} ·{" "}
                          {formatRial(order.totalAmountRial)} ·{" "}
                          <Badge tone={order.status === "PAID" ? "success" : "neutral"}>
                            {order.status === "PAID" ? "پرداخت‌شده" : order.status === "PENDING" ? "در انتظار" : "بسته‌شده"}
                          </Badge>
                          <span className="ds-hint"> · {date(order.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(roleChange)}
        title={roleChange?.grant ? "دادن نقش؟" : "برداشتن نقش؟"}
        description={
          roleChange && selected
            ? `نقش «${roleLabel(roleChange.role)}» ${roleChange.grant ? "به" : "از"} ${localPhone(selected.phone)} ${roleChange.grant ? "داده" : "گرفته"} می‌شود و از درخواست بعدی او اثر دارد.`
            : ""
        }
        confirmLabel={roleChange?.grant ? "بده" : "بردار"}
        busy={busy}
        onConfirm={applyRoleChange}
        onCancel={() => setRoleChange(null)}
      />
    </>
  );
}
