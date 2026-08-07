// Package auth stores CLI credentials in ~/.agentdraft/credentials.json (0600).
package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/Tapetide-hq/agentdraft/cli/internal/config"
)

const filePerm = 0o600

type Credentials struct {
	APIKey    string `json:"api_key"`
	AccountID string `json:"account_id,omitempty"`
}

func path() (string, error) {
	d, err := config.Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "credentials.json"), nil
}

// Load returns the stored credentials, or an error if none are set.
func Load() (*Credentials, error) {
	p, err := path()
	if err != nil {
		return nil, err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("not authenticated: run `agentdraft auth login` or `agentdraft auth set <key>`")
		}
		return nil, err
	}
	c := &Credentials{}
	if err := json.Unmarshal(b, c); err != nil {
		return nil, fmt.Errorf("parse credentials.json: %w", err)
	}
	if c.APIKey == "" {
		return nil, fmt.Errorf("no API key stored; run `agentdraft auth set <key>`")
	}
	return c, nil
}

// Save writes credentials at 0600.
func Save(c *Credentials) error {
	p, err := path()
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, filePerm)
}

// Clear removes the credentials file.
func Clear() error {
	p, err := path()
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
