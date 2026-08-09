package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Show the current account",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := authedClient()
		if err != nil {
			return err
		}
		me, err := client.Me()
		if err != nil {
			return err
		}
		fmt.Printf("Account: %s\n", me.Account.Name)
		fmt.Printf("ID:      %s\n", me.Account.ID)
		if me.Account.Email != "" {
			fmt.Printf("Email:   %s\n", me.Account.Email)
		}
		fmt.Printf("Auth:    %s\n", me.Via)
		fmt.Printf("Scopes:  %s\n", strings.Join(me.Scopes, ", "))
		// Surface the visibility default so a user can see, without guessing, whether
		// their next `upload` will produce a public or a private link.
		if me.Account.DefaultDraftPublic {
			fmt.Printf("New drafts: public\n")
		} else {
			fmt.Printf("New drafts: private (only you can read them)\n")
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(whoamiCmd)
}
