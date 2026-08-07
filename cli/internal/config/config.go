// Package config manages ~/.webhost/config.json and directory layout.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	DefaultAPIURL = "https://webhost-api.tapetide.workers.dev"
	dirPerm       = 0o700
	filePerm      = 0o600
)

type Config struct {
	APIURL string `json:"api_url"`
}

// Dir returns ~/.webhost, creating it (0700) if needed.
func Dir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	d := filepath.Join(home, ".webhost")
	if err := os.MkdirAll(d, dirPerm); err != nil {
		return "", err
	}
	return d, nil
}

func path() (string, error) {
	d, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "config.json"), nil
}

// Load reads config.json, returning defaults if absent.
func Load() (*Config, error) {
	p, err := path()
	if err != nil {
		return nil, err
	}
	c := &Config{APIURL: DefaultAPIURL}
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return c, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(b, c); err != nil {
		return nil, fmt.Errorf("parse config.json: %w", err)
	}
	if c.APIURL == "" {
		c.APIURL = DefaultAPIURL
	}
	return c, nil
}

// Save writes config.json at 0600.
func Save(c *Config) error {
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
