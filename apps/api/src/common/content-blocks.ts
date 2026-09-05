import { BadRequestException } from "@nestjs/common";

/**
 * Shared, deliberately loose block-shape check for content authored directly
 * by trusted internal roles (Author/Reviewer/Admin) through the admin panel.
 * Phase 2's bulk external ingestion validates strictly against the versioned
 * JSON Schema contracts in contracts/ instead -- this is not that.
 */
export function assertValidContentBlocks(blocks: unknown[], allowedTypes: Set<string>): void {
  blocks.forEach((block, index) => {
    if (typeof block !== "object" || block === null || !("type" in block)) {
      throw new BadRequestException(`content_blocks[${index}] must be an object with a "type"`);
    }
    const type = (block as { type: unknown }).type;
    if (typeof type !== "string" || !allowedTypes.has(type)) {
      throw new BadRequestException(
        `content_blocks[${index}].type must be one of ${[...allowedTypes].join(", ")}`,
      );
    }
  });
}

export const ARTICLE_BLOCK_TYPES = new Set(["text", "heading", "quote", "image", "table", "latex"]);
export const LESSON_BLOCK_TYPES = new Set(["text", "heading", "image", "video", "latex"]);
