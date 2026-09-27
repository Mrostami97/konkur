import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Who prepares and reviews the site's content when a page names no one else. */
export const OWNER_NAME = "محمد رستمی";

/** The owner's photo, linking to his page. */
export function OwnerPhoto() {
  return (
    <Link href="/about" className="rd-author-photo" aria-label={`دربارهٔ ${OWNER_NAME}`}>
      <Image src="/brand/mohammad-rostami-avatar.webp" alt={OWNER_NAME} width={56} height={56} unoptimized />
    </Link>
  );
}

/**
 * The byline for content without a named author or reviewer: the owner, who
 * writes and reviews the site's material, with his photo and a link to his
 * page. `note` is the page's own line about sources and review dates.
 */
export function OwnerByline({ note }: { note?: ReactNode }) {
  return (
    <section className="rd-author" aria-label="تهیه و بازبینی">
      <OwnerPhoto />
      <div>
        <strong>
          تهیه و بازبینی: <Link href="/about">{OWNER_NAME}</Link>
        </strong>
        <p>
          {note ?? "این مطلب بر پایهٔ منابع ذکرشده تهیه و بازبینی شده است. "}
          روش کار را در <Link href="/editorial-policy">روش تولید محتوا</Link> ببین.
        </p>
      </div>
    </section>
  );
}
