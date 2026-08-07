package validate

import (
	"strings"
	"testing"
)

func TestPreCheckEmpty(t *testing.T) {
	r := PreCheck([]byte(""))
	if r.OK {
		t.Fatal("expected empty file to fail pre-check")
	}
	if !containsSubstr(r.Errors, "empty") {
		t.Fatalf("expected 'empty' error, got %v", r.Errors)
	}
}

func TestPreCheckValid(t *testing.T) {
	r := PreCheck([]byte("<!DOCTYPE html><html><head><title>x</title></head><body>ok</body></html>"))
	if !r.OK {
		t.Fatalf("expected valid doc to pass, got %v", r.Errors)
	}
}

func TestPreCheckTooLarge(t *testing.T) {
	big := make([]byte, MaxBytes+1)
	for i := range big {
		big[i] = 'a'
	}
	r := PreCheck(big)
	if r.OK {
		t.Fatal("expected oversize file to fail")
	}
	if !containsSubstr(r.Errors, "limit") {
		t.Fatalf("expected size error, got %v", r.Errors)
	}
}

func TestPreCheckInvalidUTF8(t *testing.T) {
	r := PreCheck([]byte{0xff, 0xfe, 0xfd})
	if r.OK {
		t.Fatal("expected invalid utf-8 to fail")
	}
	if !containsSubstr(r.Errors, "UTF-8") {
		t.Fatalf("expected utf-8 error, got %v", r.Errors)
	}
}

func containsSubstr(errs []string, sub string) bool {
	for _, e := range errs {
		if strings.Contains(e, sub) {
			return true
		}
	}
	return false
}
