"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "../lib/api";

type AddState = "idle" | "saving" | "saved" | "login" | "error";

export function AddChoiceButton({ programId }: { programId: string }) {
  const [state, setState] = useState<AddState>("idle");

  async function addChoice() {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    try {
      await apiFetch("/me/choices", { method: "POST", body: { programId } });
      setState("saved");
    } catch (error) {
      setState(error instanceof ApiError && error.status === 401 ? "login" : "error");
    }
  }

  return (
    <div>
      <button
        className="button button-secondary"
        type="button"
        onClick={addChoice}
        disabled={state === "saving" || state === "saved"}
      >
        {state === "saving"
          ? "در حال افزودن..."
          : state === "saved"
            ? "به انتخاب‌ها اضافه شد"
            : "افزودن به انتخاب‌ها"}
      </button>
      <div aria-live="polite" role="status">
        {state === "saved" && (
          <p className="success-message">
            ذخیره شد. <Link className="text-link" href="/choices">مشاهدهٔ انتخاب‌ها ←</Link>
          </p>
        )}
        {state === "login" && (
          <p className="form-error">
            برای ذخیرهٔ انتخاب باید <Link href="/login">وارد حساب شوید</Link>.
          </p>
        )}
        {state === "error" && <p className="form-error">افزودن این انتخاب انجام نشد؛ دوباره تلاش کنید.</p>}
      </div>
    </div>
  );
}
