-- Google sign-in + the "keys require a verified Google identity" gate.
--
-- auth_method records HOW a session was established ('key' for a pasted API key,
-- 'google' for verified Google sign-in). API key MINTING is gated on 'google', so a
-- leaked API key alone cannot be used to mint further keys — an attacker with a stolen
-- key cannot escalate to durable access without also controlling the Google account.
--
-- Defaults to 'key' so every pre-existing session keeps working exactly as before.
ALTER TABLE sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'key';

-- Which account minted a key and under what identity, for audit.
ALTER TABLE api_keys ADD COLUMN created_via TEXT NOT NULL DEFAULT 'bootstrap';

CREATE INDEX idx_sessions_method ON sessions(auth_method);
