package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/spf13/cobra"

	"github.com/Tapetide-hq/agentdraft/cli/internal/api"
	"github.com/Tapetide-hq/agentdraft/cli/internal/auth"
	"github.com/Tapetide-hq/agentdraft/cli/internal/config"
	"github.com/Tapetide-hq/agentdraft/cli/internal/drafts"
)

var (
	visAll     bool
	visDefault bool
)

// contentPathRe pulls a draft id out of a full content URL.
// 6..32 chars so both legacy 12-char ids and current 22-char ids resolve.
var contentPathRe = regexp.MustCompile(`/d/([a-z0-9]{6,32})`)

// absOrSelf resolves a path for the drafts.json lookup, which is keyed on ABSOLUTE
// paths. Falls back to the input unchanged when it is not a usable path, so a bare id
// or URL passes through untouched instead of erroring.
func absOrSelf(p string) string {
	abs, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return abs
}

// resolveDraftArg turns a user-supplied argument into a draft id.
//
// Accepts a bare id, a full content URL, or a local file path that has been uploaded
// before (resolved through the same ~/.agentdraft/drafts.json mapping `upload` uses).
// Accepting the file path matters: the user's mental model is "the plan I published",
// not a 22-char opaque id they never chose.
func resolveDraftArg(arg string) string {
	if id := drafts.Get(absOrSelf(arg)); id != "" {
		return id
	}
	if m := contentPathRe.FindStringSubmatch(arg); m != nil {
		return m[1]
	}
	return arg
}

var visibilityCmd = &cobra.Command{
	Use:   "visibility <public|private> [draft-id|url|file]",
	Short: "Make a draft public or private",
	Long: `Change who can read a draft.

  public   anyone with the URL can read it
  private  only you, signed in via the dashboard or this CLI

The URL never changes. A private draft's link still works for you — it redirects
through the dashboard, which verifies you own it. Anyone else gets a sign-in page.

  agentdraft visibility private plan.md        # the draft this file publishes to
  agentdraft visibility private a1b2c3d4e5f6   # by id
  agentdraft visibility public --all           # every draft in the account
  agentdraft visibility private --default      # default for NEW drafts only`,
	Args: cobra.RangeArgs(1, 2),
	RunE: func(cmd *cobra.Command, args []string) error {
		var public bool
		switch args[0] {
		case "public":
			public = true
		case "private":
			public = false
		default:
			return fmt.Errorf("first argument must be 'public' or 'private', got %q", args[0])
		}

		cfg, err := config.Load()
		if err != nil {
			return err
		}
		creds, err := auth.Load()
		if err != nil {
			return err
		}
		client := api.New(cfg.APIURL, creds.APIKey)

		switch {
		case visDefault:
			// Account default. Deliberately does NOT touch existing drafts — see --all.
			res, err := client.SetDefaultVisibility(public)
			if err != nil {
				return err
			}
			state := "private"
			if res.DefaultDraftPublic {
				state = "public"
			}
			fmt.Printf("New drafts will be %s.\n", state)
			fmt.Println("Existing drafts are unchanged. Use --all to change those too.")
			return nil

		case visAll:
			res, err := client.SetAllDraftsVisibility(public)
			if err != nil {
				return err
			}
			state := "private"
			if res.Public {
				state = "public"
			}
			// Report the real count. "Done" without a number hides a no-op.
			switch res.Changed {
			case 0:
				fmt.Printf("No changes — every draft was already %s.\n", state)
			case 1:
				fmt.Printf("1 draft is now %s.\n", state)
			default:
				fmt.Printf("%d drafts are now %s.\n", res.Changed, state)
			}
			return nil

		default:
			if len(args) < 2 {
				return fmt.Errorf("specify a draft (id, url, or file), or pass --all / --default")
			}
			id := resolveDraftArg(args[1])
			res, err := client.SetDraftVisibility(id, public)
			if err != nil {
				return err
			}
			if res.Public {
				fmt.Printf("Public — anyone with the link can read it.\n%s\n", res.PublicURL)
			} else {
				fmt.Printf("Private — only you can read it, signed in.\n%s\n", res.PublicURL)
				fmt.Fprintln(os.Stderr, "The link is unchanged; others now get a sign-in page.")
			}
			return nil
		}
	},
}

func init() {
	visibilityCmd.Flags().BoolVar(&visAll, "all", false, "apply to EVERY existing draft in the account")
	visibilityCmd.Flags().BoolVar(&visDefault, "default", false, "set the default for NEW drafts (existing drafts untouched)")
	visibilityCmd.MarkFlagsMutuallyExclusive("all", "default")
	rootCmd.AddCommand(visibilityCmd)
}
