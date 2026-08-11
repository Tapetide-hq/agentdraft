<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data, form } = $props();

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<Seo title="Files — agentdraft" description="Your uploaded files." path="/files" noindex />

<h1>FILES<span class="accent">.</span></h1>
<p class="subtle">Signed in as {data.accountName}.</p>

{#if form?.message}<p class="error">{form.message}</p>{/if}

{#if data.files.length === 0}
  <div class="panel panel--accent" style="max-width:34rem">
    <div class="panel__head">no files yet</div>
    <div class="panel__body">
      <p>Upload any file from any machine an agent runs on:</p>
      <pre><code>agentdraft file screenshot.png</code></pre>
      <p class="subtle" style="margin:.8rem 0 0;font-size:13px">
        Images, MP4, and PDF open in the browser; everything else downloads. Files are
        public to anyone holding the URL — never upload secrets.
      </p>
    </div>
  </div>
{:else}
  <div class="card">
    <table>
      <thead>
        <tr><th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Status</th><th>Link</th><th></th></tr>
      </thead>
      <tbody>
        {#each data.files as f}
          <tr>
            <td>{f.filename}</td>
            <td class="subtle">{f.content_type}</td>
            <td class="subtle">{fmtSize(f.file_size)}</td>
            <td class="subtle">{new Date(f.created_at + "Z").toLocaleString()}</td>
            <td>
              {#if f.disabled_at}
                <span class="pill pill--danger">disabled</span>
              {:else}
                <span class="pill pill--ok">active</span>
              {/if}
            </td>
            <td>
              {#if f.disabled_at}
                <span class="subtle">&mdash;</span>
              {:else}
                <a href={f.public_url} target="_blank" rel="noopener">open &rarr;</a>
              {/if}
            </td>
            <td>
              {#if !f.disabled_at}
                <form
                  method="POST"
                  action="?/disable"
                  onsubmit={(e) => {
                    if (!confirm(`Disable "${f.filename}"? The URL stops serving immediately.`))
                      e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={f.id} />
                  <button class="btn btn--danger" type="submit">Disable</button>
                </form>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
