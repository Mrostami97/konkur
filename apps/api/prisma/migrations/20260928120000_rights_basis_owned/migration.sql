-- The admin source form saved «مالکیت کنکور کامپیوتر» as "OWNED", a value the
-- API never recognised as a documented hosting or commercial right (it expects
-- "OWNED_BY_PUBLISHER"), so a paid handout linked to such a source could not be
-- published. The form now sends the recognised values; rows it already saved
-- are converted. Other legacy values ("LICENSED", "PUBLIC_DOMAIN") are left for
-- an admin to classify, because they do not say which permission was given.
UPDATE "content_sources" SET "rightsBasis" = 'OWNED_BY_PUBLISHER' WHERE "rightsBasis" = 'OWNED';
