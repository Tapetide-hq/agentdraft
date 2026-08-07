-- Markdown support.
--
-- source_format records what the uploader actually sent ("html" | "md"). It drives
-- which R2 object the content worker serves: an md version stores TWO objects — the
-- exact source bytes at object_key (served at /raw, preserving byte-for-byte fidelity)
-- and the rendered HTML at "<object_key minus .html>.rendered.html" (served at /d/:id
-- so a human can read it in a browser).
--
-- Defaults to 'html' so every pre-existing version keeps its current behaviour.
ALTER TABLE draft_versions ADD COLUMN source_format TEXT NOT NULL DEFAULT 'html';

CREATE INDEX idx_versions_format ON draft_versions(source_format);
