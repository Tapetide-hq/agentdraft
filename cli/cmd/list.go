package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/Tapetide-hq/agentdraft/cli/internal/api"
	"github.com/Tapetide-hq/agentdraft/cli/internal/auth"
	"github.com/Tapetide-hq/agentdraft/cli/internal/config"
)

var (
	listProject string
	listJSON    bool
	listLimit   int
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List your drafts",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := authedClient()
		if err != nil {
			return err
		}
		resp, err := client.ListDrafts(listProject, listLimit)
		if err != nil {
			return err
		}
		if listJSON {
			b, _ := json.MarshalIndent(resp.Drafts, "", "  ")
			fmt.Println(string(b))
			return nil
		}
		if len(resp.Drafts) == 0 {
			fmt.Println("No drafts yet.")
			return nil
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		// VISIBILITY is shown because a private draft's URL looks identical to a public
		// one. Without this column the only way to tell them apart is to open the link
		// in a logged-out browser, which is exactly the mistake this column prevents.
		fmt.Fprintln(w, "DRAFT ID	VER	VISIBILITY	TITLE	URL")
		for _, d := range resp.Drafts {
			vis := "public"
			if d.IsPublic == 0 {
				vis = "private"
			}
			fmt.Fprintf(w, "%s	%d	%s	%s	%s\n", d.ID, d.PublishedVersion, vis, truncate(d.Title, 30), d.PublicURL)
		}
		return w.Flush()
	},
}

func authedClient() (*api.Client, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}
	creds, err := auth.Load()
	if err != nil {
		return nil, err
	}
	return api.New(cfg.APIURL, creds.APIKey), nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func init() {
	listCmd.Flags().StringVar(&listProject, "project", "", "filter by project id")
	listCmd.Flags().BoolVar(&listJSON, "json", false, "output as JSON")
	listCmd.Flags().IntVar(&listLimit, "limit", 100, "max results")
	rootCmd.AddCommand(listCmd)
}
