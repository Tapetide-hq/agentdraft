<script lang="ts">
  // The agentdraft mark, inline as SVG rather than an <img> to the favicon.
  //
  // WHY INLINE: an <img src="/favicon.svg"> costs a second request and cannot inherit
  // CSS custom properties. Inline SVG lets the accent bar use var(--accent), so the mark
  // tracks a palette change instead of silently drifting from it.
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
  <!-- Tile sits one step ABOVE --bg. A tile filled with --bg on a --bg nav is invisible,
       which made the mark read as bare floating bars rather than a badge. -->
  <rect width="32" height="32" rx="7" fill="#141414" />
  <!-- Edge must survive downscaling: the viewBox is 32 units rendered at ~22px, so a
       1-unit stroke lands on ~0.7px and disappears. 1.5 units + a light stroke keeps the
       badge shape legible; --border (#2a2a2a) on #0a0a0a was too dark to resolve at all. -->
  <rect
    x="0.75"
    y="0.75"
    width="30.5"
    height="30.5"
    rx="6.4"
    fill="none"
    stroke="rgba(255, 255, 255, 0.26)"
    stroke-width="1.5"
  />
  <g fill="var(--fg)">
    <rect x="6" y="6" width="20" height="4" />
    <rect x="6" y="14" width="20" height="4" />
  </g>
  <rect x="6" y="22" width="10" height="4" fill="var(--accent)" />
</svg>

<style>
  .logo {
    display: block;
    flex: none; /* never let flex squash the mark into an ellipse */
  }
</style>
