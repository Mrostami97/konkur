import { apiGetPublic } from "../../lib/api";
import { StartExamButton } from "../../components/StartExamButton";

interface Exam {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
}

export default async function ExamsPage() {
  const exams = await apiGetPublic<Exam[]>("/exams");

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>آزمون‌ها</h1>
      {!exams || exams.length === 0 ? (
        <p>در حال حاضر آزمونی برای شرکت وجود ندارد.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {exams.map((exam) => (
            <li key={exam.id} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "0.8rem", marginBottom: "0.6rem" }}>
              <strong>{exam.title}</strong>
              <p>{exam.description}</p>
              <p style={{ fontSize: "0.85rem", color: "#486581" }}>مدت: {exam.durationMinutes} دقیقه</p>
              <StartExamButton examId={exam.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
