package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/Hitesh-Sisara/webhost/cli/internal/api"
	"github.com/Hitesh-Sisara/webhost/cli/internal/auth"
	"github.com/Hitesh-Sisara/webhost/cli/internal/config"
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manage authentication credentials",
}

var authSetCmd = &cobra.Command{
	Use:   "set <api-key>",
	Short: "Store an API key (wh_...)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		// Verify the key against the server before storing it.
		client := api.New(cfg.APIURL, key)
		me, err := client.Me()
		if err != nil {
			return fmt.Errorf("key verification failed: %w", err)
		}
		if err := auth.Save(&auth.Credentials{APIKey: key, AccountID: me.Account.ID}); err != nil {
			return err
		}
		fmt.Printf("Authenticated as %s (%s).\n", me.Account.Name, me.Account.ID)
		return nil
	},
}

var authLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Sign in (paste an API key created in the dashboard)",
	Long: `Sign in to WebHost.

v1 is invite-only: create an API key in the dashboard (Settings -> API Keys) and
paste it here. This is the same as 'webhost auth set <key>' but interactive.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		fmt.Printf("Create a key in the dashboard, then paste it here.\n")
		fmt.Printf("API key: ")
		var key string
		if _, err := fmt.Scanln(&key); err != nil {
			return fmt.Errorf("no key entered")
		}
		client := api.New(cfg.APIURL, key)
		me, err := client.Me()
		if err != nil {
			return fmt.Errorf("key verification failed: %w", err)
		}
		if err := auth.Save(&auth.Credentials{APIKey: key, AccountID: me.Account.ID}); err != nil {
			return err
		}
		fmt.Printf("Authenticated as %s.\n", me.Account.Name)
		return nil
	},
}

var authLogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove stored credentials",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := auth.Clear(); err != nil {
			return err
		}
		fmt.Println("Logged out.")
		return nil
	},
}

func init() {
	authCmd.AddCommand(authSetCmd, authLoginCmd, authLogoutCmd)
	rootCmd.AddCommand(authCmd)
}
