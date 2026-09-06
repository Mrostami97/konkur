import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorialPageView } from "../../../components/EditorialPageView";
import { findEditorialPage, guides } from "../../../content/editorial";
import { pageMetadata } from "../../../lib/seo";

export function generateStaticParams() { return guides.map(({ slug }) => ({ slug })); }

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = findEditorialPage(params.slug);
  return guide ? pageMetadata({ title: guide.title, description: guide.description, path: `/guides/${guide.slug}`, type: "article" }) : {};
}
export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = findEditorialPage(params.slug);
  if (!guide || !guides.some((item) => item.slug === params.slug)) notFound();
  return <EditorialPageView page={guide} basePath="/guides" />;
}
