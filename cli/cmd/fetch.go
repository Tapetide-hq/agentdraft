package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/Hitesh-Sisara/webhost/cli/internal/api"
	"github.com/Hitesh-Sisara/webhost/cli/internal/config"
)

var (
	fetchOutput  string
	fetchVersion int
)

var fetchCmd = &cobra.Command{
	Use:   "fetch <url|draft-id>",
	Short: "Download a draft's HTML to stdout or a file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		client := api.New(cfg.APIURL, "")

		target := args[0]
		rawURL := resolveFetchURL(target, fetchVersion)

		data, err := client.Fetch(rawURL)
		if err != nil {
			return err
		}
		if fetchOutput != "" {
			if err := os.WriteFile(fetchOutput, data, 0o644); err != nil {
				return err
			}
			fmt.Fprintf(os.Stderr, "Wrote %d bytes to %s\n", len(data), fetchOutput)
			return nil
		}
		_, err = os.Stdout.Write(data)
		return err
	},
}

// resolveFetchURL accepts either a full https URL or a bare draft id. Content is
// served from the content origin, which the config does not track directly; if a bare
// id is given we assume the standard content host derived from convention.
func resolveFetchURL(target string, version int) string {
	if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
		if version > 0 {
			// insert /v/<n> before an optional trailing /raw
			base := strings.TrimRight(target, "/")
			base = strings.TrimSuffix(base, "/raw")
			return fmt.Sprintf("%s/v/%d/raw", base, version)
		}
		if strings.HasSuffix(target, "/raw") {
			return target
		}
		return strings.TrimRight(target, "/") + "/raw"
	}
	// bare id — derive content host from the API host (api -> content)
	content := strings.Replace(config.DefaultAPIURL, "webhost-api", "webhost-content", 1)
	if version > 0 {
		return fmt.Sprintf("%s/d/%s/v/%d/raw", content, target, version)
	}
	return fmt.Sprintf("%s/d/%s/raw", content, target)
}

func init() {
	fetchCmd.Flags().StringVarP(&fetchOutput, "output", "o", "", "write to file instead of stdout")
	fetchCmd.Flags().IntVar(&fetchVersion, "version", 0, "fetch a specific version number")
	rootCmd.AddCommand(fetchCmd)
}
