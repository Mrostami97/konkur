"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
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
  Textarea,
} from "../../../components/ds";

interface Course { id: string; title: string }
interface AdminUser { id: string; phone: string }

interface Product {
  id: string;
  slug: string;
  title: string;
  kind: ProductKind;
  prices: { amountRial: number; isActive: boolean }[];
  questionBankGrants?: { subjectCode: string }[];
}

interface Order {
  id: string;
  status: string;
  totalAmountRial: number;
  user: { phone: string };
}

type ProductKind = "COURSE" | "RESOURCE" | "BUNDLE" | "QUESTION_BANK";

const KINDS: { value: ProductKind; label: string; note: string }[] = [
  { value: "COURSE", label: "دوره", note: "یک دوره را باز می‌کند؛ می‌توانید بانک سؤال درس‌های مرتبط را هم رایگان همراهش کنید." },
  { value: "QUESTION_BANK", label: "بانک سؤال", note: "فقط بانک سؤال یک درس را باز می‌کند و مستقل از دوره فروخته می‌شود." },
  { value: "RESOURCE", label: "منبع", note: "دسترسی به یک منبع آموزشی." },
  { value: "BUNDLE", label: "بسته", note: "ترکیبی از چند مورد بالا." },
];
const kindLabel = (kind: ProductKind) => KINDS.find((item) => item.value === kind)?.label ?? kind;

const ORDER_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  PENDING: { label: "در انتظار پرداخت", tone: "warning" },
  PAID: { label: "پرداخت‌شده", tone: "success" },
  FAILED: { label: "ناموفق", tone: "danger" },
  CANCELLED: { label: "لغوشده", tone: "neutral" },
  REFUNDED: { label: "بازگردانده‌شده", tone: "neutral" },
};

const PAGE_SIZE = 20;
const activePrice = (product: Product) => product.prices.find((price) => price.isActive);

export default function CommerceAdminPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderPage, setOrderPage] = useState(1);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ProductKind>("COURSE");
  const [courseId, setCourseId] = useState("");
  const [bankSubjects, setBankSubjects] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [priceProductId, setPriceProductId] = useState("");
  const [amountRial, setAmountRial] = useState("");
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [grantUserId, setGrantUserId] = useState("");
  const [grantProductId, setGrantProductId] = useState("");
  const [grantVia, setGrantVia] = useState<"GIFT" | "TRIAL" | "MANUAL">("GIFT");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantConfirm, setGrantConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCourses, nextProducts, userResponse, nextOrders] = await Promise.all([
        apiFetch<Course[]>("/admin/courses"),
        apiFetch<Product[]>("/admin/products"),
        apiFetch<{ users: AdminUser[] }>("/admin/users"),
        apiFetch<Order[]>("/admin/orders"),
      ]);
      setCourses(nextCourses);
      setProducts(nextProducts);
      setUsers(userResponse.users);
      setOrders(nextOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن داده‌های فروش ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    const subjectCodes = bankSubjects.split(",").map((code) => code.trim()).filter(Boolean);
    try {
      await apiFetch("/admin/products", {
        method: "POST",
        body: {
          slug,
          title,
          description,
          kind,
          ...(kind === "COURSE" && courseId ? { courseId } : {}),
          ...(subjectCodes.length ? { questionBankSubjectCodes: subjectCodes } : {}),
        },
      });
      setSlug("");
      setTitle("");
      setDescription("");
      setBankSubjects("");
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "ساخت محصول ناموفق بود.");
    } finally {
      setCreating(false);
    }
  }

  async function addPrice(event: FormEvent) {
    event.preventDefault();
    setPricing(true);
    setPriceError(null);
    try {
      await apiFetch(`/admin/products/${priceProductId}/prices`, {
        method: "POST",
        body: { amountRial: Number(amountRial) },
      });
      setAmountRial("");
      await load();
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "ثبت قیمت ناموفق بود.");
    } finally {
      setPricing(false);
    }
  }

  async function grantEntitlement() {
    setGranting(true);
    setGrantError(null);
    try {
      await apiFetch("/admin/entitlements/grant", {
        method: "POST",
        body: { userId: grantUserId, productId: grantProductId, grantedVia: grantVia, reason: grantReason },
      });
      setGrantReason("");
      setGrantConfirm(false);
      await load();
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "اعطای دسترسی ناموفق بود.");
      setGrantConfirm(false);
    } finally {
      setGranting(false);
    }
  }

  const visibleOrders = orders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);
  const grantedUser = users.find((user) => user.id === grantUserId);
  const grantedProduct = products.find((product) => product.id === grantProductId);

  return (
    <>
      <AdminPageHeader
        title="فروش و دسترسی‌ها"
        description="محصول تعیین می‌کند خرید چه چیزی را باز می‌کند. دسترسی همیشه از روی محصول خوانده می‌شود، پس تغییر محصول روی خریدهای قبلی هم اثر دارد."
      />

      <div className="ds-stack-lg">
        <Card>
          <h2 className="ds-card-title">محصول تازه</h2>
          <form onSubmit={createProduct} className="ds-form">
            <FieldRow>
              <Field label="نشانی یکتا (slug)" hint="لاتین و با خط تیره، مثلاً algorithms-bank" required>
                {(props) => <Input {...props} value={slug} onChange={(event) => setSlug(event.target.value)} required />}
              </Field>
              <Field label="عنوان محصول" required>
                {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
              </Field>
            </FieldRow>

            <Field label="توضیح" required>
              {(props) => <Textarea {...props} value={description} onChange={(event) => setDescription(event.target.value)} required />}
            </Field>

            <Field label="نوع محصول" hint={KINDS.find((item) => item.value === kind)?.note} required>
              {(props) => (
                <Select {...props} value={kind} onChange={(event) => setKind(event.target.value as ProductKind)}>
                  {KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              )}
            </Field>

            {kind === "COURSE" && (
              <Field label="دورهٔ مرتبط" required>
                {(props) => (
                  <Select {...props} value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
                    <option value="">دوره را انتخاب کنید</option>
                    {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                  </Select>
                )}
              </Field>
            )}

            <Field
              label={kind === "QUESTION_BANK" ? "کد درسِ بانک" : "بانک سؤال همراه (اختیاری)"}
              hint={
                kind === "QUESTION_BANK"
                  ? "دسترسی بانک درس‌محور است؛ برای محصول بانک دقیقاً یک کد درس بدهید."
                  : "کد درس‌هایی که با خرید این محصول بانک سؤالشان هم رایگان باز می‌شود. چند کد را با کاما جدا کنید."
              }
              required={kind === "QUESTION_BANK"}
            >
              {(props) => (
                <Input
                  {...props}
                  value={bankSubjects}
                  onChange={(event) => setBankSubjects(event.target.value)}
                  placeholder="data-structures, algorithms"
                  required={kind === "QUESTION_BANK"}
                />
              )}
            </Field>

            {createError && <Alert tone="danger">{createError}</Alert>}
            <div><Button type="submit" variant="primary" loading={creating}>ساخت محصول</Button></div>
          </form>
        </Card>

        <Card>
          <h2 className="ds-card-title">افزودن قیمت</h2>
          <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
            قیمت تازه، قیمت فعال قبلی همان محصول را جایگزین می‌کند.
          </p>
          <form onSubmit={addPrice} className="ds-form">
            <FieldRow>
              <Field label="محصول" required>
                {(props) => (
                  <Select {...props} value={priceProductId} onChange={(event) => setPriceProductId(event.target.value)} required>
                    <option value="">محصول را انتخاب کنید</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="مبلغ (ریال)" required>
                {(props) => (
                  <Input {...props} value={amountRial} onChange={(event) => setAmountRial(event.target.value)} inputMode="numeric" required />
                )}
              </Field>
            </FieldRow>
            {priceError && <Alert tone="danger">{priceError}</Alert>}
            <div><Button type="submit" loading={pricing}>ثبت قیمت</Button></div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head"><h2 className="ds-card-title">محصول‌ها</h2></div>
          <div className={`ds-card-body ${products.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={products.length === 0}
              onRetry={load}
              emptyTitle="هنوز محصولی ساخته نشده"
              emptyDescription="با فرم بالا اولین محصول را بسازید."
            >
              <TableWrap>
                <thead><tr><th>عنوان</th><th>نوع</th><th>بانک همراه</th><th>قیمت فعال</th></tr></thead>
                <tbody>
                  {products.map((product) => {
                    const price = activePrice(product);
                    const banks = product.questionBankGrants ?? [];
                    return (
                      <tr key={product.id}>
                        <td>{product.title}</td>
                        <td><Badge tone="info">{kindLabel(product.kind)}</Badge></td>
                        <td className="ds-code">{banks.length ? banks.map((grant) => grant.subjectCode).join("، ") : "—"}</td>
                        <td className="ds-table-numeric">
                          {price ? `${price.amountRial.toLocaleString("fa-IR")} ریال` : <span className="ds-hint" style={{ margin: 0 }}>بدون قیمت فعال</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>

        <Card>
          <h2 className="ds-card-title">اعطای دسترسی</h2>
          <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
            برای هدیه، دورهٔ آزمایشی یا جبران خطا. دسترسی بلافاصله فعال می‌شود و در سوابق کاربر ثبت می‌ماند.
          </p>
          <form
            className="ds-form"
            onSubmit={(event) => { event.preventDefault(); setGrantConfirm(true); }}
          >
            <FieldRow>
              <Field label="کاربر" required>
                {(props) => (
                  <Select {...props} value={grantUserId} onChange={(event) => setGrantUserId(event.target.value)} required>
                    <option value="">کاربر را انتخاب کنید</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.phone}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="محصول" required>
                {(props) => (
                  <Select {...props} value={grantProductId} onChange={(event) => setGrantProductId(event.target.value)} required>
                    <option value="">محصول را انتخاب کنید</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                  </Select>
                )}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="نوع اعطا" required>
                {(props) => (
                  <Select {...props} value={grantVia} onChange={(event) => setGrantVia(event.target.value as "GIFT" | "TRIAL" | "MANUAL")}>
                    <option value="GIFT">هدیه</option>
                    <option value="TRIAL">آزمایشی</option>
                    <option value="MANUAL">جبرانی</option>
                  </Select>
                )}
              </Field>
              <Field label="دلیل" hint="در سوابق ثبت می‌شود؛ بعداً برای پیگیری لازم می‌شود" required>
                {(props) => <Input {...props} value={grantReason} onChange={(event) => setGrantReason(event.target.value)} required />}
              </Field>
            </FieldRow>
            {grantError && <Alert tone="danger">{grantError}</Alert>}
            <div><Button type="submit" variant="primary">اعطای دسترسی</Button></div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head">
            <div>
              <h2 className="ds-card-title">سفارش‌ها</h2>
              <p>سرویس همهٔ سفارش‌ها را یکجا برمی‌گرداند؛ صفحه‌بندی فعلاً سمت مرورگر است.</p>
            </div>
          </div>
          <div className={`ds-card-body ${visibleOrders.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={orders.length === 0}
              onRetry={load}
              emptyTitle="هنوز سفارشی ثبت نشده"
              emptyDescription="سفارش‌ها پس از اولین خرید اینجا دیده می‌شوند."
            >
              <TableWrap
                pagination={
                  orders.length > PAGE_SIZE ? (
                    <Pagination page={orderPage} pageSize={PAGE_SIZE} total={orders.length} onPageChange={setOrderPage} />
                  ) : undefined
                }
              >
                <thead><tr><th>کاربر</th><th>وضعیت</th><th>مبلغ</th></tr></thead>
                <tbody>
                  {visibleOrders.map((order) => {
                    const status = ORDER_STATUS[order.status];
                    return (
                      <tr key={order.id}>
                        <td className="ds-code">{order.user.phone}</td>
                        <td>{status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge>{order.status}</Badge>}</td>
                        <td className="ds-table-numeric">{order.totalAmountRial.toLocaleString("fa-IR")} ریال</td>
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
        open={grantConfirm}
        title="اعطای دسترسی بدون پرداخت؟"
        description={`«${grantedProduct?.title ?? ""}» برای ${grantedUser?.phone ?? ""} بلافاصله فعال می‌شود.`}
        confirmLabel="اعطا کن"
        busy={granting}
        onConfirm={grantEntitlement}
        onCancel={() => setGrantConfirm(false)}
      />
    </>
  );
}
