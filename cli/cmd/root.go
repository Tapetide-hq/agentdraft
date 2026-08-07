package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/Hitesh-Sisara/webhost/cli/internal/version"
)

var rootCmd = &cobra.Command{
	Use:   "webhost",
	Short: "Publish static HTML and get a stable public URL",
	Long: `webhost publishes static HTML documents (plans, proposals, reports) and
returns a stable public URL. Built for AI agents, CI pipelines, and developers.

Uploaded HTML is validated server-side and served byte-for-byte from an isolated
origin. Every upload to the same file creates a new immutable version.`,
	Version:       version.Version,
	SilenceUsage:  true,
	SilenceErrors: true,
}

// Execute runs the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
