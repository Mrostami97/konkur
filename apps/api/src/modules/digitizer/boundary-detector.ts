import type {
  BookletIdentity,
  QuestionBoundary,
} from "./types";
import type { PageClassification, RenderedPageRef } from "./page-classifier";

export interface BoundaryDetectionContext {
  booklet: BookletIdentity;
  pages: Array<{
    render: RenderedPageRef;
    classification: PageClassification;
  }>;
}

export interface QuestionBoundaryDetectorAdapter {
  readonly name: string;
  detect(context: BoundaryDetectionContext): Promise<QuestionBoundary[]>;
}
