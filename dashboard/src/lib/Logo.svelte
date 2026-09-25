<script lang="ts">
  // The agentdraft mark, inline as SVG rather than an <img> to the favicon.
  //
  // WHY INLINE: an <img src="/favicon.svg"> costs a second request and cannot inherit
  // CSS custom properties. Inline SVG lets the tile and bars follow the palette.
  //
  // ACCESSIBILITY: decorative BY DEFAULT. The mark almost always sits beside the
  // "agentdraft" wordmark, and labelling both made the nav link announce
  // "agentdraft agentdraft" to a screen reader — verified in the accessibility tree.
  // Pass `label` only when the mark stands alone with no adjacent text.
  //
  // Geometry is IDENTICAL to dashboard/static/favicon.svg (32-unit viewBox, even bar
  // heights and gaps). Change one and you must change both; scripts/verify_icons.py
  // asserts the static assets stay consistent.
  let {
    size = 22,
    label = "",
  }: { size?: number; label?: string } = $props();
</script>

<svg
  class="logo"
  width={size}
  height={size}
  viewBox="0 0 32 32"
  role={label ? "img" : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : "true"}
  focusable="false"
>
  <!-- Near-black tile on white. Dark surfaces (.band, .nav--dark) set --logo-tile to the
       lighter --band-2 so the badge keeps a visible edge instead of dissolving into the
       band; the faint stroke covers the rest. -->
  <rect width="32" height="32" rx="8" fill="var(--logo-tile, var(--band))" />
  <rect
    x="0.75"
    y="0.75"
    width="30.5"
    height="30.5"
    rx="7.4"
    fill="none"
    stroke="rgba(255, 255, 255, 0.22)"
    stroke-width="1.5"
  />
  <g fill="#ffffff">
    <rect x="6" y="6" width="20" height="4" rx="1" />
    <rect x="6" y="14" width="20" height="4" rx="1" />
  </g>
  <!-- The short bar is the "signal" green, the one place the brand uses colour. -->
  <rect x="6" y="22" width="10" height="4" rx="1" fill="var(--green)" />
</svg>

<style>
  .logo {
    display: block;
    flex: none; /* never let flex squash the mark into an ellipse */
  }
</style>
