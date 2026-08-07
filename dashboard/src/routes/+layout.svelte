<script lang="ts">
  import "$lib/styles.css";
  import { page } from "$app/state";
  let { children, data } = $props();
  const path = $derived(page.url.pathname);
</script>

<nav class="nav">
  <a class="brand" href="/" style="color:var(--text)">AgentDraft</a>
  {#if data.authed}
    <a href="/dashboard" class:active={path === "/dashboard"}>Drafts</a>
    <a href="/projects" class:active={path.startsWith("/projects")}>Projects</a>
    <a href="/settings/keys" class:active={path.startsWith("/settings")}>API Keys</a>
    <span class="spacer"></span>
    <form method="POST" action="/logout">
      <button class="btn secondary" type="submit">Sign out</button>
    </form>
  {:else}
    <span class="spacer"></span>
    <a href="/login" class:active={path === "/login"}>Sign in</a>
  {/if}
</nav>

<main class="container">
  {@render children()}
</main>
