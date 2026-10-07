"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { formatToman, toPersianDigits } from "../../../lib/format";
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
  Select,
  TableWrap,
} from "../../../components/ds";

interface Product {
  id: string;
  title: string;
  isActive: boolean;
}

interface DiscountCode {
  id: string;
  code: string;
  note: string | null;
  percentOff: number | null;
  amountOffRial: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxPerUser: number;
  isActive: boolean;
  products: { id: string; title: string }[];
  paidUses: number;
  pendingUses: number;
  discountGivenRial: number;
}

type Kind = "percent" | "amount";

const EMPTY_FORM = {
  code: "",
  note: "",
  kind: "percent" as Kind,
  percentOff: "",
  amountOffToman: "",
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  maxPerUser: "1",
  productIds: [] as string[],
};

/** Persian or Arabic digits typed into a number field, as an integer. */
function toInt(value: string) {
  const latin = value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const digits = latin.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : undefined;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" });
}

function amountLabel(code: DiscountCode) {
  return code.percentOff !== null ? `${toPersianDigits(code.percentOff)}٪` : formatToman(code.amountOffRial ?? 0);
}

/** Where a code stands right now, in the order a buyer would hit the reasons. */
function state(code: DiscountCode): { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" } {
  const now = Date.now();
  if (!code.isActive) return { label: "غیرفعال", tone: "neutral" };
  if (code.endsAt && new Date(code.endsAt).getTime() <= now) return { label: "مهلت تمام شده", tone: "neutral" };
  if (code.startsAt && new Date(code.startsAt).getTime() > now) return { label: "هنوز شروع نشده", tone: "info" };
  if (code.maxRedemptions !== null && code.paidUses + code.pendingUses >= code.maxRedemptions) return { label: "ظرفیت پر", tone: "warning" };
  return { label: "فعال", tone: "success" };
}

/** A random code that is easy to read aloud: no 0/O or 1/I. */
function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export default function DiscountCodesAdminPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [action, setAction] = useState<{ code: DiscountCode; kind: "toggle" | "delete" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCodes, nextProducts] = await Promise.all([
        apiFetch<DiscountCode[]>("/admin/discount-codes"),
        apiFetch<Product[]>("/admin/products"),
      ]);
      setCodes(nextCodes);
      setProducts(nextProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن کدهای تخفیف ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleProduct = (id: string) =>
    update("productIds", form.productIds.includes(id) ? form.productIds.filter((p) => p !== id) : [...form.productIds, id]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setNotice(null);
    const percentOff = form.kind === "percent" ? toInt(form.percentOff) : undefined;
    const amountToman = form.kind === "amount" ? toInt(form.amountOffToman) : undefined;
    const maxRedemptions = toInt(form.maxRedemptions);
    try {
      const created = await apiFetch<{ code: string }>("/admin/discount-codes", {
        method: "POST",
        body: {
          code: form.code,
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
          ...(percentOff !== undefined ? { percentOff } : {}),
          ...(amountToman !== undefined ? { amountOffRial: amountToman * 10 } : {}),
          ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
          ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
          ...(maxRedemptions !== undefined ? { maxRedemptions } : {}),
          maxPerUser: toInt(form.maxPerUser) ?? 1,
          productIds: form.productIds,
        },
      });
      setForm(EMPTY_FORM);
      setNotice(`کد ${created.code} ساخته شد و از همین حالا در صفحهٔ خرید پذیرفته می‌شود.`);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "ساخت کد ناموفق بود.");
    } finally {
      setCreating(false);
    }
  }

  async function runAction() {
    if (!action) return;
    setBusy(true);
    setActionError(null);
    try {
      if (action.kind === "delete") {
        await apiFetch(`/admin/discount-codes/${action.code.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/admin/discount-codes/${action.code.id}`, { method: "PATCH", body: { isActive: !action.code.isActive } });
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این کار ممکن نشد.");
    } finally {
      setAction(null);
      setBusy(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  const sellable = products.filter((product) => product.isActive);

  return (
    <>
      <AdminPageHeader
        title="کدهای تخفیف"
        description="خریدار کد را در صفحهٔ دوره کنار دکمهٔ خرید می‌نویسد و مبلغ سفارشش کم می‌شود. کدی که کل مبلغ را بپوشاند، سفارش را بی‌نیاز از واریز و بررسی، همان لحظه فعال می‌کند."
      />

      <div className="ds-stack-lg">
        <Card>
          <h2 className="ds-card-title">کد تازه</h2>
          <form onSubmit={create} className="ds-form">
            <FieldRow>
              <Field label="کد" hint="۳ تا ۳۲ حرف لاتین، عدد یا خط تیره؛ بزرگی و کوچکی حروف مهم نیست" required>
                {(props) => (
                  <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
                    <Input
                      {...props}
                      dir="ltr"
                      value={form.code}
                      onChange={(event) => update("code", event.target.value.toUpperCase())}
                      placeholder="KONKUR1406"
                      maxLength={32}
                      required
                    />
                    <Button type="button" variant="ghost" onClick={() => update("code", randomCode())}>
                      کد تصادفی
                    </Button>
                  </div>
                )}
              </Field>
              <Field label="یادداشت داخلی" hint="فقط در همین پنل دیده می‌شود؛ مثلاً «کمپین تلگرام مهر»">
                {(props) => <Input {...props} value={form.note} onChange={(event) => update("note", event.target.value)} maxLength={200} />}
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="نوع تخفیف" required>
                {(props) => (
                  <Select {...props} value={form.kind} onChange={(event) => update("kind", event.target.value as Kind)}>
                    <option value="percent">درصدی</option>
                    <option value="amount">مبلغ ثابت</option>
                  </Select>
                )}
              </Field>
              {form.kind === "percent" ? (
                <Field label="درصد تخفیف" hint="۱ تا ۱۰۰؛ ۱۰۰ یعنی رایگان" required>
                  {(props) => (
                    <Input {...props} value={form.percentOff} onChange={(event) => update("percentOff", event.target.value)} inputMode="numeric" placeholder="۲۰" required />
                  )}
                </Field>
              ) : (
                <Field label="مبلغ تخفیف (تومان)" hint="اگر از قیمت بیشتر باشد، سفارش رایگان می‌شود" required>
                  {(props) => (
                    <Input {...props} value={form.amountOffToman} onChange={(event) => update("amountOffToman", event.target.value)} inputMode="numeric" placeholder="۱۰۰٬۰۰۰" required />
                  )}
                </Field>
              )}
            </FieldRow>

            <FieldRow>
              <Field label="شروع" hint="خالی یعنی از همین حالا">
                {(props) => <Input {...props} type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)} />}
              </Field>
              <Field label="پایان" hint="خالی یعنی بدون مهلت">
                {(props) => <Input {...props} type="datetime-local" value={form.endsAt} onChange={(event) => update("endsAt", event.target.value)} />}
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="سقف کل استفاده" hint="خالی یعنی بی‌سقف؛ سفارش باز هم یک استفاده حساب می‌شود تا لغو شود">
                {(props) => (
                  <Input {...props} value={form.maxRedemptions} onChange={(event) => update("maxRedemptions", event.target.value)} inputMode="numeric" />
                )}
              </Field>
              <Field label="سقف استفادهٔ هر نفر" required>
                {(props) => (
                  <Input {...props} value={form.maxPerUser} onChange={(event) => update("maxPerUser", event.target.value)} inputMode="numeric" required />
                )}
              </Field>
            </FieldRow>

            <div className="ds-field">
              <span className="ds-label">محصول‌ها</span>
              {sellable.length === 0 ? (
                <p className="ds-hint">هنوز محصول فعالی نیست؛ کد روی همهٔ محصول‌ها کار خواهد کرد.</p>
              ) : (
                <div className="ach-subjects">
                  {sellable.map((product) => (
                    <label key={product.id} className={`ach-chip${form.productIds.includes(product.id) ? " ach-chip-on" : ""}`}>
                      <input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
                      {product.title}
                    </label>
                  ))}
                </div>
              )}
              <p className="ds-hint">هیچ‌کدام را انتخاب نکنید تا کد روی همهٔ محصول‌ها کار کند.</p>
            </div>

            {createError && <Alert tone="danger">{createError}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}
            <div>
              <Button type="submit" variant="primary" loading={creating}>
                ساخت کد
              </Button>
            </div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head">
            <div>
              <h2 className="ds-card-title">کدها</h2>
              <p>استفادهٔ «باز» سفارشی است که هنوز پرداخت یا لغو نشده؛ تا آن موقع جای کد را نگه می‌دارد.</p>
            </div>
          </div>
          <div className={`ds-card-body ${codes.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={codes.length === 0}
              onRetry={load}
              emptyTitle="هنوز کد تخفیفی ساخته نشده"
              emptyDescription="با فرم بالا اولین کد را بسازید."
            >
              {actionError && (
                <div style={{ padding: "var(--sp-4)" }}>
                  <Alert tone="danger">{actionError}</Alert>
                </div>
              )}
              <TableWrap>
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>تخفیف</th>
                    <th>محصول</th>
                    <th>بازه</th>
                    <th>استفاده</th>
                    <th>تخفیف داده‌شده</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => {
                    const current = state(code);
                    const used = code.paidUses + code.pendingUses;
                    return (
                      <tr key={code.id}>
                        <td>
                          <button type="button" className="text-link" dir="ltr" onClick={() => void copy(code.code)} title="کپی کد">
                            <strong>{code.code}</strong>
                          </button>
                          {copied === code.code && <small className="ds-hint" style={{ margin: 0, marginInlineStart: "var(--sp-2)" }}>کپی شد</small>}
                          {code.note && <div className="ds-hint" style={{ margin: 0 }}>{code.note}</div>}
                        </td>
                        <td className="ds-table-numeric">{amountLabel(code)}</td>
                        <td>{code.products.length ? code.products.map((product) => product.title).join("، ") : "همه"}</td>
                        <td>
                          {code.startsAt || code.endsAt ? (
                            <span className="ds-hint" style={{ margin: 0 }}>
                              {code.startsAt ? `از ${formatDate(code.startsAt)}` : ""}
                              {code.startsAt && code.endsAt ? " · " : ""}
                              {code.endsAt ? `تا ${formatDate(code.endsAt)}` : ""}
                            </span>
                          ) : (
                            "بدون مهلت"
                          )}
                        </td>
                        <td className="ds-table-numeric">
                          {toPersianDigits(used)}
                          {code.maxRedemptions !== null ? ` از ${toPersianDigits(code.maxRedemptions)}` : ""}
                          {code.pendingUses > 0 && (
                            <div className="ds-hint" style={{ margin: 0 }}>
                              {toPersianDigits(code.pendingUses)} باز
                            </div>
                          )}
                        </td>
                        <td className="ds-table-numeric">{code.discountGivenRial ? formatToman(code.discountGivenRial) : "—"}</td>
                        <td>
                          <Badge tone={current.tone}>{current.label}</Badge>
                        </td>
                        <td>
                          <div className="ds-table-actions">
                            <Button size="sm" variant="ghost" onClick={() => setAction({ code, kind: "toggle" })}>
                              {code.isActive ? "غیرفعال کردن" : "فعال کردن"}
                            </Button>
                            {used === 0 && (
                              <Button size="sm" variant="ghost" onClick={() => setAction({ code, kind: "delete" })}>
                                حذف
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={action !== null}
        title={
          action?.kind === "delete"
            ? `حذف کد ${action.code.code}؟`
            : action?.code.isActive
              ? `غیرفعال کردن ${action.code.code}؟`
              : `فعال کردن ${action?.code.code ?? ""}؟`
        }
        description={
          action?.kind === "delete"
            ? "کد برای همیشه پاک می‌شود. فقط کدی که در هیچ سفارشی استفاده نشده حذف‌شدنی است."
            : action?.code.isActive
              ? "از این لحظه کد در خرید پذیرفته نمی‌شود. سفارش‌هایی که با آن ثبت شده‌اند دست نمی‌خورند."
              : "کد دوباره در خرید پذیرفته می‌شود، با همان بازه و سقف‌ها."
        }
        confirmLabel={action?.kind === "delete" ? "حذف کد" : action?.code.isActive ? "غیرفعال کن" : "فعال کن"}
        tone={action?.kind === "delete" || action?.code.isActive ? "danger" : "primary"}
        busy={busy}
        onConfirm={() => void runAction()}
        onCancel={() => setAction(null)}
      />
    </>
  );
}
