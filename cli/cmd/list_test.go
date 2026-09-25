package cmd

import (
	"testing"
	"unicode/utf8"
)

func TestTruncate(t *testing.T) {
	cases := []struct {
		in   string
		n    int
		want string
	}{
		{"short", 10, "short"},
		{"exactly-ten", 11, "exactly-ten"},
		{"a much longer title here", 10, "a much lo…"},
		// Multibyte: byte-based slicing would cut "é" in half and emit invalid UTF-8.
		{"résumé résumé résumé", 8, "résumé …"},
		{"日本語のタイトルです", 5, "日本語の…"},
	}
	for _, c := range cases {
		got := truncate(c.in, c.n)
		if got != c.want {
			t.Errorf("truncate(%q, %d) = %q, want %q", c.in, c.n, got, c.want)
		}
		if !utf8.ValidString(got) {
			t.Errorf("truncate(%q, %d) produced invalid UTF-8: %q", c.in, c.n, got)
		}
	}
}
