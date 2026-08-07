package version

// Version is overridden at build time via -ldflags "-X .../version.Version=x".
var Version = "0.1.0-dev"
