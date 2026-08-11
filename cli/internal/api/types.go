package api

type UploadMetadata struct {
	GitBranch    string `json:"git_branch,omitempty"`
	GitCommitSHA string `json:"git_commit_sha,omitempty"`
	GitDirty     bool   `json:"git_dirty,omitempty"`
	CLIVersion   string `json:"cli_version,omitempty"`
}

type UploadRequest struct {
	HTML        string          `json:"html"`
	Format      string          `json:"format,omitempty"`
	Filename    string          `json:"filename,omitempty"`
	ProjectID   string          `json:"project_id,omitempty"`
	DraftID     string          `json:"draft_id,omitempty"`
	Title       string          `json:"title,omitempty"`
	Description string          `json:"description,omitempty"`
	// Public overrides the account default for a NEW draft. A pointer so "not
	// specified" is distinguishable from "explicitly false" — with a plain bool,
	// omitempty would drop `false` and silently publish a draft the user asked to keep
	// private, which is the one failure mode this field must not have.
	Public      *bool           `json:"public,omitempty"`
	Metadata    *UploadMetadata `json:"metadata,omitempty"`
}

type ValidationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type UploadResponse struct {
	OK               bool              `json:"ok"`
	DraftID          string            `json:"draft_id"`
	VersionID        string            `json:"version_id"`
	VersionNumber    int               `json:"version_number"`
	ContentHash      string            `json:"content_hash"`
	PublicURL        string            `json:"public_url"`
	RawURL           string            `json:"raw_url"`
	VersionURL       string            `json:"version_url"`
	Title            string            `json:"title"`
	SourceFormat     string            `json:"source_format"`
	Warnings         []ValidationError `json:"warnings"`
	IdempotentReplay bool              `json:"idempotent_replay"`
}

// UploadFileResponse is the reply from POST /api/files (the arbitrary-file lane).
type UploadFileResponse struct {
	OK               bool   `json:"ok"`
	FileID           string `json:"file_id"`
	PublicURL        string `json:"public_url"`
	Filename         string `json:"filename"`
	ContentType      string `json:"content_type"`
	FileSize         int64  `json:"file_size"`
	IdempotentReplay bool   `json:"idempotent_replay"`
}

type Account struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	IsOwner bool   `json:"is_owner"`
	// DefaultDraftPublic is the account-level default applied to NEWLY created drafts.
	DefaultDraftPublic bool `json:"default_draft_public"`
}

type MeResponse struct {
	OK      bool     `json:"ok"`
	Account Account  `json:"account"`
	Via     string   `json:"via"`
	Scopes  []string `json:"scopes"`
}

type Draft struct {
	ID               string `json:"id"`
	ProjectID        string `json:"project_id"`
	Title            string `json:"title"`
	Description      string `json:"description"`
	PublishedVersion int    `json:"published_version"`
	PublicURL        string `json:"public_url"`
	UpdatedAt        string `json:"updated_at"`
	// IsPublic is an int in D1 (0/1), so it decodes as a number here rather than a bool.
	IsPublic int `json:"is_public"`
}

// VisibilityResponse is returned by the per-draft visibility endpoint.
type VisibilityResponse struct {
	OK        bool   `json:"ok"`
	ID        string `json:"id"`
	Public    bool   `json:"public"`
	PublicURL string `json:"public_url"`
}

// BulkVisibilityResponse reports how many drafts a bulk change actually touched, so the
// CLI can tell the user the real number instead of claiming success blindly.
type BulkVisibilityResponse struct {
	OK      bool `json:"ok"`
	Public  bool `json:"public"`
	Changed int  `json:"changed"`
}

// SettingsResponse is returned by the account-settings endpoint.
type SettingsResponse struct {
	OK                 bool `json:"ok"`
	DefaultDraftPublic bool `json:"default_draft_public"`
}

type DraftsResponse struct {
	OK     bool    `json:"ok"`
	Drafts []Draft `json:"drafts"`
}

type Project struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	RepoURL     string `json:"repo_url"`
	UpdatedAt   string `json:"updated_at"`
}

type ProjectsResponse struct {
	OK       bool      `json:"ok"`
	Projects []Project `json:"projects"`
}

// APIError is the uniform server error envelope.
type APIError struct {
	OK    bool `json:"ok"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	Errors []ValidationError `json:"errors,omitempty"`
}
