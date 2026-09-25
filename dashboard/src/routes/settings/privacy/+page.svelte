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
        <p>Choose whether the drafts your agents publish can be opened by anyone with the link, or only by you.</p>
      </div>
    </div>

    {#if form?.message}<p class="notice notice--error">{form.message}</p>{/if}

    <div class="grid grid--tight">
      <div class="stat">
        <div class="stat__label">New drafts are</div>
        <div class="stat__value">{defaultPublic ? "Public" : "Private"}</div>
        <div class="stat__foot">{defaultPublic ? "anyone with the link can open them" : "only you can open them"}</div>
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
          <h3 style="margin-bottom:.25rem">Default for new drafts: {defaultPublic ? "public" : "private"}</h3>
          <p style="margin:0">
            {#if defaultPublic}
              When an agent publishes a new draft, anyone who has the link can open it without
              signing in.
            {:else}
              When an agent publishes a new draft, only you can open it. Anyone else who follows
              the link is asked to sign in.
            {/if}
            Changing this affects new drafts only. Your existing {total === 1 ? "draft keeps its" : "drafts keep their"} current setting.
          </p>
          {#if form?.defaultChanged}
            <p class="ok small" style="margin:.75rem 0 0">Saved. From now on new drafts will be {form.nowPublic ? "public" : "private"}.</p>
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
      <h3 style="margin-bottom:.25rem">Change all existing drafts at once</h3>
      <p style="max-width:38rem">
        This updates every draft you have already published. If you make them all private,
        people you have shared links with will be asked to sign in instead of seeing the
        document.
      </p>

      {#if form?.bulkChanged !== undefined}
        <p class="notice notice--ok">
          {#if form.bulkChanged === 0}
            Nothing changed. Every draft was already {form.nowPublic ? "public" : "private"}.
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
      <div class="card__head"><h3>Do the same from the command line</h3></div>
      <div class="card__body" style="padding:1rem">
        <div class="term">
          <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
          <pre><code><span class="prompt">$</span> agentdraft upload plan.md --private       <span class="dim"># publish one draft as private</span>
<span class="prompt">$</span> agentdraft visibility private plan.md     <span class="dim"># make an existing draft private</span>
<span class="prompt">$</span> agentdraft visibility private --default   <span class="dim"># set the default for new drafts</span>
<span class="prompt">$</span> agentdraft visibility public --all        <span class="dim"># make every existing draft public</span>
<span class="prompt">$</span> agentdraft list                           <span class="dim"># list drafts with their visibility</span></code></pre>
        </div>
      </div>
    </div>
  </div>
</div>
