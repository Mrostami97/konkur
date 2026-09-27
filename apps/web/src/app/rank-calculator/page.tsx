import { redirect } from "next/navigation";

/** Only one exam set has a calculator so far; the bare path leads to it. */
export default function RankCalculatorIndex() {
  redirect("/rank-calculator/master-computer-engineering");
}
