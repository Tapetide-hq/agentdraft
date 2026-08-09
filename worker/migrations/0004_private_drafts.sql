-- Private drafts + higher-entropy draft ids.
--
-- WHAT PROBLEM THIS SOLVES. Until now every published draft was readable by anyone
-- holding its URL, forever, with no revocation. URLs leak — chat, PR comments, CI logs,
-- Referer headers — and entropy does nothing about a pasted link. Access control does.
--
-- `drafts.is_public` already existed and the content worker already enforced it
-- (403 when 0), but NOTHING could ever set it. This migration makes it settable and
-- gives accounts a default to apply to new drafts.
--
-- DELIBERATELY NOT RETROACTIVE. Adding a column with DEFAULT 1 leaves every existing
-- draft public, which is correct: flipping shared links private without warning breaks
-- URLs people already handed to reviewers. The default applies to NEW drafts, and the
-- dashboard/CLI expose an explicit bulk action for existing ones.

-- Per-account default visibility for NEWLY created drafts.
-- 1 = new drafts are public (today's behaviour, so existing users see no change)
-- 0 = new drafts are private
ALTER TABLE accounts ADD COLUMN default_draft_public INTEGER NOT NULL DEFAULT 1;

-- When a draft was last made private/public and by whom, for support and audit. A user
-- asking "why can nobody open my link" is almost always a visibility change they forgot.
ALTER TABLE drafts ADD COLUMN visibility_changed_at TEXT;

-- The content origin is cookie-free by design (it serves attacker-controlled HTML, so a
-- session must never be readable there). A private draft is therefore NOT served by the
-- content worker at all: it redirects to the dashboard, which holds the session, verifies
-- ownership, and streams the bytes itself.
--
-- This index supports that hot path: the content worker checks visibility on EVERY
-- request before touching R2 or its cache, so the lookup must stay cheap.
CREATE INDEX idx_drafts_visibility ON drafts(id, is_public) WHERE deleted_at IS NULL;
