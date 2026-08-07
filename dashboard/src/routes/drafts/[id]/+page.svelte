<script lang="ts">
  let { data } = $props();
  const draft = data.draft;
  let selected = $state<number>(draft.published_version ?? 1);
  // Preview the selected version from the CONTENT origin in a sandboxed iframe.
  const previewSrc = $derived(
    `${data.contentBase}/d/${draft.id}/v/${selected}`,
  );
</script>

<div class="row" style="justify-content:space-between">
  <h1 style="margin-bottom:0">{draft.title || "Untitled"}</h1>
  <a class="btn secondary" href={draft.public_url} target="_blank" rel="noopener">Open latest ↗</a>
</div>
<p class="muted mono">{draft.id}{#if draft.description} — {draft.description}{/if}</p>

<div class="card">
  <div class="row" style="justify-content:space-between">
    <h3 style="margin:0">Preview — v{selected}</h3>
    <label style="margin:0" for="ver">Version</label>
  </div>
  <select id="ver" bind:value={selected} style="width:auto;margin:0.5rem 0;background:var(--panel-2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:0.4rem">
    {#each data.versions as v}
      <option value={v.version_number}>v{v.version_number} — {new Date(v.created_at + "Z").toLocaleString()}</option>
    {/each}
  </select>
  <!-- The preview is served from a SEPARATE origin and sandboxed: no scripts, no
       same-origin access to this dashboard. Defense in depth over the content CSP. -->
  <iframe class="preview-frame" title="draft preview" src={previewSrc} sandbox=""></iframe>
</div>

<div class="card">
  <h3>Version history</h3>
  <table>
    <thead><tr><th>Ver</th><th>Size</th><th>Hash</th><th>Git</th><th>Created</th></tr></thead>
    <tbody>
      {#each data.versions as v}
        <tr>
          <td><span class="pill">v{v.version_number}</span></td>
          <td class="muted">{(v.file_size / 1024).toFixed(1)} KB</td>
          <td class="mono muted" title={v.content_hash}>{v.content_hash.slice(0, 10)}…</td>
          <td class="mono muted">
            {#if v.git_branch}{v.git_branch}{#if v.git_commit_sha}@{v.git_commit_sha.slice(0, 7)}{/if}{#if v.git_dirty}*{/if}{:else}—{/if}
          </td>
          <td class="muted">{new Date(v.created_at + "Z").toLocaleString()}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<form method="POST" action="?/delete" onsubmit={(e) => { if (!confirm("Delete this draft?")) e.preventDefault(); }}>
  <button class="btn danger" type="submit">Delete draft</button>
</form>
