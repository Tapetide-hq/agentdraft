<script lang="ts">
  let { data } = $props();
</script>

<h1>Drafts</h1>
<p class="muted">Signed in as {data.accountName}.</p>

{#if data.drafts.length === 0}
  <div class="card">
    <p>No drafts yet. Upload one with the CLI:</p>
    <pre class="mono"><code>webhost upload plan.html</code></pre>
  </div>
{:else}
  <div class="card">
    <table>
      <thead>
        <tr><th>Title</th><th>Version</th><th>Updated</th><th>Links</th></tr>
      </thead>
      <tbody>
        {#each data.drafts as d}
          <tr>
            <td><a href={`/drafts/${d.id}`}>{d.title || "Untitled"}</a></td>
            <td><span class="pill">v{d.published_version ?? 1}</span></td>
            <td class="muted">{new Date(d.updated_at + "Z").toLocaleString()}</td>
            <td><a href={d.public_url} target="_blank" rel="noopener">open ↗</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
