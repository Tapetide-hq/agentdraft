package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var projectsJSON bool

var projectsCmd = &cobra.Command{
	Use:   "projects",
	Short: "List your projects",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := authedClient()
		if err != nil {
			return err
		}
		resp, err := client.ListProjects()
		if err != nil {
			return err
		}
		if projectsJSON {
			b, _ := json.MarshalIndent(resp.Projects, "", "  ")
			fmt.Println(string(b))
			return nil
		}
		if len(resp.Projects) == 0 {
			fmt.Println("No projects yet.")
			return nil
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "PROJECT ID\tNAME\tDESCRIPTION")
		for _, p := range resp.Projects {
			fmt.Fprintf(w, "%s\t%s\t%s\n", p.ID, p.Name, truncate(p.Description, 40))
		}
		return w.Flush()
	},
}

func init() {
	projectsCmd.Flags().BoolVar(&projectsJSON, "json", false, "output as JSON")
	rootCmd.AddCommand(projectsCmd)
}
