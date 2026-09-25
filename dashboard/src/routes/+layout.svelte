<script lang="ts">
  import "$lib/styles.css";
  import { page } from "$app/state";
  import Footer from "$lib/Footer.svelte";
  import Logo from "$lib/Logo.svelte";
  let { children, data } = $props();
  const path = $derived(page.url.pathname);
  // The landing page opens on a dark hero, so its nav floats over that band in white.
  // Every other screen is an app page on a white canvas with a sticky light nav.
  const onLanding = $derived(path === "/");

  const appLinks = $derived([
    { href: "/dashboard", text: "Drafts", active: path === "/dashboard" || path.startsWith("/drafts") },
    { href: "/files", text: "Files", active: path.startsWith("/files") },
    { href: "/projects", text: "Projects", active: path.startsWith("/projects") },
    { href: "/settings/keys", text: "Keys", active: path.startsWith("/settings/keys") },
    { href: "/settings/privacy", text: "Privacy", active: path.startsWith("/settings/privacy") },
  ]);
  const publicLinks = [
    { href: "/#how", text: "How it works", external: false },
    { href: "/#faq", text: "FAQ", external: false },
    { href: "https://github.com/Tapetide-hq/agentdraft/blob/main/docs/cli.md", text: "Docs", external: true },
  ];
</script>

<nav class="nav" class:nav--dark={onLanding} class:nav--light={!onLanding}>
  <div class="container nav__inner">
    <a class="brand" href="/">
      <Logo size={28} />
      <span>agentdraft</span>
    </a>

    {#if data.authed}
      <div class="nav__links">
        {#each appLinks as l (l.href)}
          <a href={l.href} class:active={l.active}>{l.text}</a>
        {/each}
      </div>
      <span class="spacer"></span>
      <div class="nav__cta">
        {#if onLanding}
          <!-- Hidden on phones: the hero carries the same action and the bar would overflow. -->
          <a class="btn btn--light nav__cta--wide" href="/dashboard">Open dashboard</a>
        {/if}
        <form method="POST" action="/logout">
          <button class="btn btn--outline btn--sm" type="submit">Sign out</button>
        </form>
        <!-- Phone menu: the horizontal links are hidden below 640px, so every app page
             stays reachable from here. -->
        <details class="nav__menu">
          <summary aria-label="Open navigation menu">Menu</summary>
          <div class="nav__menu__panel">
            {#each appLinks as l (l.href)}
              <a href={l.href} class:active={l.active}>{l.text}</a>
            {/each}
          </div>
        </details>
      </div>
    {:else}
      <div class="nav__links">
        {#each publicLinks as l (l.href)}
          <a href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noopener" : undefined}>{l.text}</a>
        {/each}
      </div>
      <span class="spacer"></span>
      <div class="nav__cta">
        <a class="btn" class:btn--light={onLanding} href="/login">Sign in</a>
        <details class="nav__menu">
          <summary aria-label="Open navigation menu">Menu</summary>
          <div class="nav__menu__panel">
            {#each publicLinks as l (l.href)}
              <a href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noopener" : undefined}>{l.text}</a>
            {/each}
          </div>
        </details>
      </div>
    {/if}
  </div>
</nav>

<main>
  {@render children()}
</main>

<Footer authed={data.authed} />
