package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/Hitesh-Sisara/webhost/cli/internal/api"
	"github.com/Hitesh-Sisara/webhost/cli/internal/auth"
	"github.com/Hitesh-Sisara/webhost/cli/internal/config"
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
		fmt.Fprintln(w, "DRAFT ID\tVER\tTITLE\tURL")
		for _, d := range resp.Drafts {
			fmt.Fprintf(w, "%s\t%d\t%s\t%s\n", d.ID, d.PublishedVersion, truncate(d.Title, 30), d.PublicURL)
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
