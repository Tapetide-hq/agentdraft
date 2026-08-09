package api

import "testing"

// draftPathRe drives the PRIVATE-draft fallback: when the content origin answers 302,
// Fetch translates the content URL into the authenticated API path. If this regex stops
// matching, `agentdraft fetch` on a private draft fails with "cannot resolve a draft id"
// instead of returning the document — and if it matches too loosely, we'd send a
// nonsense id to the API. Neither is caught by a compile.
func TestDraftPathRe(t *testing.T) {
	cases := []struct {
		path    string
		wantID  string
		wantVer string
		wantRaw string
	}{
		// Current 22-char ids.
		{"/d/lrf7131nb6mszmtsbb75bb", "lrf7131nb6mszmtsbb75bb", "", ""},
		{"/d/lrf7131nb6mszmtsbb75bb/raw", "lrf7131nb6mszmtsbb75bb", "", "/raw"},
		{"/d/lrf7131nb6mszmtsbb75bb/v/2", "lrf7131nb6mszmtsbb75bb", "2", ""},
		{"/d/lrf7131nb6mszmtsbb75bb/v/2/raw", "lrf7131nb6mszmtsbb75bb", "2", "/raw"},
		// LEGACY 12-char ids must keep resolving — those links are already shared.
		{"/d/cas3z3e5k05r", "cas3z3e5k05r", "", ""},
		{"/d/cas3z3e5k05r/v/10/raw", "cas3z3e5k05r", "10", "/raw"},
	}
	for _, c := range cases {
		m := draftPathRe.FindStringSubmatch(c.path)
		if m == nil {
			t.Errorf("%s: expected a match, got none", c.path)
			continue
		}
		if m[1] != c.wantID {
			t.Errorf("%s: id = %q, want %q", c.path, m[1], c.wantID)
		}
		if m[2] != c.wantVer {
			t.Errorf("%s: version = %q, want %q", c.path, m[2], c.wantVer)
		}
		if m[3] != c.wantRaw {
			t.Errorf("%s: raw = %q, want %q", c.path, m[3], c.wantRaw)
		}
	}
}

func TestDraftPathReRejects(t *testing.T) {
	// Each of these must NOT match, so we never hand a bogus id to the API.
	bad := []string{
		"/d/",                        // no id
		"/d/short",                   // under the 6-char floor
		"/d/AAAAAAAAAAAA",            // uppercase is not in the id alphabet
		"/d/abc123/v/",               // version marker with no number
		"/d/abc123/v/x",              // non-numeric version
		"/d/abc123/extra",            // unknown trailing segment
		"/private/d/abc123def456",    // dashboard path, not a content path
		"/d/abc123def456/raw/extra",  // trailing junk after /raw
		"/d/" + string(make([]byte, 40)), // over the 32-char ceiling
	}
	for _, p := range bad {
		if m := draftPathRe.FindStringSubmatch(p); m != nil {
			t.Errorf("%q: expected NO match, got id=%q", p, m[1])
		}
	}
}
