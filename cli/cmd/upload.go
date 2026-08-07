package cmd

import (
	"fmt"
	"os"
	"path/filepath"

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
		req := api.UploadRequest{
			HTML:        string(html),
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
	rootCmd.AddCommand(uploadCmd)
}
