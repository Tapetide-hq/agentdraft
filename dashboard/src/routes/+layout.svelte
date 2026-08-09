<script lang="ts">
  import "$lib/styles.css";
  import { page } from "$app/state";
  import Footer from "$lib/Footer.svelte";
  import Logo from "$lib/Logo.svelte";
  let { children, data } = $props();
  const path = $derived(page.url.pathname);
</script>

<!-- Hazard marquee: the WIP ticker is part of the aesthetic, not a disclaimer bolted
     on. Duplicated content is required so the -50% translate loops seamlessly. -->
<div class="marquee" aria-hidden="true">
  <span class="marquee__track">
    EARLY BUILD · AGENT DRAFTS · HTML + MARKDOWN · IMMUTABLE VERSIONS · UNTRUSTED CONTENT ·
    EARLY BUILD · AGENT DRAFTS · HTML + MARKDOWN · IMMUTABLE VERSIONS · UNTRUSTED CONTENT ·
  </span>
</div>

<nav class="nav">
  <div class="nav__inner">
    <a class="brand" href="/">
      <Logo size={22} />
      <span class="brand__word">agent<span>draft</span></span>
    </a>
    {#if data.authed}
      <a href="/dashboard" class:active={path === "/dashboard"}>Drafts</a>
      <a href="/projects" class:active={path.startsWith("/projects")}>Projects</a>
      <a href="/settings/keys" class:active={path.startsWith("/settings/keys")}>Keys</a>
      <a href="/settings/privacy" class:active={path.startsWith("/settings/privacy")}>Privacy</a>
      <span class="spacer"></span>
      <form method="POST" action="/logout">
        <button class="btn btn--ghost" type="submit">Sign out</button>
      </form>
    {:else}
      <span class="spacer"></span>
      <a href="/login" class:active={path === "/login"}>Sign in</a>
    {/if}
  </div>
</nav>

<main class="container">
  {@render children()}
</main>

<Footer />
