-- Lessons can carry images: the blocks refer to them by media_key, resolved
-- through this list to a stored artifact, as questions and articles do.

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "assets" JSONB NOT NULL DEFAULT '[]';

