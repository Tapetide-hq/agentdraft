<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  import { fmtDate } from "$lib/format";
  let { data } = $props();

  // Fail CLOSED: a draft is shown as public only when the API says so explicitly. If the
  // field were ever missing, a truly private draft must not be labelled readable-by-anyone.
  const publicCount = $derived(data.drafts.filter((d) => d.is_public === 1).length);
  const privateCount = $derived(data.drafts.length - publicCount);
  const mdCount = $derived(data.drafts.filter((d) => d.source_format === "md").length);
</script>

<Seo title="Drafts — agentdraft" description="Your published agent drafts." path="/dashboard" noindex />

<div class="page">
  <div class="container">
    <div class="page-head">
      <div>
        <h1>Drafts</h1>
        <p>Signed in as {data.accountName}. Every upload from every machine lands here.</p>
      </div>
      <div class="page-head__actions">
        <a class="btn btn--outline btn--sm" href="/settings/keys">New machine key</a>
      </div>
    </div>

    {#if data.drafts.length === 0}
      <div class="card card--mint empty">
        <h3>No drafts yet</h3>
        <p>Publish one from any machine an agent runs on. The URL comes back in the terminal.</p>
        <div class="term">
          <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
          <pre><code><span class="prompt">$</span> agentdraft upload plan.md</code></pre>
        </div>
      </div>
    {:else}
      <div class="grid grid--tight">
        <div class="stat">
          <div class="stat__label">Drafts</div>
          <div class="stat__value">{data.drafts.length}</div>
          <div class="stat__foot">{mdCount} markdown · {data.drafts.length - mdCount} html</div>
        </div>
        <div class="stat">
          <div class="stat__label">Public by link</div>
          <div class="stat__value">{publicCount}</div>
          <div class="stat__foot">readable without signing in</div>
        </div>
        <div class="stat">
          <div class="stat__label">Private</div>
          <div class="stat__value">{privateCount}</div>
          <div class="stat__foot">visible only to you</div>
        </div>
      </div>

      <div class="card card--flush">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Format</th>
                <th>Version</th>
                <th>Visibility</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each data.drafts as d (d.id)}
                <tr>
                  <td>
                    <a href={`/drafts/${d.id}`}>{d.title || "Untitled"}</a>
                    <div class="small subtle mono">{d.id}</div>
                  </td>
                  <td><span class="pill">{d.source_format ?? "html"}</span></td>
                  <td><span class="pill pill--dark">v{d.published_version ?? 1}</span></td>
                  <td>
                    {#if d.is_public === 1}
                      <span class="pill pill--ok">public</span>
                    {:else}
                      <span class="pill pill--outline">private</span>
                    {/if}
                  </td>
                  <td class="subtle num">{fmtDate(d.updated_at)}</td>
                  <td style="text-align:right">
                    <a class="btn btn--outline btn--sm" href={d.public_url} target="_blank" rel="noopener">
                      Open <span class="arrow">&rarr;</span>
                    </a>
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
