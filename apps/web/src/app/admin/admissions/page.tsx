"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface University {
  id: string;
  code: string;
  title: string;
  city: string;
}

function AdmissionsAdmin() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [uniCode, setUniCode] = useState("");
  const [uniTitle, setUniTitle] = useState("");
  const [uniCity, setUniCity] = useState("");

  const [universityId, setUniversityId] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [programTitle, setProgramTitle] = useState("");
  const [degree, setDegree] = useState<"MASTER" | "PHD">("MASTER");
  const [field, setField] = useState("");
  const [tuitionType, setTuitionType] = useState<"FREE" | "PAID">("FREE");

  const [capacityProgramId, setCapacityProgramId] = useState("");
  const [examYear, setExamYear] = useState("1405");
  const [quota, setQuota] = useState("region-1");
  const [capacity, setCapacity] = useState("20");

  async function loadUniversities() {
    setUniversities(await apiFetch<University[]>("/universities"));
  }

  useEffect(() => {
    loadUniversities().catch(() => {});
  }, []);

  async function createUniversity(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/universities", { method: "POST", body: { code: uniCode, title: uniTitle, city: uniCity } });
    setUniCode("");
    setUniTitle("");
    setUniCity("");
    await loadUniversities();
  }

  async function createProgram(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/programs", {
      method: "POST",
      body: { universityId, code: programCode, title: programTitle, degree, field, tuitionType },
    });
    setProgramCode("");
    setProgramTitle("");
    setField("");
  }

  async function addCapacity(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/programs/${capacityProgramId}/capacities`, {
      method: "POST",
      body: { examYear: Number(examYear), quota, capacity: Number(capacity) },
    });
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>دانشگاه‌ها و گرایش‌ها (Admissions)</h1>

      <h2>دانشگاه جدید</h2>
      <form onSubmit={createUniversity} style={{ display: "flex", gap: "0.5rem" }}>
        <input placeholder="code" value={uniCode} onChange={(e) => setUniCode(e.target.value)} required />
        <input placeholder="عنوان" value={uniTitle} onChange={(e) => setUniTitle(e.target.value)} required />
        <input placeholder="شهر" value={uniCity} onChange={(e) => setUniCity(e.target.value)} required />
        <button type="submit">ایجاد</button>
      </form>
      <ul>
        {universities.map((u) => (
          <li key={u.id}>
            {u.title} — {u.city} (id: {u.id.slice(0, 8)}…)
          </li>
        ))}
      </ul>

      <h2>گرایش/رشته جدید</h2>
      <form onSubmit={createProgram}>
        <select value={universityId} onChange={(e) => setUniversityId(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }}>
          <option value="">دانشگاه را انتخاب کنید</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.title}
            </option>
          ))}
        </select>
        <input placeholder="code" value={programCode} onChange={(e) => setProgramCode(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="عنوان" value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <select value={degree} onChange={(e) => setDegree(e.target.value as "MASTER" | "PHD")} style={{ display: "block", marginBottom: "0.4rem" }}>
          <option value="MASTER">ارشد</option>
          <option value="PHD">دکتری</option>
        </select>
        <input placeholder="گرایش (field)" value={field} onChange={(e) => setField(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <select value={tuitionType} onChange={(e) => setTuitionType(e.target.value as "FREE" | "PAID")} style={{ display: "block", marginBottom: "0.4rem" }}>
          <option value="FREE">رایگان</option>
          <option value="PAID">شهریه‌پرداز</option>
        </select>
        <button type="submit">ایجاد رشته</button>
      </form>

      <h2>ظرفیت</h2>
      <form onSubmit={addCapacity} style={{ display: "flex", gap: "0.5rem" }}>
        <input placeholder="programId" value={capacityProgramId} onChange={(e) => setCapacityProgramId(e.target.value)} required />
        <input placeholder="سال" value={examYear} onChange={(e) => setExamYear(e.target.value)} style={{ width: "5rem" }} />
        <input placeholder="سهمیه" value={quota} onChange={(e) => setQuota(e.target.value)} />
        <input placeholder="ظرفیت" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ width: "5rem" }} />
        <button type="submit">ثبت</button>
      </form>
    </main>
  );
}

export default function AdmissionsAdminPage() {
  return (
    <AdminGuard>
      <AdmissionsAdmin />
    </AdminGuard>
  );
}
