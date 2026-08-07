// Package git extracts best-effort git metadata from a directory. All failures are
// silent — metadata is optional and must never block an upload.
package git

import (
	"os/exec"
	"strings"
)

type Meta struct {
	Branch    string `json:"git_branch,omitempty"`
	CommitSHA string `json:"git_commit_sha,omitempty"`
	Dirty     bool   `json:"git_dirty,omitempty"`
}

func run(dir string, args ...string) string {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// Collect returns git metadata for dir, or a zero Meta if dir is not a repo.
func Collect(dir string) Meta {
	if run(dir, "rev-parse", "--is-inside-work-tree") != "true" {
		return Meta{}
	}
	return Meta{
		Branch:    run(dir, "rev-parse", "--abbrev-ref", "HEAD"),
		CommitSHA: run(dir, "rev-parse", "HEAD"),
		Dirty:     run(dir, "status", "--porcelain") != "",
	}
}
