<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data, form } = $props();

  // Read from the server value each render. After an action SvelteKit re-runs `load`, so
  // this reflects the authoritative state rather than what we optimistically sent.
  const defaultPublic = $derived(data.defaultPublic);
  const total = $derived(data.publicCount + data.privateCount);
</script>

<Seo title="Privacy — agentdraft" description="Draft visibility settings." path="/settings/privacy" noindex />

<h1>PRIVACY<span class="accent">.</span></h1>

{#if form?.message}
  <p class="error">{form.message}</p>
{/if}

<!-- DEFAULT FOR NEW DRAFTS -->
<div class="panel panel--accent">
  <div class="panel__head">new drafts — {defaultPublic ? "public" : "private"}</div>
  <div class="panel__body">
    <p class="subtle" style="margin-top:0;max-width:38rem;font-size:13px">
      {#if defaultPublic}
        Drafts you publish are readable by anyone with the link. Agents publishing from CI
        will produce public URLs.
      {:else}
        Drafts you publish are readable only by you. The link still works for you — anyone
        else who opens it gets a sign-in page.
      {/if}
    </p>
    <p class="subtle" style="max-width:38rem;font-size:13px">
      This applies to <strong>new drafts only</strong>. Your existing
      {total === 1 ? "draft" : "drafts"} are not affected.
    </p>
    <form method="POST" action="?/setdefault">
      <input type="hidden" name="public" value={defaultPublic ? "false" : "true"} />
      <button class="btn" type="submit">
        {defaultPublic ? "Make new drafts private" : "Make new drafts public"}
      </button>
    </form>
    {#if form?.defaultChanged}
      <p class="subtle" style="margin-bottom:0;font-size:13px">
        Saved. New drafts will be {form.nowPublic ? "public" : "private"}.
      </p>
    {/if}
  </div>
</div>

<!-- EXISTING DRAFTS -->
<div class="card">
  <h3>Existing drafts</h3>
  <p class="subtle" style="max-width:38rem;font-size:13px">
    You have <strong>{data.publicCount}</strong> public and
    <strong>{data.privateCount}</strong> private
    {total === 1 ? "draft" : "drafts"}.
  </p>
  <p class="subtle" style="max-width:38rem;font-size:13px">
    Changing these affects links you may already have shared. Making everything private
    means anyone holding an old link sees a sign-in page instead of the document.
  </p>

  {#if form?.bulkChanged !== undefined}
    <p class="subtle" style="font-size:13px">
      {#if form.bulkChanged === 0}
        No changes — every draft was already {form.nowPublic ? "public" : "private"}.
      {:else}
        {form.bulkChanged}
        {form.bulkChanged === 1 ? "draft is" : "drafts are"} now
        {form.nowPublic ? "public" : "private"}.
      {/if}
    </p>
  {/if}

  <div class="row" style="gap:.75rem;flex-wrap:wrap">
    <form
      method="POST"
      action="?/bulk"
      onsubmit={(e) => {
        // Confirm with the REAL number. A generic "are you sure?" is easy to click past;
        // naming the count is what makes the consequence land.
        if (
          data.publicCount > 0 &&
          !confirm(
            `Make ${data.publicCount} public ${data.publicCount === 1 ? "draft" : "drafts"} private?\n\n` +
              `Anyone holding one of those links will get a sign-in page instead of the document.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="public" value="false" />
      <button class="btn btn--ghost" type="submit" disabled={data.publicCount === 0}>
        Make all {data.publicCount > 0 ? data.publicCount : ""} private
      </button>
    </form>

    <form
      method="POST"
      action="?/bulk"
      onsubmit={(e) => {
        if (
          data.privateCount > 0 &&
          !confirm(
            `Make ${data.privateCount} private ${data.privateCount === 1 ? "draft" : "drafts"} public?\n\n` +
              `Anyone with the link will be able to read ${data.privateCount === 1 ? "it" : "them"} without signing in.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="public" value="true" />
      <button class="btn btn--ghost" type="submit" disabled={data.privateCount === 0}>
        Make all {data.privateCount > 0 ? data.privateCount : ""} public
      </button>
    </form>
  </div>
</div>

<div class="card">
  <h3>From the CLI</h3>
  <pre class="mono" style="font-size:13px;overflow-x:auto"><code>agentdraft upload plan.md --private       # publish this one private
agentdraft visibility private plan.md     # flip an existing draft
agentdraft visibility private --default   # default for new drafts
agentdraft visibility public --all        # every existing draft
agentdraft list                           # shows a VISIBILITY column</code></pre>
</div>
