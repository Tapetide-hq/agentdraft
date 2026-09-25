<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  import { fmtDate, fmtSize } from "$lib/format";
  let { data, form } = $props();

  const active = $derived(data.files.filter((f) => !f.disabled_at).length);
</script>

<Seo title="Files — agentdraft" description="Your uploaded files." path="/files" noindex />

<div class="page">
  <div class="container">
    <div class="page-head">
      <div>
        <h1>Files</h1>
        <p>Signed in as {data.accountName}. Screenshots, PDFs, videos, anything an agent produces.</p>
      </div>
      {#if data.files.length > 0}
        <div class="page-head__actions">
          <span class="pill pill--ok">{active} active</span>
          {#if data.files.length - active > 0}
            <span class="pill pill--danger">{data.files.length - active} disabled</span>
          {/if}
        </div>
      {/if}
    </div>

    {#if form?.message}<p class="notice notice--error">{form.message}</p>{/if}

    {#if data.files.length === 0}
      <div class="card card--mint empty">
        <h3>No files yet</h3>
        <p>
          Upload any file from any machine an agent runs on. Images, MP4 and PDF open in the
          browser; everything else downloads. Files are public to anyone holding the URL, so
          never upload secrets.
        </p>
        <div class="term">
          <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
          <pre><code><span class="prompt">$</span> agentdraft file screenshot.png</code></pre>
        </div>
      </div>
    {:else}
      <div class="card card--flush">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each data.files as f (f.id)}
                <tr>
                  <td>
                    <span style="font-weight:500">{f.filename}</span>
                    <div class="small subtle mono">{f.id}</div>
                  </td>
                  <td class="subtle">{f.content_type}</td>
                  <td class="subtle num">{fmtSize(f.file_size)}</td>
                  <td class="subtle num">{fmtDate(f.created_at)}</td>
                  <td>
                    {#if f.disabled_at}
                      <span class="pill pill--danger">disabled</span>
                    {:else}
                      <span class="pill pill--ok">active</span>
                    {/if}
                  </td>
                  <td style="text-align:right">
                    {#if !f.disabled_at}
                      <div class="row" style="justify-content:flex-end">
                        <a class="btn btn--outline btn--sm" href={f.public_url} target="_blank" rel="noopener">
                          Open <span class="arrow">&rarr;</span>
                        </a>
                        <form
                          method="POST"
                          action="?/disable"
                          onsubmit={(e) => {
                            if (!confirm(`Disable "${f.filename}"? The URL stops serving immediately.`))
                              e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="id" value={f.id} />
                          <button class="btn btn--danger btn--sm" type="submit">Disable</button>
                        </form>
                      </div>
                    {:else}
                      <span class="subtle">&mdash;</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</div>
