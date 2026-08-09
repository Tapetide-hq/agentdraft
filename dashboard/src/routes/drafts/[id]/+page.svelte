<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data } = $props();
  // $derived: navigating from one draft to another reuses this component, so a plain
  // `const draft = data.draft` would keep showing the PREVIOUS draft's title and id.
  const draft = $derived(data.draft);
  // `selected` starts unset and is seeded by the effect below, so no prop is read at
  // initialisation (which would freeze it at first-render's value). The effect also
  // re-points the selector when navigating from one draft to another.
  let selected = $state<number | null>(null);
  $effect(() => {
    selected = data.draft.published_version ?? 1;
  });
  const activeVersion = $derived(selected ?? draft.published_version ?? 1);
  const isMd = $derived(
    (data.versions.find((v) => v.version_number === activeVersion)?.source_format ?? "html") ===
      "md",
  );
  // Preview the selected version from the CONTENT origin in a sandboxed iframe.
  const previewSrc = $derived(`${data.contentBase}/d/${draft.id}/v/${activeVersion}`);
  const rawSrc = $derived(`${data.contentBase}/d/${draft.id}/v/${activeVersion}/raw`);

  // Read visibility from the SERVER value on every render, never from local state: the
  // draft may have been flipped from the CLI or another tab since this page loaded.
  const isPublic = $derived(draft.is_public !== 0);
</script>

<Seo title={`${draft.title || "Untitled"} — agentdraft`} description="Draft version history and preview." path={`/drafts/${draft.id}`} noindex />

<div class="row" style="justify-content:space-between;align-items:flex-end">
  <h1 style="margin-bottom:0">{draft.title || "UNTITLED"}</h1>
  <a class="btn btn--ghost" href={draft.public_url} target="_blank" rel="noopener">
    Open latest &rarr;
  </a>
</div>
<p class="mono subtle">
  {draft.id}{#if draft.description} — {draft.description}{/if}
</p>

<!-- VISIBILITY. Placed directly under the title because it changes who can read the
     document, which is the single most consequential property on this page. -->
<div class="panel" style="margin-bottom:1.25rem">
  <div class="panel__head">visibility — {isPublic ? "public" : "private"}</div>
  <div class="panel__body">
    <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
      <p class="subtle" style="margin:0;max-width:34rem;font-size:13px">
        {#if isPublic}
          Anyone with the link can read this draft. The link works without signing in.
        {:else}
          Only you can read this draft. The link is unchanged — anyone else who opens it
          gets a sign-in page.
        {/if}
      </p>
      <form method="POST" action="?/visibility">
        <!-- The DESIRED state is submitted, not a toggle: a toggle derived from stale
             page data flips the wrong way if the value changed elsewhere meanwhile. -->
        <input type="hidden" name="public" value={isPublic ? "false" : "true"} />
        <button class="btn btn--ghost" type="submit">
          {isPublic ? "Make private" : "Make public"}
        </button>
      </form>
    </div>
  </div>
</div>

<div class="panel panel--accent">
  <div class="panel__head">preview — v{activeVersion}{isMd ? " (rendered markdown)" : ""}</div>
  <div class="panel__body">
    <div class="row" style="margin-bottom:.9rem;flex-wrap:wrap">
      <label for="ver" style="margin:0">Version</label>
      <select id="ver" bind:value={selected} style="width:auto">
        {#each data.versions as v}
          <option value={v.version_number}>
            v{v.version_number} — {new Date(v.created_at + "Z").toLocaleString()}
          </option>
        {/each}
      </select>
      <a href={rawSrc} target="_blank" rel="noopener">view raw source &rarr;</a>
    </div>
    <!-- Served from a SEPARATE origin and sandboxed: no scripts, no same-origin access
         to this dashboard. Defense in depth over the content-origin CSP. -->
    <iframe class="preview-frame" title="draft preview" src={previewSrc} sandbox=""></iframe>
  </div>
</div>

<div class="card">
  <h3>Version history</h3>
  <table>
    <thead>
      <tr><th>Ver</th><th>Fmt</th><th>Size</th><th>Hash</th><th>Git</th><th>Created</th></tr>
    </thead>
    <tbody>
      {#each data.versions as v}
        <tr>
          <td><span class="pill pill--accent">v{v.version_number}</span></td>
          <td><span class="pill">{v.source_format ?? "html"}</span></td>
          <td class="subtle">{(v.file_size / 1024).toFixed(1)} KB</td>
          <td class="mono subtle" title={v.content_hash}>{v.content_hash.slice(0, 10)}&hellip;</td>
          <td class="mono subtle">
            {#if v.git_branch}
              {v.git_branch}{#if v.git_commit_sha}@{v.git_commit_sha.slice(0, 7)}{/if}{#if v.git_dirty}*{/if}
            {:else}—{/if}
          </td>
          <td class="subtle">{new Date(v.created_at + "Z").toLocaleString()}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<form
  method="POST"
  action="?/delete"
  onsubmit={(e) => {
    if (!confirm("Delete this draft? Its public URL stops working immediately.")) e.preventDefault();
  }}
>
  <button class="btn btn--danger" type="submit">Delete draft</button>
</form>
