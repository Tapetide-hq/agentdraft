package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/Tapetide-hq/agentdraft/cli/internal/api"
	"github.com/Tapetide-hq/agentdraft/cli/internal/auth"
	"github.com/Tapetide-hq/agentdraft/cli/internal/config"
	"github.com/Tapetide-hq/agentdraft/cli/internal/drafts"
	"github.com/Tapetide-hq/agentdraft/cli/internal/git"
	"github.com/Tapetide-hq/agentdraft/cli/internal/validate"
	"github.com/Tapetide-hq/agentdraft/cli/internal/version"
)

var (
	upProject     string
	upDraft       string
	upNew         bool
	upDescription string
	upTitle       string
	upIdempotency string
	upPrivate     bool
	upPublic      bool
)

var uploadCmd = &cobra.Command{
	Use:   "upload <file>",
	Short: "Upload an HTML file (create or update a draft)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		file := args[0]
		absPath, err := filepath.Abs(file)
		if err != nil {
			return err
		}
		html, err := os.ReadFile(absPath)
		if err != nil {
			return fmt.Errorf("read %s: %w", file, err)
		}

		// Transport pre-check only (NOT a security gate — the server is authoritative).
		pc := validate.PreCheck(html)
		if !pc.OK {
			return fmt.Errorf("pre-check failed:\n  - %s", join(pc.Errors, "\n  - "))
		}

		cfg, err := config.Load()
		if err != nil {
			return err
		}
		creds, err := auth.Load()
		if err != nil {
			return err
		}
		client := api.New(cfg.APIURL, creds.APIKey)

		// Resolve project name -> id (create if it's a name that doesn't exist).
		projectID := upProject
		if projectID != "" && !isID(projectID, "proj_") {
			id, err := resolveProject(client, projectID)
			if err != nil {
				return err
			}
			projectID = id
		}

		// Determine draft to update.
		draftID := upDraft
		if draftID == "" && !upNew {
			draftID = drafts.Get(absPath)
		}

		gm := git.Collect(filepath.Dir(absPath))
		// A .md file is sent as `markdown` so the server renders it for browser
		// reading while keeping the exact source retrievable at /raw. The CLI does not
		// render anything itself — the server is the single authority.
		format := ""
		if isMarkdownFile(absPath) {
			format = "md"
		}
		req := api.UploadRequest{
			HTML:        string(html),
			Format:      format,
			Filename:    filepath.Base(absPath),
			ProjectID:   projectID,
			DraftID:     draftID,
			Title:       upTitle,
			Description: upDescription,
			Metadata: &api.UploadMetadata{
				GitBranch:    gm.Branch,
				GitCommitSHA: gm.CommitSHA,
				GitDirty:     gm.Dirty,
				CLIVersion:   version.Version,
			},
		}

		// Visibility override for a NEW draft. Sent as a POINTER so "flag absent" is
		// distinguishable from "explicitly public": omitting it lets the account default
		// apply, which is what an agent with no opinion should get.
		//
		// Note this only affects draft CREATION. Re-uploading to an existing draft never
		// changes its visibility — silently flipping a shared link on the next `upload`
		// would be a nasty surprise. Use `agentdraft visibility` for that.
		if upPrivate {
			v := false
			req.Public = &v
		} else if upPublic {
			v := true
			req.Public = &v
		}

		resp, err := client.Upload(req, upIdempotency)
		if err != nil {
			return err
		}

		// Save mapping so a re-upload of this file updates the same draft.
		_ = drafts.Set(absPath, resp.DraftID, resp.PublicURL)

		for _, w := range resp.Warnings {
			fmt.Fprintf(os.Stderr, "warning: %s (%s)\n", w.Message, w.Code)
		}
		fmt.Printf("URL:     %s\n", resp.PublicURL)
		fmt.Printf("Draft:   %s\n", resp.DraftID)
		fmt.Printf("Version: %d\n", resp.VersionNumber)
		fmt.Printf("Title:   %s\n", resp.Title)
		if resp.IdempotentReplay {
			fmt.Println("(idempotent replay — no new version created)")
		}
		return nil
	},
}

func resolveProject(client *api.Client, name string) (string, error) {
	list, err := client.ListProjects()
	if err != nil {
		return "", err
	}
	for _, p := range list.Projects {
		if p.Name == name {
			return p.ID, nil
		}
	}
	// create it
	return client.CreateProject(name)
}

// isMarkdownFile reports whether a path has a Markdown extension.
func isMarkdownFile(p string) bool {
	switch strings.ToLower(filepath.Ext(p)) {
	case ".md", ".markdown", ".mdown", ".mkd":
		return true
	}
	return false
}

func isID(s, prefix string) bool {
	return len(s) > len(prefix) && s[:len(prefix)] == prefix
}

func join(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}

func init() {
	uploadCmd.Flags().StringVar(&upProject, "project", "", "assign to project (name or proj_ id; created if a new name)")
	uploadCmd.Flags().StringVar(&upDraft, "draft", "", "force update a specific draft id")
	uploadCmd.Flags().BoolVar(&upNew, "new", false, "always create a new draft")
	uploadCmd.Flags().StringVar(&upDescription, "description", "", "short label for the draft")
	uploadCmd.Flags().StringVar(&upTitle, "title", "", "override the extracted title")
	uploadCmd.Flags().StringVar(&upIdempotency, "idempotency-key", "", "dedupe retries")
	uploadCmd.Flags().BoolVar(&upPrivate, "private", false, "create the draft private (owner-only); overrides the account default")
	uploadCmd.Flags().BoolVar(&upPublic, "public", false, "create the draft public; overrides the account default")
	// Mutually exclusive: asking for both is a mistake worth surfacing rather than
	// silently letting one win.
	uploadCmd.MarkFlagsMutuallyExclusive("private", "public")
	rootCmd.AddCommand(uploadCmd)
}
