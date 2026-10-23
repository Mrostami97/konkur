import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Who writes the site's content when a page names no one else. */
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
 * The byline for content without a named author: the owner, who writes the
 * site's material, with his photo and a link to his page. `note` is the
 * page's own line about its sources.
 */
export function OwnerByline({ note }: { note?: ReactNode }) {
  return (
    <section className="rd-author" aria-label="نویسنده">
      <OwnerPhoto />
      <div>
        <strong>
          نوشتهٔ <Link href="/about">{OWNER_NAME}</Link>
        </strong>
        <p>{note ?? "منابع این مطلب پایین صفحه آمده‌اند."}</p>
      </div>
    </section>
  );
}
