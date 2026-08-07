package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/Tapetide-hq/webhost/cli/internal/config"
)

var setAPIURL string

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Show or set CLI configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		if setAPIURL != "" {
			cfg.APIURL = setAPIURL
			if err := config.Save(cfg); err != nil {
				return err
			}
			fmt.Printf("Set api_url = %s\n", cfg.APIURL)
			return nil
		}
		fmt.Printf("api_url = %s\n", cfg.APIURL)
		return nil
	},
}

func init() {
	configCmd.Flags().StringVar(&setAPIURL, "api-url", "", "override the API base URL")
	rootCmd.AddCommand(configCmd)
}
