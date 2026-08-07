// Package validate performs CLIENT-SIDE TRANSPORT PRE-CHECKS only.
//
// It is deliberately NOT a security validator. The single authoritative HTML
// validation gate is the server (see shared/html-policy.md); a second full validator
// in Go would drift from it. The CLI's job here is fast, cheap feedback on things that
// are cheap to check locally and would otherwise waste a network round-trip: empty
// files, non-UTF-8 bytes, and oversize documents. The server re-checks everything and
// its verdict is authoritative — the CLI displays the server's errors verbatim.
package validate

import (
	"fmt"
	"unicode/utf8"
)

const MaxBytes = 2 * 1024 * 1024 // must match server MAX_BYTES

type PreCheckResult struct {
	OK     bool
	Errors []string
}

// PreCheck runs transport-level checks only. A pass here does NOT mean the document
// is acceptable — only that it is worth sending to the server.
func PreCheck(html []byte) PreCheckResult {
	var errs []string
	if len(html) == 0 {
		errs = append(errs, "file is empty")
	}
	if len(html) > MaxBytes {
		errs = append(errs, fmt.Sprintf("file is %d bytes; server limit is %d (2 MiB)", len(html), MaxBytes))
	}
	if !utf8.Valid(html) {
		errs = append(errs, "file is not valid UTF-8")
	}
	return PreCheckResult{OK: len(errs) == 0, Errors: errs}
}
