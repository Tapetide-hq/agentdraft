// Package api is the HTTP client for the WebHost API.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	BaseURL string
	APIKey  string
	http    *http.Client
}

func New(baseURL, apiKey string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		APIKey:  apiKey,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

// parseError reads the server error envelope and returns a human message.
func parseError(status int, body []byte) error {
	var e APIError
	if json.Unmarshal(body, &e) == nil && e.Error.Code != "" {
		msg := fmt.Sprintf("%s (%s)", e.Error.Message, e.Error.Code)
		if len(e.Errors) > 0 {
			var parts []string
			for _, v := range e.Errors {
				parts = append(parts, fmt.Sprintf("%s: %s", v.Code, v.Message))
			}
			msg += "\n  - " + strings.Join(parts, "\n  - ")
		}
		return fmt.Errorf("%s", msg)
	}
	return fmt.Errorf("HTTP %d: %s", status, string(body))
}

func (c *Client) do(method, path string, body any, headers map[string]string) ([]byte, int, error) {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.BaseURL+path, rdr)
	if err != nil {
		return nil, 0, err
	}
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return data, resp.StatusCode, nil
}

func (c *Client) Upload(req UploadRequest, idempotencyKey string) (*UploadResponse, error) {
	headers := map[string]string{}
	if idempotencyKey != "" {
		headers["Idempotency-Key"] = idempotencyKey
	}
	data, status, err := c.do(http.MethodPost, "/api/upload", req, headers)
	if err != nil {
		return nil, err
	}
	if status != http.StatusCreated && status != http.StatusOK {
		return nil, parseError(status, data)
	}
	var r UploadResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (c *Client) Me() (*MeResponse, error) {
	data, status, err := c.do(http.MethodGet, "/api/me", nil, nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, parseError(status, data)
	}
	var r MeResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (c *Client) ListDrafts(project string, limit int) (*DraftsResponse, error) {
	q := url.Values{}
	if project != "" {
		q.Set("project", project)
	}
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	path := "/api/drafts"
	if len(q) > 0 {
		path += "?" + q.Encode()
	}
	data, status, err := c.do(http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, parseError(status, data)
	}
	var r DraftsResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (c *Client) ListProjects() (*ProjectsResponse, error) {
	data, status, err := c.do(http.MethodGet, "/api/projects", nil, nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, parseError(status, data)
	}
	var r ProjectsResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// CreateProject creates a project and returns its ID.
func (c *Client) CreateProject(name string) (string, error) {
	data, status, err := c.do(http.MethodPost, "/api/projects", map[string]string{"name": name}, nil)
	if err != nil {
		return "", err
	}
	if status != http.StatusCreated && status != http.StatusOK {
		return "", parseError(status, data)
	}
	var r struct {
		Project Project `json:"project"`
	}
	if err := json.Unmarshal(data, &r); err != nil {
		return "", err
	}
	return r.Project.ID, nil
}

// Fetch downloads served HTML from a public content URL (no auth).
func (c *Client) Fetch(rawURL string) ([]byte, error) {
	resp, err := c.http.Get(rawURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d fetching %s", resp.StatusCode, rawURL)
	}
	return data, nil
}
