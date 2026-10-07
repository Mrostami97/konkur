import { formatRial, percentOff, toPersianDigits } from "../lib/format";
import "./price.css";

/**
 * A price, and when the admin set a «before» price, that price struck
 * through with the percentage saved. Works on server and client pages.
 */
export function PriceTag({
  amountRial,
  compareAtRial,
  className,
}: {
  amountRial: number;
  compareAtRial?: number | null;
  className?: string;
}) {
  const off = percentOff(amountRial, compareAtRial);
  return (
    <span className={["price-tag tnum", className ?? ""].filter(Boolean).join(" ")}>
      {off !== null && (
        <>
          <s className="price-was">
            <span className="sr-only">قیمت پیش از تخفیف: </span>
            {formatRial(compareAtRial!)}
          </s>
          <span className="price-off">{toPersianDigits(off)}٪ تخفیف</span>
        </>
      )}
      <span className="price-now">
        {off !== null && <span className="sr-only">قیمت با تخفیف: </span>}
        {formatRial(amountRial)}
      </span>
    </span>
  );
}
