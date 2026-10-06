"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, apiUpload } from "../../../lib/api";
import { periodLabel } from "../../../lib/admissions";
import { formatPersianNumber, toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
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

interface University { id: string; code: string; title: string; city: string }
interface Program {
  id: string;
  code: string;
  title: string;
  period?: string | null;
  university?: { title: string };
  capacities?: { examYear: number; selectionCode?: string | null }[];
}

interface ImportResult {
  examYear: number;
  rows: number;
  universities: number;
  programsCreated: number;
  programsUpdated: number;
  capacitiesRemoved: number;
}

/** How a program reads in a list: «کد · عنوان، دانشگاه، دوره». */
function programName(program: Program) {
  const code = program.capacities?.find((c) => c.selectionCode)?.selectionCode;
  return [code ? toPersianDigits(code) : null, program.title, program.university?.title, periodLabel(program.period)].filter(Boolean).join(" · ");
}

const PROGRAM_ROWS = 50;
interface OfficialSource {
  id: string;
  title: string;
  sourceTier: string;
  sourceStatus: string;
  mayLink: boolean;
  archivedAt: string | null;
}

export default function AdmissionsAdminPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sources, setSources] = useState<OfficialSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uniCode, setUniCode] = useState("");
  const [uniTitle, setUniTitle] = useState("");
  const [uniCity, setUniCity] = useState("");
  const [uniBusy, setUniBusy] = useState(false);
  const [uniError, setUniError] = useState<string | null>(null);

  const [universityId, setUniversityId] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [programTitle, setProgramTitle] = useState("");
  const [degree, setDegree] = useState<"MASTER" | "PHD">("MASTER");
  const [field, setField] = useState("");
  const [tuitionType, setTuitionType] = useState<"FREE" | "PAID">("FREE");
  const [programBusy, setProgramBusy] = useState(false);
  const [programError, setProgramError] = useState<string | null>(null);

  const [capacityProgramId, setCapacityProgramId] = useState("");
  const [examYear, setExamYear] = useState("1405");
  const [quota, setQuota] = useState("region-1");
  const [capacity, setCapacity] = useState("20");
  const [capacityBusy, setCapacityBusy] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [capacityDone, setCapacityDone] = useState<string | null>(null);

  const [bookletFile, setBookletFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [programQuery, setProgramQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [universityRows, programRows, sourceRows] = await Promise.all([
        apiFetch<University[]>("/universities"),
        apiFetch<Program[]>("/programs"),
        apiFetch<OfficialSource[]>("/admin/content-sources"),
      ]);
      setUniversities(universityRows);
      setPrograms(programRows);
      // Admissions facts must cite a live, linkable official source.
      const official = sourceRows.filter(
        (item) =>
          item.sourceTier === "PRIMARY_OFFICIAL" &&
          item.sourceStatus === "ACTIVE" &&
          item.mayLink &&
          !item.archivedAt,
      );
      setSources(official);
      setSourceId((current) => current || official[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن داده‌های پذیرش ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [pendingDelete, setPendingDelete] = useState<{ label: string; path: string; note: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiFetch(target.path, { method: "DELETE" });
      setPendingDelete(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "حذف ممکن نشد.");
      setPendingDelete(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function createUniversity(event: FormEvent) {
    event.preventDefault();
    setUniBusy(true);
    setUniError(null);
    try {
      await apiFetch("/admin/universities", {
        method: "POST",
        body: { sourceId, code: uniCode, title: uniTitle, city: uniCity },
      });
      setUniCode("");
      setUniTitle("");
      setUniCity("");
      await load();
    } catch (err) {
      setUniError(err instanceof Error ? err.message : "ثبت دانشگاه ناموفق بود.");
    } finally {
      setUniBusy(false);
    }
  }

  async function createProgram(event: FormEvent) {
    event.preventDefault();
    setProgramBusy(true);
    setProgramError(null);
    try {
      await apiFetch("/admin/programs", {
        method: "POST",
        body: { sourceId, universityId, code: programCode, title: programTitle, degree, field, tuitionType },
      });
      setProgramCode("");
      setProgramTitle("");
      setField("");
      await load();
    } catch (err) {
      setProgramError(err instanceof Error ? err.message : "ثبت رشته ناموفق بود.");
    } finally {
      setProgramBusy(false);
    }
  }

  async function addCapacity(event: FormEvent) {
    event.preventDefault();
    setCapacityBusy(true);
    setCapacityError(null);
    setCapacityDone(null);
    try {
      await apiFetch(`/admin/programs/${capacityProgramId}/capacities`, {
        method: "POST",
        body: { sourceId, examYear: Number(examYear), quota, capacity: Number(capacity) },
      });
      const program = programs.find((item) => item.id === capacityProgramId);
      setCapacityDone(`ظرفیت ${capacity} برای «${program?.title ?? "رشته"}» در سال ${examYear} ثبت شد.`);
    } catch (err) {
      setCapacityError(err instanceof Error ? err.message : "ثبت ظرفیت ناموفق بود.");
    } finally {
      setCapacityBusy(false);
    }
  }

  async function importBooklet(event: FormEvent) {
    event.preventDefault();
    if (!bookletFile || !sourceId) return;
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      setImportResult(await apiUpload<ImportResult>("/admin/admissions/import", bookletFile, undefined, { sourceId }));
      await load();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "ورود دفترچه ممکن نشد.");
    } finally {
      setImportBusy(false);
    }
  }

  const matchingPrograms = useMemo(() => {
    const needle = programQuery.trim();
    return needle ? programs.filter((program) => programName(program).includes(needle) || program.code.includes(needle)) : programs;
  }, [programs, programQuery]);

  const noSource = sources.length === 0;

  return (
    <>
      <AdminPageHeader
        title="دانشگاه‌ها و گرایش‌ها"
        description="هر دانشگاه، رشته و ظرفیت باید به یک منبع رسمی زنده استناد کند؛ بدون آن چیزی ثبت نمی‌شود."
      />

      <div className="ds-stack-lg">
        <Card>
          <Field
            label="منبع رسمی مشترک"
            hint="همهٔ ثبت‌های این صفحه به این منبع استناد می‌کنند."
            error={noSource && !loading ? "هیچ منبع رسمی فعالی ثبت نشده است." : undefined}
            required
          >
            {(props) => (
              <Select {...props} value={sourceId} onChange={(event) => setSourceId(event.target.value)} required disabled={noSource}>
                <option value="">منبع را انتخاب کنید</option>
                {sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
              </Select>
            )}
          </Field>
          {noSource && !loading && (
            <Alert tone="warning">
              ابتدا در بخش «منابع و مستندات» یک منبع با ردهٔ رسمی اولیه ثبت و فعال کنید.
            </Alert>
          )}
        </Card>

        <Card>
          <h2 className="ds-card-title">ورود دفترچهٔ انتخاب رشته</h2>
          <p className="ds-help">
            فایل JSON دفترچهٔ یک سال (قالب admissions-booklet.v1) همهٔ دانشگاه‌ها، رشته‌محل‌ها و ظرفیت‌هایش را یک‌جا ثبت می‌کند و به منبع رسمی بالا استناد می‌دهد.
            ورود دوبارهٔ همان سال، ظرفیت‌های آن سال را با فایل تازه جایگزین می‌کند؛ رشته‌محل‌ها و فهرست انتخاب دانشجوها سر جایشان می‌مانند.
          </p>
          <form onSubmit={importBooklet} className="ds-form">
            <Field label="فایل دفترچه (JSON)" required>
              {(props) => (
                <Input
                  {...props}
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => { setBookletFile(event.target.files?.[0] ?? null); setImportResult(null); setImportError(null); }}
                  required
                />
              )}
            </Field>
            {importError && <Alert tone="danger">{importError}</Alert>}
            {importResult && (
              <Alert tone="success">
                دفترچهٔ {toPersianDigits(importResult.examYear)} ثبت شد: {formatPersianNumber(importResult.rows)} کد رشته‌محل در {formatPersianNumber(importResult.universities)} دانشگاه و مؤسسه؛
                {" "}{formatPersianNumber(importResult.programsCreated)} رشته‌محل تازه، {formatPersianNumber(importResult.programsUpdated)} به‌روزشده
                {importResult.capacitiesRemoved > 0 ? `، و ${formatPersianNumber(importResult.capacitiesRemoved)} ظرفیتِ دیگر در فایل نبود و برداشته شد` : ""}.
              </Alert>
            )}
            <div><Button type="submit" variant="primary" loading={importBusy} disabled={!sourceId || !bookletFile}>ورود دفترچه</Button></div>
          </form>
        </Card>

        <Card>
          <h2 className="ds-card-title">دانشگاه تازه</h2>
          <form onSubmit={createUniversity} className="ds-form">
            <FieldRow>
              <Field label="کد دانشگاه" hint="لاتین، در نشانی صفحهٔ دانشگاه استفاده می‌شود" required>
                {(props) => <Input {...props} value={uniCode} onChange={(event) => setUniCode(event.target.value)} required />}
              </Field>
              <Field label="نام دانشگاه" required>
                {(props) => <Input {...props} value={uniTitle} onChange={(event) => setUniTitle(event.target.value)} required />}
              </Field>
              <Field label="شهر" required>
                {(props) => <Input {...props} value={uniCity} onChange={(event) => setUniCity(event.target.value)} required />}
              </Field>
            </FieldRow>
            {uniError && <Alert tone="danger">{uniError}</Alert>}
            <div><Button type="submit" variant="primary" loading={uniBusy} disabled={!sourceId}>ثبت دانشگاه</Button></div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head"><h2 className="ds-card-title">دانشگاه‌ها</h2></div>
          <div className={`ds-card-body ${universities.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={universities.length === 0}
              onRetry={load}
              emptyTitle="هنوز دانشگاهی ثبت نشده"
              emptyDescription="با فرم بالا اولین دانشگاه را اضافه کنید."
            >
              {deleteError && <div style={{ padding: "var(--sp-4)" }}><Alert tone="danger">{deleteError}</Alert></div>}
              <TableWrap>
                <thead><tr><th>نام</th><th>کد</th><th>شهر</th><th /></tr></thead>
                <tbody>
                  {universities.map((university) => (
                    <tr key={university.id}>
                      <td>{university.title}</td>
                      <td className="ds-code">{university.code}</td>
                      <td>{university.city}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleteError(null);
                            setPendingDelete({
                              label: university.title,
                              path: `/admin/universities/${university.id}`,
                              note: "دانشگاه پاک می‌شود. اگر رشته‌محلی داشته باشد، اول باید رشته‌محل‌هایش را حذف کنید.",
                            });
                          }}
                        >
                          حذف
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>

        <Card>
          <h2 className="ds-card-title">رشته یا گرایش تازه</h2>
          <form onSubmit={createProgram} className="ds-form">
            <Field label="دانشگاه" required>
              {(props) => (
                <Select {...props} value={universityId} onChange={(event) => setUniversityId(event.target.value)} required>
                  <option value="">دانشگاه را انتخاب کنید</option>
                  {universities.map((university) => <option key={university.id} value={university.id}>{university.title}</option>)}
                </Select>
              )}
            </Field>
            <FieldRow>
              <Field label="کد رشته" hint="کد رسمی دفترچه" required>
                {(props) => <Input {...props} value={programCode} onChange={(event) => setProgramCode(event.target.value)} required />}
              </Field>
              <Field label="عنوان رشته" required>
                {(props) => <Input {...props} value={programTitle} onChange={(event) => setProgramTitle(event.target.value)} required />}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="مقطع" required>
                {(props) => (
                  <Select {...props} value={degree} onChange={(event) => setDegree(event.target.value as "MASTER" | "PHD")}>
                    <option value="MASTER">ارشد</option>
                    <option value="PHD">دکتری</option>
                  </Select>
                )}
              </Field>
              <Field label="گرایش" required>
                {(props) => <Input {...props} value={field} onChange={(event) => setField(event.target.value)} required />}
              </Field>
              <Field label="نوع دوره" required>
                {(props) => (
                  <Select {...props} value={tuitionType} onChange={(event) => setTuitionType(event.target.value as "FREE" | "PAID")}>
                    <option value="FREE">روزانه / رایگان</option>
                    <option value="PAID">شهریه‌پرداز</option>
                  </Select>
                )}
              </Field>
            </FieldRow>
            {programError && <Alert tone="danger">{programError}</Alert>}
            <div><Button type="submit" variant="primary" loading={programBusy} disabled={!sourceId}>ثبت رشته</Button></div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head">
            <h2 className="ds-card-title">رشته‌محل‌ها ({formatPersianNumber(programs.length)})</h2>
            <Input aria-label="جست‌وجوی رشته‌محل" placeholder="جست‌وجو: کد، دانشگاه یا گرایش" value={programQuery} onChange={(event) => setProgramQuery(event.target.value)} />
          </div>
          <div className={`ds-card-body ${programs.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={programs.length === 0}
              onRetry={load}
              emptyTitle="هنوز رشته‌محلی ثبت نشده"
              emptyDescription="با فرم بالا اولین رشته‌محل را اضافه کنید."
            >
              <TableWrap>
                <thead><tr><th>رشته‌محل</th><th>شناسه</th><th /></tr></thead>
                <tbody>
                  {matchingPrograms.slice(0, PROGRAM_ROWS).map((program) => (
                    <tr key={program.id}>
                      <td>{programName(program)}</td>
                      <td className="ds-code">{program.code}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleteError(null);
                            setPendingDelete({
                              label: programName(program),
                              path: `/admin/programs/${program.id}`,
                              note: "رشته‌محل و ظرفیت‌هایش پاک می‌شوند. اگر در فهرست انتخاب دانشجویی باشد، حذف انجام نمی‌شود.",
                            });
                          }}
                        >
                          حذف
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              {matchingPrograms.length > PROGRAM_ROWS && (
                <p className="ds-help ds-card-body">
                  {formatPersianNumber(PROGRAM_ROWS)} مورد از {formatPersianNumber(matchingPrograms.length)} نمایش داده شده؛ برای یافتن بقیه جست‌وجو کنید.
                </p>
              )}
            </DataState>
          </div>
        </Card>

        <Card>
          <h2 className="ds-card-title">ظرفیت</h2>
          <form onSubmit={addCapacity} className="ds-form">
            <Field label="رشته" required>
              {(props) => (
                <Select {...props} value={capacityProgramId} onChange={(event) => setCapacityProgramId(event.target.value)} required>
                  <option value="">رشته را انتخاب کنید</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>{programName(program)}</option>
                  ))}
                </Select>
              )}
            </Field>
            <FieldRow>
              <Field label="سال آزمون" required>
                {(props) => <Input {...props} value={examYear} onChange={(event) => setExamYear(event.target.value)} inputMode="numeric" required />}
              </Field>
              <Field label="سهمیه" required>
                {(props) => (
                  <Select {...props} value={quota} onChange={(event) => setQuota(event.target.value)} required>
                    <option value="region-1">منطقهٔ ۱</option>
                    <option value="region-2">منطقهٔ ۲</option>
                    <option value="region-3">منطقهٔ ۳</option>
                    {!["region-1", "region-2", "region-3"].includes(quota) && <option value={quota}>{quota}</option>}
                  </Select>
                )}
              </Field>
              <Field label="ظرفیت" required>
                {(props) => <Input {...props} value={capacity} onChange={(event) => setCapacity(event.target.value)} inputMode="numeric" required />}
              </Field>
            </FieldRow>
            {capacityError && <Alert tone="danger">{capacityError}</Alert>}
            {capacityDone && <Alert tone="success">{capacityDone}</Alert>}
            <div><Button type="submit" variant="primary" loading={capacityBusy} disabled={!sourceId}>ثبت ظرفیت</Button></div>
          </form>
        </Card>
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`حذف «${pendingDelete?.label ?? ""}»؟`}
        description={pendingDelete?.note}
        confirmLabel="حذف"
        tone="danger"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
