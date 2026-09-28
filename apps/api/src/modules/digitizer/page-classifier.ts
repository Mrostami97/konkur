export type PageRole =
  | "cover"
  | "instruction"
  | "question"
  | "answer_key"
  | "other";

export interface RenderedPageRef {
  page: number;
  imagePath: string;
  width: number;
  height: number;
  dpi: number;
}

export interface PageClassification {
  page: number;
  role: PageRole;
  textLayerUsable: boolean;
  scanOnly: boolean;
  mixedTextAndImage: boolean;
  heavyFormula: boolean;
  hasTable: boolean;
  hasDiagram: boolean;
  answerKeyLayout: boolean;
}

export interface PageClassifierAdapter {
  readonly name: string;
  classify(page: RenderedPageRef, extractedText?: string): Promise<PageClassification>;
}
