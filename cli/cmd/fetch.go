package cmd

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/Tapetide-hq/agentdraft/cli/internal/api"
	"github.com/Tapetide-hq/agentdraft/cli/internal/config"
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
	// bare id — derive the content host from the configured API host.
	// api.postplan.tapetide.com -> postplan.tapetide.com (strip the leading "api." label).
	// Falls back to the api host itself if the pattern does not match.
	content := contentHostFrom(configuredAPIURL())
	if version > 0 {
		return fmt.Sprintf("%s/d/%s/v/%d/raw", content, target, version)
	}
	return fmt.Sprintf("%s/d/%s/raw", content, target)
}

// configuredAPIURL returns the api_url from ~/.agentdraft/config.json, falling back to the
// compiled-in default. Reading config here (rather than using the default directly) is
// what makes `fetch` work against a self-hosted instance.
func configuredAPIURL() string {
	cfg, err := config.Load()
	if err != nil || cfg.APIURL == "" {
		return config.DefaultAPIURL
	}
	return cfg.APIURL
}

// contentHostFrom derives the public content origin from the API origin by stripping a
// leading "api." label (api.postplan.example -> postplan.example). If there is no such
// label the API origin is returned unchanged, which is the correct behaviour for a
// single-host deployment.
func contentHostFrom(apiURL string) string {
	u, err := url.Parse(apiURL)
	if err != nil || u.Host == "" {
		return strings.TrimRight(apiURL, "/")
	}
	if strings.HasPrefix(u.Host, "api.") {
		u.Host = strings.TrimPrefix(u.Host, "api.")
	}
	u.Path = ""
	return strings.TrimRight(u.String(), "/")
}

func init() {
	fetchCmd.Flags().StringVarP(&fetchOutput, "output", "o", "", "write to file instead of stdout")
	fetchCmd.Flags().IntVar(&fetchVersion, "version", 0, "fetch a specific version number")
	rootCmd.AddCommand(fetchCmd)
}
