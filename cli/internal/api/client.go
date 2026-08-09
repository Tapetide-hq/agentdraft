// Package api is the HTTP client for the AgentDraft API.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// draftPathRe matches a content-origin document path: /d/:id[/v/N][/raw].
// Accepts 6..32 chars so legacy 12-char ids and current 22-char ids both resolve.
var draftPathRe = regexp.MustCompile(`^/d/([a-z0-9]{6,32})(?:/v/(\d+))?(/raw)?$`)

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

// SetDraftVisibility makes ONE draft public or private.
func (c *Client) SetDraftVisibility(draftID string, public bool) (*VisibilityResponse, error) {
	data, status, err := c.do(
		http.MethodPatch,
		"/api/drafts/"+draftID+"/visibility",
		map[string]bool{"public": public},
		nil,
	)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		// "no such draft" and "not yours" are deliberately indistinguishable server-side.
		return nil, fmt.Errorf("draft not found, or it belongs to another account")
	}
	if status != http.StatusOK {
		return nil, parseError(status, data)
	}
	var r VisibilityResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// SetAllDraftsVisibility applies a visibility to EVERY draft in the account and reports
// how many rows actually changed.
func (c *Client) SetAllDraftsVisibility(public bool) (*BulkVisibilityResponse, error) {
	data, status, err := c.do(
		http.MethodPost,
		"/api/drafts/visibility/bulk",
		map[string]bool{"public": public},
		nil,
	)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, parseError(status, data)
	}
	var r BulkVisibilityResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// SetDefaultVisibility changes the account default applied to NEWLY created drafts.
// Existing drafts are untouched — see SetAllDraftsVisibility for that.
func (c *Client) SetDefaultVisibility(public bool) (*SettingsResponse, error) {
	data, status, err := c.do(
		http.MethodPatch,
		"/api/me/settings",
		map[string]bool{"default_draft_public": public},
		nil,
	)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, parseError(status, data)
	}
	var r SettingsResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// Fetch downloads served HTML from a public content URL (no auth).
func (c *Client) Fetch(rawURL string) ([]byte, error) {
	// Do NOT follow redirects blindly. A PRIVATE draft answers with a 302 to the
	// dashboard sign-in page, and following it would hand back an HTML login page as if
	// it were the document — the worst possible outcome, because it looks like success.
	// Detect the hop and fall back to the authenticated API path instead.
	noRedirect := &http.Client{
		Timeout: c.http.Timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := noRedirect.Get(rawURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 302/403 here means "not public". Retry through the authenticated endpoint, which
	// succeeds when the caller owns the draft and 404s when they do not.
	if resp.StatusCode == http.StatusFound ||
		resp.StatusCode == http.StatusMovedPermanently ||
		resp.StatusCode == http.StatusForbidden {
		if c.APIKey == "" {
			return nil, fmt.Errorf("this draft is private; run `agentdraft auth set <key>` first")
		}
		return c.fetchPrivate(rawURL)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d fetching %s", resp.StatusCode, rawURL)
	}
	return data, nil
}

// fetchPrivate pulls a private draft through the authenticated API, translating a
// content-origin URL (/d/:id[/v/N][/raw]) into the API's owner-only content endpoint.
func (c *Client) fetchPrivate(rawURL string) ([]byte, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	m := draftPathRe.FindStringSubmatch(strings.TrimRight(u.Path, "/"))
	if m == nil {
		return nil, fmt.Errorf("cannot resolve a draft id from %s", rawURL)
	}
	q := url.Values{}
	if m[2] != "" {
		q.Set("v", m[2])
	}
	if m[3] != "" {
		q.Set("raw", "1")
	}
	path := "/api/drafts/" + m[1] + "/content"
	if len(q) > 0 {
		path += "?" + q.Encode()
	}
	data, status, err := c.do(http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		// The API deliberately does not distinguish "no such draft" from "not yours".
		return nil, fmt.Errorf("draft not found, or it belongs to another account")
	}
	if status != http.StatusOK {
		return nil, parseError(status, data)
	}
	return data, nil
}
