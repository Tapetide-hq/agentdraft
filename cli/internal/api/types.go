package api

type UploadMetadata struct {
	GitBranch    string `json:"git_branch,omitempty"`
	GitCommitSHA string `json:"git_commit_sha,omitempty"`
	GitDirty     bool   `json:"git_dirty,omitempty"`
	CLIVersion   string `json:"cli_version,omitempty"`
}

type UploadRequest struct {
	HTML        string          `json:"html"`
	Filename    string          `json:"filename,omitempty"`
	ProjectID   string          `json:"project_id,omitempty"`
	DraftID     string          `json:"draft_id,omitempty"`
	Title       string          `json:"title,omitempty"`
	Description string          `json:"description,omitempty"`
	Metadata    *UploadMetadata `json:"metadata,omitempty"`
}

type ValidationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type UploadResponse struct {
	OK             bool              `json:"ok"`
	DraftID        string            `json:"draft_id"`
	VersionID      string            `json:"version_id"`
	VersionNumber  int               `json:"version_number"`
	ContentHash    string            `json:"content_hash"`
	PublicURL      string            `json:"public_url"`
	RawURL         string            `json:"raw_url"`
	VersionURL     string            `json:"version_url"`
	Title          string            `json:"title"`
	Warnings       []ValidationError `json:"warnings"`
	IdempotentReplay bool            `json:"idempotent_replay"`
}

type Account struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	IsOwner bool   `json:"is_owner"`
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
