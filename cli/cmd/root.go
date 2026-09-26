package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/Tapetide-hq/agentdraft/cli/internal/version"
)

var rootCmd = &cobra.Command{
	Use:   "agentdraft",
	Short: "Publish Markdown or HTML and get a stable, versioned URL",
	Long: `agentdraft publishes Markdown or HTML documents (plans, proposals, reports) and
returns a stable URL a human can open. Built for AI agents, CI pipelines, and developers.

Markdown is rendered once at upload; HTML is validated server-side and served
byte-for-byte from an isolated origin. Every upload of the same file creates a new
immutable version at the same URL. Use 'agentdraft file' for any other file type.`,
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
