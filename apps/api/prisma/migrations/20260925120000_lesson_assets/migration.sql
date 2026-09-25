-- Images a lesson shows. Content blocks reference an image by media_key;
-- this maps each key to the checksum of an uploaded SourceArtifact, the same
-- shape questions and articles already carry, so one renderer serves all.
ALTER TABLE "lessons" ADD COLUMN "assets" JSONB NOT NULL DEFAULT '[]';
