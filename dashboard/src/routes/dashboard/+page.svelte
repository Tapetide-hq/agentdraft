<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>Drafts — agentdraft</title></svelte:head>

<h1>DRAFTS<span class="accent">.</span></h1>
<p class="subtle">Signed in as {data.accountName}.</p>

{#if data.drafts.length === 0}
  <div class="panel panel--accent" style="max-width:34rem">
    <div class="panel__head">no drafts yet</div>
    <div class="panel__body">
      <p>Publish one from any machine an agent runs on:</p>
      <pre><code>agentdraft upload plan.md</code></pre>
    </div>
  </div>
{:else}
  <div class="card">
    <table>
      <thead>
        <tr><th>Title</th><th>Fmt</th><th>Ver</th><th>Updated</th><th>Link</th></tr>
      </thead>
      <tbody>
        {#each data.drafts as d}
          <tr>
            <td><a href={`/drafts/${d.id}`}>{d.title || "Untitled"}</a></td>
            <td><span class="pill">{d.source_format ?? "html"}</span></td>
            <td><span class="pill pill--accent">v{d.published_version ?? 1}</span></td>
            <td class="subtle">{new Date(d.updated_at + "Z").toLocaleString()}</td>
            <td><a href={d.public_url} target="_blank" rel="noopener">open &rarr;</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
