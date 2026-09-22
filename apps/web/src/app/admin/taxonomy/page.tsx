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

interface Subject {
  code: string;
  title: string;
}

interface Topic {
  code: string;
  title: string;
  subject: Subject;
}

export default function TaxonomyAdminPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectCode, setSubjectCode] = useState("");
  const [subjectTitle, setSubjectTitle] = useState("");
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const [topicCode, setTopicCode] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [topicSubjectCode, setTopicSubjectCode] = useState("");
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSubjects, nextTopics] = await Promise.all([
        apiFetch<Subject[]>("/subjects"),
        apiFetch<Topic[]>("/topics"),
      ]);
      setSubjects(nextSubjects);
      setTopics(nextTopics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن طبقه‌بندی ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSubject(event: FormEvent) {
    event.preventDefault();
    setSubjectBusy(true);
    setSubjectError(null);
    try {
      await apiFetch("/admin/subjects", { method: "POST", body: { code: subjectCode, title: subjectTitle } });
      setSubjectCode("");
      setSubjectTitle("");
      await load();
    } catch (err) {
      setSubjectError(err instanceof Error ? err.message : "ثبت درس ناموفق بود.");
    } finally {
      setSubjectBusy(false);
    }
  }

  async function createTopic(event: FormEvent) {
    event.preventDefault();
    setTopicBusy(true);
    setTopicError(null);
    try {
      await apiFetch("/admin/topics", {
        method: "POST",
        body: { code: topicCode, title: topicTitle, subjectCode: topicSubjectCode },
      });
      setTopicCode("");
      setTopicTitle("");
      await load();
    } catch (err) {
      setTopicError(err instanceof Error ? err.message : "ثبت مبحث ناموفق بود.");
    } finally {
      setTopicBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="طبقه‌بندی موضوعی"
        description="درس‌ها و مبحث‌ها ستون فقرات بانک سؤال و نقشهٔ مطالعه‌اند؛ کد هر کدام در ورود داده و سؤال‌ها به همین شکل استفاده می‌شود."
      />

      <div className="ds-stack-lg">
        <Card>
          <h2 className="ds-card-title">درس تازه</h2>
          <form onSubmit={createSubject} className="ds-form">
            <FieldRow>
              <Field label="کد درس" hint="مثلاً data-structures — در ورود داده و سؤال‌ها به همین شکل ارجاع می‌شود" required>
                {(props) => (
                  <Input {...props} value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} required />
                )}
              </Field>
              <Field label="عنوان درس" required>
                {(props) => (
                  <Input {...props} value={subjectTitle} onChange={(event) => setSubjectTitle(event.target.value)} required />
                )}
              </Field>
            </FieldRow>
            {subjectError && <Alert tone="danger">{subjectError}</Alert>}
            <div>
              <Button type="submit" variant="primary" loading={subjectBusy}>ثبت درس</Button>
            </div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head">
            <h2 className="ds-card-title">درس‌ها</h2>
          </div>
          <div className={`ds-card-body ${subjects.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={subjects.length === 0}
              onRetry={load}
              emptyTitle="هنوز درسی ثبت نشده"
              emptyDescription="با فرم بالا اولین درس را اضافه کنید."
            >
              <TableWrap>
                <thead>
                  <tr><th>عنوان</th><th>کد</th></tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.code}>
                      <td>{subject.title}</td>
                      <td className="ds-code">{subject.code}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>

        <Card>
          <h2 className="ds-card-title">مبحث تازه</h2>
          <form onSubmit={createTopic} className="ds-form">
            <FieldRow>
              <Field label="کد مبحث" hint="مثلاً binary-trees" required>
                {(props) => (
                  <Input {...props} value={topicCode} onChange={(event) => setTopicCode(event.target.value)} required />
                )}
              </Field>
              <Field label="عنوان مبحث" required>
                {(props) => (
                  <Input {...props} value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} required />
                )}
              </Field>
            </FieldRow>
            <Field label="درس مرتبط" required>
              {(props) => (
                <Select
                  {...props}
                  value={topicSubjectCode}
                  onChange={(event) => setTopicSubjectCode(event.target.value)}
                  required
                >
                  <option value="">درس را انتخاب کنید</option>
                  {subjects.map((subject) => (
                    <option key={subject.code} value={subject.code}>{subject.title}</option>
                  ))}
                </Select>
              )}
            </Field>
            {topicError && <Alert tone="danger">{topicError}</Alert>}
            <div>
              <Button type="submit" variant="primary" loading={topicBusy} disabled={subjects.length === 0}>
                ثبت مبحث
              </Button>
              {subjects.length === 0 && (
                <p className="ds-hint">ابتدا باید دست‌کم یک درس ثبت شود.</p>
              )}
            </div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head">
            <h2 className="ds-card-title">مبحث‌ها</h2>
          </div>
          <div className={`ds-card-body ${topics.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={topics.length === 0}
              onRetry={load}
              emptyTitle="هنوز مبحثی ثبت نشده"
              emptyDescription="پس از ثبت درس، مبحث‌های آن را از فرم بالا اضافه کنید."
            >
              <TableWrap>
                <thead>
                  <tr><th>عنوان</th><th>کد</th><th>درس</th></tr>
                </thead>
                <tbody>
                  {topics.map((topic) => (
                    <tr key={topic.code}>
                      <td>{topic.title}</td>
                      <td className="ds-code">{topic.code}</td>
                      <td>{topic.subject.title}</td>
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
