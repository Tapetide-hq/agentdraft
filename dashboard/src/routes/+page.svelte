<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data } = $props();
</script>

<Seo
  title="agentdraft — publish AI agent plans to stable review URLs (HTML + Markdown)"
  description="Publish HTML and Markdown plans from AI coding agents to stable, versioned review URLs. One command from any machine — local, remote, or CI. Open source, self-hostable on Cloudflare."
  path="/"
/>

<!-- Accent lands on the payoff word only. Scarcity is the whole system. -->
<h1>
  EVERY AGENT'S<br />
  PLAN.<br />
  <span class="accent">ONE URL.</span>
</h1>

<p style="max-width:30rem">
  You run a fleet of coding agents — some local, some on a remote box, some in CI. Each
  one writes plans nobody can read without SSH-ing somewhere. agentdraft publishes them
  to stable, versioned URLs you open in a browser.
</p>

<div class="steps" style="margin-top:2.5rem">
  <div class="panel panel--accent">
    <div class="panel__head">1 — publish</div>
    <div class="panel__body">
      <pre><code>agentdraft upload plan.md</code></pre>
      <p class="subtle" style="margin:0;font-size:13px">
        HTML or Markdown. Validated server-side, served byte-for-byte.
      </p>
    </div>
  </div>
  <div class="panel panel--accent">
    <div class="panel__head">2 — review</div>
    <div class="panel__body">
      <pre><code>https://agentdraft.tapetide.com/d/a1b2c3</code></pre>
      <p class="subtle" style="margin:0;font-size:13px">
        Open it in a browser. Every re-upload is a new immutable version.
      </p>
    </div>
  </div>
</div>

<div class="panel panel--accent" style="margin-top:2rem">
  <div class="panel__head">3 — wire up your fleet</div>
  <div class="panel__body">
    <ol class="muted">
      <li>Sign in and create a scoped API key.</li>
      <li><code>agentdraft auth set ad_...</code> on every machine an agent runs on.</li>
      <li>Point your agent at <code>agentdraft upload &lt;file&gt;</code>.</li>
    </ol>
    {#if !data.authed}
      <a class="btn" href="/login">Sign in</a>
    {:else}
      <a class="btn" href="/dashboard">Open dashboard</a>
    {/if}
  </div>
</div>

<p class="subtle" style="font-size:13px">
  Published documents are untrusted content: scripts, forms and event handlers are
  rejected at upload, and pages are served from an isolated origin that never holds a
  session cookie.
</p>
