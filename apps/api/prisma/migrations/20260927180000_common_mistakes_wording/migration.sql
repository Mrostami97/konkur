-- The owner asked that common mistakes be called «اشتباه رایج», never «دام»
-- (a trap): headings such as «سه دام رایج» / «دام ۱» and a few sentences in
-- lessons and guides. This applies the same ordered replacements the source
-- files and import packages received, to live rows and to revisions not yet
-- published. Published history in content_versions is left as written.
-- Each phrase is replaced only as whole words, so «هر کدام ۳» or «سه دامنه»
-- are never touched.

CREATE FUNCTION pg_temp.reword(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    value,
    '(?<![؀-ۿ‌A-Za-z])و دو دامی را که تست‌ها رویش ساخته می‌شوند با عدد واقعی باز می‌کند\.(?![؀-ۿ‌A-Za-z])', 'و دو اشتباه رایج را که بسیاری از تست‌ها بر پایه‌شان طرح می‌شوند، با عدد واقعی باز می‌کند.', 'g'),
    '(?<![؀-ۿ‌A-Za-z])و دو دامی را باز می‌کند که تست‌های نظریه رویش ساخته می‌شوند\.(?![؀-ۿ‌A-Za-z])', 'و دو اشتباه رایج را باز می‌کند که بسیاری از تست‌های نظریه بر پایه‌شان طرح می‌شوند.', 'g'),
    '(?<![؀-ۿ‌A-Za-z])بیشترین دام تست‌ها این است که دو مسئلهٔ شبیه را کنار هم بگذارند\.(?![؀-ۿ‌A-Za-z])', 'رایج‌ترین اشتباه در تست‌ها قاطی کردن دو مسئلهٔ شبیه است.', 'g'),
    '(?<![؀-ۿ‌A-Za-z])یک قانون ساده این دام را دور نگه می‌دارد(?![؀-ۿ‌A-Za-z])', 'یک قانون ساده جلوی این اشتباه را می‌گیرد', 'g'),
    '(?<![؀-ۿ‌A-Za-z])همان جاهایی که تست‌های نظریه معمولاً دام می‌گذارند(?![؀-ۿ‌A-Za-z])', 'همان جاهایی که در تست‌های نظریه بیشترین اشتباه رخ می‌دهد', 'g'),
    '(?<![؀-ۿ‌A-Za-z])چون تست‌ها رویش دام می‌گذارند(?![؀-ۿ‌A-Za-z])', 'چون در تست‌ها رویش زیاد اشتباه می‌شود', 'g'),
    '(?<![؀-ۿ‌A-Za-z])و یک دام ثابت دارند که(?![؀-ۿ‌A-Za-z])', 'و یک اشتباه رایج ثابت دارند که', 'g'),
    '(?<![؀-ۿ‌A-Za-z])جایی که بیشتر تست‌ها دام دارند(?![؀-ۿ‌A-Za-z])', 'جایی که بیشتر اشتباه‌ها رخ می‌دهد', 'g'),
    '(?<![؀-ۿ‌A-Za-z])و دام کوچک کردن آرایه(?![؀-ۿ‌A-Za-z])', 'و اشتباه رایج کوچک کردن آرایه', 'g'),
    '(?<![؀-ۿ‌A-Za-z])با دام معروف ترتیب(?![؀-ۿ‌A-Za-z])', 'با اشتباه معروف ترتیب', 'g'),
    '(?<![؀-ۿ‌A-Za-z])و دام ترتیب(?![؀-ۿ‌A-Za-z])', 'و اشتباه رایج در ترتیب', 'g'),
    '(?<![؀-ۿ‌A-Za-z])و دام‌های نامنظم بودن(?![؀-ۿ‌A-Za-z])', 'و اشتباه‌های رایج دربارهٔ نامنظم بودن', 'g'),
    '(?<![؀-ۿ‌A-Za-z])بدون افتادن در دام تعدد منابع(?![؀-ۿ‌A-Za-z])', 'بدون گرفتار شدن در تعدد منابع', 'g'),
    '(?<![؀-ۿ‌A-Za-z])ساخت زیرمجموعه‌ای و دام‌ها(?![؀-ۿ‌A-Za-z])', 'ساخت زیرمجموعه‌ای و اشتباه‌ها', 'g'),
    '(?<![؀-ۿ‌A-Za-z])و دام‌ها(?![؀-ۿ‌A-Za-z])', 'و اشتباه‌های رایج', 'g'),
    '(?<![؀-ۿ‌A-Za-z])دام‌های رایج(?![؀-ۿ‌A-Za-z])', 'اشتباه‌های رایج', 'g'),
    '(?<![؀-ۿ‌A-Za-z])دام رایج(?![؀-ۿ‌A-Za-z])', 'اشتباه رایج', 'g'),
    '(?<![؀-ۿ‌A-Za-z])سه دام(?![؀-ۿ‌A-Za-z])', 'سه اشتباه رایج', 'g'),
    '(?<![؀-ۿ‌A-Za-z])دو دام(?![؀-ۿ‌A-Za-z])', 'دو اشتباه رایج', 'g'),
    '(?<![؀-ۿ‌A-Za-z])دام ۱(?![؀-ۿ‌A-Za-z])', 'اشتباه ۱', 'g'),
    '(?<![؀-ۿ‌A-Za-z])دام ۲(?![؀-ۿ‌A-Za-z])', 'اشتباه ۲', 'g'),
    '(?<![؀-ۿ‌A-Za-z])دام ۳(?![؀-ۿ‌A-Za-z])', 'اشتباه ۳', 'g')
$$;

UPDATE "articles" SET
  "title" = pg_temp.reword("title"),
  "summary" = pg_temp.reword("summary"),
  "quickAnswer" = pg_temp.reword("quickAnswer"),
  "seoTitle" = pg_temp.reword("seoTitle"),
  "seoDescription" = pg_temp.reword("seoDescription"),
  "contentBlocks" = pg_temp.reword("contentBlocks"::text)::jsonb
WHERE "articles"::text ~ 'دام';

UPDATE "resources" SET
  "title" = pg_temp.reword("title"),
  "summary" = pg_temp.reword("summary"),
  "description" = pg_temp.reword("description"),
  "contentBlocks" = pg_temp.reword("contentBlocks"::text)::jsonb
WHERE "resources"::text ~ 'دام';

UPDATE "lessons" SET
  "title" = pg_temp.reword("title"),
  "contentBlocks" = pg_temp.reword("contentBlocks"::text)::jsonb
WHERE "lessons"::text ~ 'دام';

UPDATE "content_versions" SET "payload" = pg_temp.reword("payload"::text)::jsonb
WHERE "reviewStatus" <> 'PUBLISHED' AND "payload"::text ~ 'دام';
