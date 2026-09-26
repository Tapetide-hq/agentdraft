// Package version reports the CLI version.
package version

import "runtime/debug"

// devVersion is what an untagged `go build` reports.
const devVersion = "0.1.0-dev"

// Version is overridden at build time via -ldflags "-X .../version.Version=x".
// goreleaser sets it for release archives. For `go install .../cli@vX.Y.Z` there are no
// ldflags, so init() falls back to the module version Go embedded in the binary; that is
// why every release also carries a cli/vX.Y.Z tag.
var Version = devVersion

func init() {
	if Version != devVersion {
		return
	}
	if bi, ok := debug.ReadBuildInfo(); ok {
		Version = fromBuildInfo(bi.Main.Version, Version)
	}
}

// fromBuildInfo turns the module version Go embeds into a binary into our version
// string: "v0.3.0" -> "0.3.0". "(devel)" and empty mean "not a tagged module build",
// so the fallback is returned unchanged.
func fromBuildInfo(modVersion, fallback string) string {
	if modVersion == "" || modVersion == "(devel)" {
		return fallback
	}
	if modVersion[0] == 'v' {
		return modVersion[1:]
	}
	return modVersion
}
