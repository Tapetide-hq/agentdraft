package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/Tapetide-hq/agentdraft/cli/internal/api"
	"github.com/Tapetide-hq/agentdraft/cli/internal/auth"
	"github.com/Tapetide-hq/agentdraft/cli/internal/config"
	"github.com/Tapetide-hq/agentdraft/cli/internal/version"
)

var (
	fileContentType string
	fileIdempotency string
)

// maxFileBytes mirrors MAX_FILE_BYTES in worker/src/services/files.ts. The server is
// authoritative; this is a fail-fast pre-check so a doomed 100 MB+ upload is refused before
// a single byte crosses the wire.
const maxFileBytes = 100 * 1024 * 1024 // 100 MiB

var fileCmd = &cobra.Command{
	Use:   "file <path>",
	Short: "Upload any file (screenshot, recording, log, PDF, archive) and get a public URL",
	Long: `Upload an arbitrary file and get back a stable public URL.

Unlike 'upload' (which renders HTML/Markdown documents for browser review), 'file' stores
raw bytes and serves them as-is. Images, mp4/webm, mp3, plain text, and PDF preview in the
browser; everything else downloads. Each upload mints a fresh URL — files are not versioned.

Published files are PUBLIC to anyone holding the URL. Do not upload secrets.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		absPath, err := filepath.Abs(path)
		if err != nil {
			return err
		}
		st, err := os.Stat(absPath)
		if err != nil {
			return fmt.Errorf("stat %s: %w", path, err)
		}
		if st.IsDir() {
			return fmt.Errorf("%s is a directory; upload a file (zip it first if you need a folder)", path)
		}
		if st.Size() == 0 {
			return fmt.Errorf("%s is empty", path)
		}
		if st.Size() > maxFileBytes {
			return fmt.Errorf("%s is %d bytes; the limit is %d bytes (100 MiB)", path, st.Size(), maxFileBytes)
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

		resp, err := client.UploadFile(absPath, fileContentType, version.Version, fileIdempotency)
		if err != nil {
			return err
		}

		fmt.Printf("URL:   %s\n", resp.PublicURL)
		fmt.Printf("File:  %s\n", resp.FileID)
		fmt.Printf("Name:  %s\n", resp.Filename)
		fmt.Printf("Type:  %s\n", resp.ContentType)
		fmt.Printf("Size:  %d bytes\n", resp.FileSize)
		if resp.IdempotentReplay {
			fmt.Println("(idempotent replay — existing file returned, no new upload)")
		}
		return nil
	},
}

func init() {
	fileCmd.Flags().StringVar(&fileContentType, "content-type", "", "override the content type (MIME) sent to the server")
	fileCmd.Flags().StringVar(&fileIdempotency, "idempotency-key", "", "dedupe retries; a replay returns the same file")
	rootCmd.AddCommand(fileCmd)
}
