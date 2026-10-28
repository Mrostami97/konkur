import { QuestionKeyState } from "@prisma/client";
import { isAcceptedAnswer, isVoidKey } from "../src/modules/ingestion/question-payload";

describe("question key states", () => {
  it("scores the key and any accepted option on a normal question", () => {
    const question = { correctOption: 2, acceptedOptions: [3], keyState: QuestionKeyState.NORMAL };
    expect(isAcceptedAnswer(question, 2)).toBe(true);
    expect(isAcceptedAnswer(question, 3)).toBe(true);
    expect(isAcceptedAnswer(question, 1)).toBe(false);
  });

  it("gives no mark on a question with no right option, even for the official key", () => {
    const question = { correctOption: 4, keyState: QuestionKeyState.NO_CORRECT_OPTION };
    for (const option of [1, 2, 3, 4]) expect(isAcceptedAnswer(question, option)).toBe(false);
    expect(isVoidKey(QuestionKeyState.NO_CORRECT_OPTION)).toBe(true);
  });

  it("treats a deleted question the same way, and nothing else", () => {
    expect(isVoidKey(QuestionKeyState.DELETED)).toBe(true);
    expect(isVoidKey(QuestionKeyState.NORMAL)).toBe(false);
    expect(isVoidKey(QuestionKeyState.POSITIVE_EFFECT)).toBe(false);
    expect(isVoidKey(undefined)).toBe(false);
  });
});
