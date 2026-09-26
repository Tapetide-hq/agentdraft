package version

import "testing"

func TestFromBuildInfo(t *testing.T) {
	cases := []struct{ mod, want string }{
		{"v0.3.0", "0.3.0"},
		{"v1.2.3-pre", "1.2.3-pre"},
		{"(devel)", devVersion},
		{"", devVersion},
		// A pseudo-version from `go install cli@latest` on an untagged module is still
		// more truthful than "0.1.0-dev": it names the commit.
		{"v0.0.0-20260925172024-8fce5c86ad0c", "0.0.0-20260925172024-8fce5c86ad0c"},
	}
	for _, c := range cases {
		if got := fromBuildInfo(c.mod, devVersion); got != c.want {
			t.Errorf("fromBuildInfo(%q) = %q, want %q", c.mod, got, c.want)
		}
	}
}
