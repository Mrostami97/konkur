"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import {
  AdminPageHeader,
  Alert,
  Button,
  Card,
  DataState,
  Field,
  FieldRow,
  Input,
  Select,
  TableWrap,
} from "../../../components/ds";

interface University { id: string; code: string; title: string; city: string }
interface Program { id: string; code: string; title: string }
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
              <TableWrap>
                <thead><tr><th>نام</th><th>کد</th><th>شهر</th></tr></thead>
                <tbody>
                  {universities.map((university) => (
                    <tr key={university.id}>
                      <td>{university.title}</td>
                      <td className="ds-code">{university.code}</td>
                      <td>{university.city}</td>
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

        <Card>
          <h2 className="ds-card-title">ظرفیت</h2>
          <form onSubmit={addCapacity} className="ds-form">
            <Field label="رشته" required>
              {(props) => (
                <Select {...props} value={capacityProgramId} onChange={(event) => setCapacityProgramId(event.target.value)} required>
                  <option value="">رشته را انتخاب کنید</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>{program.title} ({program.code})</option>
                  ))}
                </Select>
              )}
            </Field>
            <FieldRow>
              <Field label="سال آزمون" required>
                {(props) => <Input {...props} value={examYear} onChange={(event) => setExamYear(event.target.value)} inputMode="numeric" required />}
              </Field>
              <Field label="سهمیه" hint="مثلاً region-1" required>
                {(props) => <Input {...props} value={quota} onChange={(event) => setQuota(event.target.value)} required />}
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
    </>
  );
}
