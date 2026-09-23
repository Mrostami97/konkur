import Image from "next/image";
import type { EvidenceImage } from "../content/evidence";

// Each image opens full size in a new tab, so a reader can check the original.
export function EvidenceFigures({ images }: { images?: EvidenceImage[] }) {
  if (!images?.length) return null;
  return (
    <div className="evidence-figures">
      {images.map((image) => (
        <a className="evidence-figure" href={image.src} target="_blank" rel="noopener" key={image.src} title="نمایش در اندازهٔ کامل">
          <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 620px) 100vw, 360px" />
        </a>
      ))}
    </div>
  );
}
