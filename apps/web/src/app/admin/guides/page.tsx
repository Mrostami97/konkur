import { guides } from "../../../content/editorial";
import { phase12EditorialPages } from "../../../content/phase12";
import { withoutMergedGuides } from "../../../lib/merged-pages";
import { GuideReviewsAdmin } from "./GuideReviewsAdmin";

/** Guides whose text lives in the site code; the owner signs each off here. */
export default function GuideReviewsPage() {
  const items = withoutMergedGuides([...guides, ...phase12EditorialPages]).map((guide) => ({
    slug: guide.slug,
    title: guide.title,
    category: guide.category,
  }));
  return <GuideReviewsAdmin guides={items} />;
}
