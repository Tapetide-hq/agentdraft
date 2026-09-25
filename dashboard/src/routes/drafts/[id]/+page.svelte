<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  import { fmtDate } from "$lib/format";
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
  const active = $derived(data.versions.find((v) => v.version_number === activeVersion));
  const isMd = $derived((active?.source_format ?? "html") === "md");
  // Preview the selected version from the CONTENT origin in a sandboxed iframe.
  const previewSrc = $derived(`${data.contentBase}/d/${draft.id}/v/${activeVersion}`);
  const rawSrc = $derived(`${data.contentBase}/d/${draft.id}/v/${activeVersion}/raw`);

  // Read visibility from the SERVER value on every render, never from local state: the
  // draft may have been flipped from the CLI or another tab since this page loaded.
  // Fails CLOSED: only an explicit 1 renders the "anyone with the link" state.
  const isPublic = $derived(draft.is_public === 1);
</script>

<Seo title={`${draft.title || "Untitled"} — agentdraft`} description="Draft version history and preview." path={`/drafts/${draft.id}`} noindex />

<div class="page">
  <div class="container">
    <p style="margin-bottom:1rem"><a class="back" href="/dashboard">&larr; All drafts</a></p>

    <div class="page-head">
      <div>
        <h1>{draft.title || "Untitled"}</h1>
        <div class="row row--wrap" style="gap:.5rem;margin-top:.5rem">
          <span class="pill pill--dark">v{draft.published_version ?? 1}</span>
          <span class="pill">{isMd ? "markdown" : "html"}</span>
          {#if isPublic}
            <span class="pill pill--ok">public</span>
          {:else}
            <span class="pill pill--outline">private</span>
          {/if}
          <span class="pill pill--outline mono">{draft.id}</span>
        </div>
        {#if draft.description}<p style="margin-top:.75rem">{draft.description}</p>{/if}
      </div>
      <div class="page-head__actions">
        <a class="btn" href={draft.public_url} target="_blank" rel="noopener">
          Open latest <span class="arrow">&rarr;</span>
        </a>
      </div>
    </div>

    <!-- VISIBILITY. First card because it changes who can read the document, the single
         most consequential property on this page. -->
    <div class="card" class:card--mint={!isPublic}>
      <div class="row row--between row--wrap" style="gap:1rem">
        <div>
          <h3 style="margin-bottom:.25rem">{isPublic ? "This draft is public" : "This draft is private"}</h3>
          <p style="margin:0;max-width:36rem">
            {#if isPublic}
              Anyone who has the link can open this draft without signing in.
            {:else}
              Only you can open this draft. The link stays the same; anyone else who follows
              it is asked to sign in.
            {/if}
          </p>
        </div>
        <form method="POST" action="?/visibility">
          <!-- The DESIRED state is submitted, not a toggle: a toggle derived from stale
               page data flips the wrong way if the value changed elsewhere meanwhile. -->
          <input type="hidden" name="public" value={isPublic ? "false" : "true"} />
          <button class="btn btn--outline" type="submit">
            {isPublic ? "Make private" : "Make public"}
          </button>
        </form>
      </div>
    </div>

    <!-- PREVIEW -->
    <div class="card card--flush">
      <div class="card__head">
        <div class="row row--wrap">
          <label for="ver" style="margin:0">Version</label>
          <select id="ver" bind:value={selected} style="width:auto;padding-top:9px;padding-bottom:9px">
            {#each data.versions as v (v.id)}
              <option value={v.version_number}>v{v.version_number} — {fmtDate(v.created_at)}</option>
            {/each}
          </select>
          {#if isMd}<span class="pill">Markdown, rendered</span>{/if}
        </div>
        <a class="btn btn--outline btn--sm" href={rawSrc} target="_blank" rel="noopener">View original file</a>
      </div>
      <div class="card__body" style="padding:1rem">
        <!-- Served from a SEPARATE origin and sandboxed: no scripts, no same-origin access
             to this dashboard. Defense in depth over the content-origin CSP. -->
        <iframe class="preview-frame" title="draft preview" src={previewSrc} sandbox=""></iframe>
      </div>
    </div>

    <!-- HISTORY -->
    <div class="card card--flush">
      <div class="card__head">
        <h3>Version history</h3>
        <span class="subtle small">{data.versions.length} {data.versions.length === 1 ? "version" : "versions"}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Version</th><th>Format</th><th>Size</th><th>Checksum</th><th>Git branch</th><th>Published</th></tr>
          </thead>
          <tbody>
            {#each data.versions as v (v.id)}
              <tr>
                <td>
                  {#if v.version_number === activeVersion}
                    <span class="pill pill--dark">v{v.version_number}</span>
                  {:else}
                    <button class="pill" type="button" style="border:0;cursor:pointer" onclick={() => (selected = v.version_number)}>v{v.version_number}</button>
                  {/if}
                </td>
                <td><span class="pill pill--outline">{v.source_format ?? "html"}</span></td>
                <td class="subtle num">{(v.file_size / 1024).toFixed(1)} KB</td>
                <td class="mono subtle" title={v.content_hash}>{v.content_hash.slice(0, 10)}&hellip;</td>
                <td class="mono subtle">
                  {#if v.git_branch}
                    {v.git_branch}{#if v.git_commit_sha}@{v.git_commit_sha.slice(0, 7)}{/if}{#if v.git_dirty}*{/if}
                  {:else}&mdash;{/if}
                </td>
                <td class="subtle num">{fmtDate(v.created_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- DANGER -->
    <div class="card" style="border-color:var(--red-soft)">
      <div class="row row--between row--wrap" style="gap:1rem">
        <div>
          <h3 style="margin-bottom:.25rem">Delete this draft</h3>
          <p style="margin:0">The link and every version of this draft stop working right away. This cannot be undone.</p>
        </div>
        <form
          method="POST"
          action="?/delete"
          onsubmit={(e) => {
            if (!confirm("Delete this draft? Its link and every version stop working right away, and this cannot be undone.")) e.preventDefault();
          }}
        >
          <button class="btn btn--danger" type="submit">Delete draft</button>
        </form>
      </div>
    </div>
  </div>
</div>
