-- Refuse the downgrade once any message has been recorded: the log is the
-- only record of what a student or instructor was told, and when.
CREATE TEMP TABLE "_sms_messages_down_guard" ("empty" BOOLEAN NOT NULL CHECK ("empty")) ON COMMIT DROP;

INSERT INTO "_sms_messages_down_guard" SELECT false FROM "sms_messages" LIMIT 1;

DROP TABLE "sms_messages";
DROP TYPE "SmsStatus";
