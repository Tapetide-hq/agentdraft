// Package drafts maps local file paths to remote draft IDs in ~/.webhost/drafts.json,
// so re-uploading the same file updates the same draft by default.
package drafts

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/Tapetide-hq/webhost/cli/internal/config"
)

const filePerm = 0o600

type Mapping struct {
	DraftID   string `json:"draft_id"`
	PublicURL string `json:"public_url"`
}

type store map[string]Mapping

func path() (string, error) {
	d, err := config.Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "drafts.json"), nil
}

func load() (store, error) {
	p, err := path()
	if err != nil {
		return nil, err
	}
	s := store{}
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return s, nil
		}
		return nil, err
	}
	_ = json.Unmarshal(b, &s)
	if s == nil {
		s = store{}
	}
	return s, nil
}

func save(s store) error {
	p, err := path()
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, filePerm)
}

// Get returns the mapped draft ID for absPath, or "" if none.
func Get(absPath string) string {
	s, err := load()
	if err != nil {
		return ""
	}
	return s[absPath].DraftID
}

// Set records the draft mapping for absPath.
func Set(absPath, draftID, publicURL string) error {
	s, err := load()
	if err != nil {
		return err
	}
	s[absPath] = Mapping{DraftID: draftID, PublicURL: publicURL}
	return save(s)
}
