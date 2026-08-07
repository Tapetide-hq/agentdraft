<script lang="ts">
  let { data } = $props();
</script>

<h1>AgentDraft</h1>
<p class="muted">Publish static HTML and get a stable public URL — for AI agents, CI, and developers.</p>

<div class="card">
  <h3>Publish from the CLI</h3>
  <pre class="mono" style="overflow:auto"><code>agentdraft auth set ad_your_key
agentdraft upload plan.html --project "migration"
# → a stable public URL</code></pre>
</div>

<div class="card">
  <h3>Getting started</h3>
  <ol>
    <li>Sign in with an API key (created by the service owner).</li>
    <li>Create scoped keys for your agents on the <a href="/settings/keys">API Keys</a> page.</li>
    <li>Upload HTML via the <code>agentdraft</code> CLI or <code>POST /api/upload</code>.</li>
  </ol>
  {#if !data.authed}
    <a class="btn" href="/login">Sign in</a>
  {:else}
    <a class="btn" href="/dashboard">Go to dashboard</a>
  {/if}
</div>

<p class="muted">Every published page is treated as untrusted content. See the security model in the repository.</p>
