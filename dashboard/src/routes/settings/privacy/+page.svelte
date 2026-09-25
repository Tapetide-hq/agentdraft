<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data, form } = $props();

  // Read from the server value each render. After an action SvelteKit re-runs `load`, so
  // this reflects the authoritative state rather than what we optimistically sent.
  const defaultPublic = $derived(data.defaultPublic);
  const total = $derived(data.publicCount + data.privateCount);
</script>

<Seo title="Privacy — agentdraft" description="Draft visibility settings." path="/settings/privacy" noindex />

<div class="page">
  <div class="container">
    <div class="page-head">
      <div>
        <h1>Privacy</h1>
        <p>Decide who can read the drafts your agents publish.</p>
      </div>
    </div>

    {#if form?.message}<p class="notice notice--error">{form.message}</p>{/if}

    <div class="grid grid--tight">
      <div class="stat">
        <div class="stat__label">New drafts default to</div>
        <div class="stat__value">{defaultPublic ? "Public" : "Private"}</div>
        <div class="stat__foot">{defaultPublic ? "readable by anyone with the link" : "readable only by you"}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Public drafts</div>
        <div class="stat__value">{data.publicCount}</div>
        <div class="stat__foot">of {total} total</div>
      </div>
      <div class="stat">
        <div class="stat__label">Private drafts</div>
        <div class="stat__value">{data.privateCount}</div>
        <div class="stat__foot">of {total} total</div>
      </div>
    </div>

    <!-- DEFAULT FOR NEW DRAFTS -->
    <div class="card">
      <div class="row row--between row--wrap" style="gap:1rem">
        <div style="max-width:38rem">
          <h3 style="margin-bottom:.25rem">New drafts are {defaultPublic ? "public" : "private"}</h3>
          <p style="margin:0">
            {#if defaultPublic}
              Drafts you publish are readable by anyone with the link. Agents publishing from CI
              will produce public URLs.
            {:else}
              Drafts you publish are readable only by you. The link still works for you; anyone
              else who opens it gets a sign-in page.
            {/if}
            This applies to new drafts only. Your existing {total === 1 ? "draft is" : "drafts are"} not affected.
          </p>
          {#if form?.defaultChanged}
            <p class="ok small" style="margin:.75rem 0 0">Saved. New drafts will be {form.nowPublic ? "public" : "private"}.</p>
          {/if}
        </div>
        <form method="POST" action="?/setdefault">
          <input type="hidden" name="public" value={defaultPublic ? "false" : "true"} />
          <button class="btn" type="submit">
            {defaultPublic ? "Make new drafts private" : "Make new drafts public"}
          </button>
        </form>
      </div>
    </div>

    <!-- EXISTING DRAFTS -->
    <div class="card">
      <h3 style="margin-bottom:.25rem">Existing drafts</h3>
      <p style="max-width:38rem">
        Changing these affects links you may already have shared. Making everything private
        means anyone holding an old link sees a sign-in page instead of the document.
      </p>

      {#if form?.bulkChanged !== undefined}
        <p class="notice notice--ok">
          {#if form.bulkChanged === 0}
            No changes. Every draft was already {form.nowPublic ? "public" : "private"}.
          {:else}
            {form.bulkChanged} {form.bulkChanged === 1 ? "draft is" : "drafts are"} now {form.nowPublic ? "public" : "private"}.
          {/if}
        </p>
      {/if}

      <div class="row row--wrap">
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
          <button class="btn btn--outline" type="submit" disabled={data.publicCount === 0}>
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
          <button class="btn btn--outline" type="submit" disabled={data.privateCount === 0}>
            Make all {data.privateCount > 0 ? data.privateCount : ""} public
          </button>
        </form>
      </div>
    </div>

    <!-- CLI -->
    <div class="card card--flush">
      <div class="card__head"><h3>From the CLI</h3></div>
      <div class="card__body" style="padding:1rem">
        <div class="term">
          <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
          <pre><code><span class="prompt">$</span> agentdraft upload plan.md --private       <span class="dim"># publish this one private</span>
<span class="prompt">$</span> agentdraft visibility private plan.md     <span class="dim"># flip an existing draft</span>
<span class="prompt">$</span> agentdraft visibility private --default   <span class="dim"># default for new drafts</span>
<span class="prompt">$</span> agentdraft visibility public --all        <span class="dim"># every existing draft</span>
<span class="prompt">$</span> agentdraft list                           <span class="dim"># shows a VISIBILITY column</span></code></pre>
        </div>
      </div>
    </div>
  </div>
</div>
