<script lang="ts">
  // Shared dark footer. Carries the open-source + Tapetide attribution on every page.
  import Logo from "$lib/Logo.svelte";
  let { authed = false }: { authed?: boolean } = $props();
  const year = new Date().getFullYear();
  const GH = "https://github.com/Tapetide-hq/agentdraft";
</script>

<footer class="footer band band--footer">
  <div class="container">
    <div class="footer__grid">
      <div>
        <a class="brand" href="/">
          <Logo size={26} />
          <span>agentdraft</span>
        </a>
        <p class="footer__tagline">
          Publish AI-agent plans to stable, versioned review URLs. HTML and Markdown, one
          command, from any machine.
        </p>
      </div>

      <div>
        <h4>Product</h4>
        <ul>
          {#if authed}
            <li><a href="/dashboard">Drafts</a></li>
            <li><a href="/files">Files</a></li>
            <li><a href="/projects">Projects</a></li>
            <li><a href="/settings/keys">API keys</a></li>
            <li><a href="/settings/privacy">Privacy</a></li>
          {:else}
            <li><a href="/">Overview</a></li>
            <li><a href="/#how">How it works</a></li>
            <li><a href="/#faq">FAQ</a></li>
            <li><a href="/login">Sign in</a></li>
          {/if}
        </ul>
      </div>

      <div>
        <h4>Developers</h4>
        <ul>
          <li><a href="{GH}/blob/main/docs/cli.md" target="_blank" rel="noopener">CLI reference</a></li>
          <li><a href="{GH}/blob/main/docs/api.md" target="_blank" rel="noopener">API reference</a></li>
          <li><a href="{GH}/blob/main/docs/self-hosting.md" target="_blank" rel="noopener">Self-hosting</a></li>
          <li><a href="{GH}/tree/main/skills" target="_blank" rel="noopener">Agent skills</a></li>
        </ul>
      </div>

      <div>
        <h4>Project</h4>
        <ul>
          <li><a href={GH} target="_blank" rel="noopener">GitHub</a></li>
          <li><a href="{GH}/blob/main/SECURITY.md" target="_blank" rel="noopener">Security model</a></li>
          <li><a href="{GH}/blob/main/LICENSE" target="_blank" rel="noopener">MIT license</a></li>
          <li><a href="https://tapetide.com/" target="_blank" rel="noopener">Tapetide</a></li>
        </ul>
      </div>
    </div>

    <div class="footer__bottom">
      <span>
        &copy; {year} agentdraft. Open source by
        <a href="https://tapetide.com/" target="_blank" rel="noopener">Tapetide</a>.
      </span>
      <span>Published documents are untrusted content and are served from an isolated origin.</span>
    </div>
  </div>
</footer>
