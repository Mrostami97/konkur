"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { formatPersianNumber, formatRial } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  DataState,
  Field,
  FieldRow,
  Input,
  Select,
  TableWrap,
  Textarea,
} from "../../../components/ds";

type ConsultationKind = "SINGLE_SESSION" | "PACKAGE";

interface Offering {
  id: string;
  kind: ConsultationKind;
  sessionQuota: number;
  durationMinutes: number;
  validUntil: string | null;
  headline: string;
  description: string;
  isActive: boolean;
  amountRial: number | null;
  instructorProfile: { id: string; slug: string; displayName: string; isPublished: boolean };
  product: { id: string; slug: string; isActive: boolean };
  _count: { bookings: number };
}

interface Contributor {
  id: string;
  displayName: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });
}

export default function AdminConsultationsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [offeringList, contributorList] = await Promise.all([
        apiFetch<Offering[]>("/admin/consultations/offerings"),
        apiFetch<Contributor[]>("/admin/contributors"),
      ]);
      setOfferings(offeringList);
      setContributors(contributorList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست مشاوره‌ها ممکن نشد.");
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

  function toggleActive(offering: Offering) {
    void run(`${offering.id}:toggle`, async () => {
      await apiFetch(`/admin/consultations/offerings/${offering.id}`, {
        method: "PATCH",
        body: {
          headline: offering.headline,
          description: offering.description,
          durationMinutes: offering.durationMinutes,
          isActive: !offering.isActive,
          ...(offering.validUntil ? { validUntil: offering.validUntil } : {}),
        },
      });
      return offering.isActive
        ? `«${offering.headline}» از فروش خارج شد. جلسه‌های خریداری‌شده همچنان قابل رزروند.`
        : `«${offering.headline}» دوباره قابل خرید شد.`;
    });
  }

  return (
    <>
      <AdminPageHeader
        title="مشاوره"
        description="مشاوره‌هایی که مدرسان می‌فروشند. هر مورد یک محصول با قیمت خودش می‌سازد و از همان مسیر سفارش و دسترسیِ بقیهٔ محصولات می‌گذرد."
      />

      <div className="ds-stack-lg">
        {actionError && <Alert tone="danger">{actionError}</Alert>}
        {notice && !actionError && <Alert tone="success">{notice}</Alert>}

        <CreateOfferingForm
          contributors={contributors}
          busy={busy === "create"}
          onSubmit={(body) =>
            run("create", async () => {
              await apiFetch("/admin/consultations/offerings", { method: "POST", body });
              return "مشاوره ساخته شد و از همین حالا قابل خرید است.";
            })
          }
        />

        <Card padded={false}>
          <div className="ds-card-head">
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
              مشاوره‌های موجود
            </h2>
          </div>
          <div style={{ padding: offerings.length && !loading && !error ? 0 : "var(--sp-4)" }}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={offerings.length === 0}
              onRetry={load}
              emptyTitle="هنوز مشاوره‌ای تعریف نشده"
              emptyDescription="با فرم بالا اولین مشاوره را بسازید — یک جلسه‌ای یا بسته‌ای تا تاریخ کنکور."
              skeletonRows={4}
            >
              <TableWrap>
                <thead>
                  <tr>
                    <th>عنوان</th>
                    <th>مدرس</th>
                    <th>نوع</th>
                    <th>جلسه</th>
                    <th>مدت</th>
                    <th>قیمت</th>
                    <th>اعتبار تا</th>
                    <th>رزرو</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((offering) => (
                    <tr key={offering.id}>
                      <td>{offering.headline}</td>
                      <td>
                        {offering.instructorProfile.displayName}
                        {!offering.instructorProfile.isPublished && (
                          <div style={{ color: "var(--warning)", fontSize: "var(--text-sm)" }}>
                            پروفایل منتشر نشده — در فهرست عمومی دیده نمی‌شود
                          </div>
                        )}
                      </td>
                      <td>
                        {offering.kind === "PACKAGE" ? "بسته" : "تک‌جلسه"}
                      </td>
                      <td className="ds-table-numeric">{formatPersianNumber(offering.sessionQuota)}</td>
                      <td className="ds-table-numeric">
                        {formatPersianNumber(offering.durationMinutes)} دقیقه
                      </td>
                      <td className="ds-table-numeric">
                        {offering.amountRial === null ? "—" : formatRial(offering.amountRial)}
                      </td>
                      <td className="ds-table-numeric">
                        {offering.validUntil ? formatDate(offering.validUntil) : "بدون انقضا"}
                      </td>
                      <td className="ds-table-numeric">{formatPersianNumber(offering._count.bookings)}</td>
                      <td>
                        {offering.isActive ? <Badge tone="success">در فروش</Badge> : <Badge>متوقف</Badge>}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          onClick={() => toggleActive(offering)}
                          loading={busy === `${offering.id}:toggle`}
                          disabled={busy !== null}
                        >
                          {offering.isActive ? "توقف فروش" : "شروع فروش"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>
      </div>
    </>
  );
}

function CreateOfferingForm({
  contributors,
  busy,
  onSubmit,
}: {
  contributors: Contributor[];
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [instructorProfileId, setInstructorProfileId] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<ConsultationKind>("SINGLE_SESSION");
  const [sessionQuota, setSessionQuota] = useState("1");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [amountRial, setAmountRial] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");

  const isPackage = kind === "PACKAGE";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await onSubmit({
      instructorProfileId,
      slug,
      kind,
      // A single session is exactly one; only a package carries a count.
      sessionQuota: isPackage ? Number(sessionQuota) : 1,
      durationMinutes: Number(durationMinutes),
      amountRial: Number(amountRial),
      ...(validUntil ? { validUntil: new Date(`${validUntil}T23:59:59`).toISOString() } : {}),
      headline,
      description,
    });
    if (ok) {
      setSlug("");
      setHeadline("");
      setDescription("");
      setAmountRial("");
      setValidUntil("");
    }
  }

  return (
    <Card>
      <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
        ساخت مشاورهٔ تازه
      </h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
        محصول و قیمت همین‌جا با هم ساخته می‌شوند؛ لازم نیست جداگانه در «فروش و دسترسی‌ها» چیزی تعریف کنید.
        تعداد جلسه‌ها بعد از ساخت قابل تغییر نیست، چون دانشجویان بر اساس همان عدد خرید می‌کنند.
      </p>

      <form onSubmit={submit} className="ds-stack">
        <FieldRow>
          <Field label="مدرس" required>
            {(props) => (
              <Select
                {...props}
                value={instructorProfileId}
                onChange={(event) => setInstructorProfileId(event.target.value)}
                required
              >
                <option value="">انتخاب کنید</option>
                {contributors.map((contributor) => (
                  <option key={contributor.id} value={contributor.id}>
                    {contributor.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="نوع" required>
            {(props) => (
              <Select
                {...props}
                value={kind}
                onChange={(event) => {
                  const next = event.target.value as ConsultationKind;
                  setKind(next);
                  setSessionQuota(next === "PACKAGE" ? "12" : "1");
                }}
              >
                <option value="SINGLE_SESSION">تک‌جلسه‌ای</option>
                <option value="PACKAGE">بسته (سالیانه تا کنکور)</option>
              </Select>
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field
            label="تعداد جلسه"
            hint={isPackage ? "بعد از ساخت قابل تغییر نیست" : "تک‌جلسه‌ای همیشه یک جلسه است"}
            required
          >
            {(props) => (
              <Input
                {...props}
                value={isPackage ? sessionQuota : "1"}
                onChange={(event) => setSessionQuota(event.target.value)}
                inputMode="numeric"
                disabled={!isPackage}
                required
              />
            )}
          </Field>
          <Field label="مدت هر جلسه (دقیقه)" required>
            {(props) => (
              <Input
                {...props}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                inputMode="numeric"
                required
              />
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field
            label="قیمت (ریال)"
            hint={Number(amountRial) > 0 ? `برابر ${formatPersianNumber(Math.round(Number(amountRial) / 10))} تومان` : "مثلاً ۱۵ میلیون تومان = ۱۵۰٬۰۰۰٬۰۰۰ ریال"}
            required
          >
            {(props) => (
              <Input
                {...props}
                value={amountRial}
                onChange={(event) => setAmountRial(event.target.value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/D/g, ""))}
                inputMode="numeric"
                required
              />
            )}
          </Field>
          <Field
            label="اعتبار تا"
            hint={isPackage ? "معمولاً تاریخ کنکور؛ بعد از آن جلسهٔ باقی‌مانده قابل رزرو نیست" : "اختیاری"}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            )}
          </Field>
        </FieldRow>

        <Field label="نشانی یکتا (slug)" hint="در آدرس محصول می‌آید؛ حروف کوچک انگلیسی با خط تیره" required>
          {(props) => (
            <Input
              {...props}
              dir="ltr"
              placeholder="taghavi-annual-consultation"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              required
            />
          )}
        </Field>

        <Field label="عنوان" required>
          {(props) => (
            <Input {...props} value={headline} onChange={(event) => setHeadline(event.target.value)} required />
          )}
        </Field>

        <Field label="توضیح" hint="برای دانشجو در صفحهٔ مشاوره نمایش داده می‌شود" required>
          {(props) => (
            <Textarea
              {...props}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          )}
        </Field>

        <div>
          <Button type="submit" variant="primary" loading={busy}>
            ساخت مشاوره
          </Button>
        </div>
      </form>
    </Card>
  );
}
