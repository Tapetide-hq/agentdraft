<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  import { fmtDate } from "$lib/format";
  let { data, form } = $props();

  let copied = $state(false);
  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      /* clipboard blocked: the input below is still selectable */
    }
  }
</script>

<Seo title="API Keys — agentdraft" description="Create and revoke scoped API keys." path="/settings/keys" noindex />

<div class="page">
  <div class="container">
    <div class="page-head">
      <div>
        <h1>API keys</h1>
        <p style="max-width:40rem">
          One key per machine your agents run on: laptop, remote box, each CI runner. Naming
          them per machine means you can revoke one without touching the others.
        </p>
      </div>
    </div>

    {#if !data.canManage}
      <div class="card card--mint">
        <h3 style="margin-bottom:.25rem">This session cannot manage keys</h3>
        <p style="margin:0">Keys can only be created from the dashboard after signing in with Google.</p>
      </div>
    {:else}
      {#if form?.newKey}
        {@const newKey = form.newKey}
        <div class="card card--dark">
          <div class="row row--between row--wrap" style="gap:1rem;margin-bottom:1rem">
            <h3 style="margin:0">New key for “{form.name}”</h3>
            <span class="pill pill--ok">shown once</span>
          </div>
          <p>
            This is the only time the full key is shown. Store it on that machine and it never
            needs to be seen again.
          </p>
          <div class="row row--wrap">
            <input
              readonly
              value={newKey}
              class="mono"
              style="flex:1;min-width:16rem"
              onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
            />
            <button class="btn btn--light" type="button" onclick={() => copyKey(newKey)}>
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
          <p class="small" style="margin:1.25rem 0 .5rem">Then, on that machine:</p>
          <div class="term">
            <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
            <pre><code><span class="prompt">$</span> agentdraft auth set {newKey}</code></pre>
          </div>
        </div>
      {/if}

      <div class="split">
        <div class="card">
          <h3 style="margin-bottom:1.25rem">New machine key</h3>
          <form method="POST" action="?/create">
            <label for="name">Machine name</label>
            <input id="name" name="name" placeholder="macbook-pro · ci-runner-1 · gpu-box" required />
            <p class="field-hint">Use something you will recognise months from now when deciding what to revoke.</p>

            <span class="label-text">Scopes</span>
            <div class="row row--wrap" style="gap:1.25rem" role="group" aria-label="Scopes">
              <label class="check"><input type="checkbox" name="scopes" value="upload" checked /> upload</label>
              <label class="check"><input type="checkbox" name="scopes" value="read" checked /> read</label>
            </div>
            <p class="field-hint">
              Machine keys publish and read. They cannot sign in to this dashboard or create
              further keys, so a leaked key can never take over the account.
            </p>
            {#if form?.message}<p class="notice notice--error" style="margin-top:1rem">{form.message}</p>{/if}
            <div class="form-actions">
              <button class="btn" type="submit">Create key <span class="arrow">&rarr;</span></button>
            </div>
          </form>
        </div>

        <div class="card card--flush">
          <div class="card__head">
            <h3>Your machines</h3>
            <span class="subtle small">{data.keys.filter((k) => !k.revoked_at).length} active</span>
          </div>
          {#if data.keys.length === 0}
            <div class="card__body">
              <p class="subtle" style="margin:0">No keys yet. Create one for the first machine.</p>
            </div>
          {:else}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Machine</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {#each data.keys as k (k.id)}
                    <tr>
                      <td style="font-weight:500">{k.name}</td>
                      <td class="mono subtle">{k.key_prefix}&hellip;</td>
                      <td>
                        <div class="row" style="gap:.35rem">
                          {#each k.scopes.split(",").map((s) => s.trim()).filter(Boolean) as s (s)}
                            <span class="pill pill--outline">{s}</span>
                          {/each}
                        </div>
                      </td>
                      <td class="subtle num">{k.last_used_at ? fmtDate(k.last_used_at) : "never"}</td>
                      <td>
                        {#if k.revoked_at}
                          <span class="pill pill--danger">revoked</span>
                        {:else}
                          <span class="pill pill--ok">active</span>
                        {/if}
                      </td>
                      <td style="text-align:right">
                        {#if !k.revoked_at}
                          <form
                            method="POST"
                            action="?/revoke"
                            onsubmit={(e) => {
                              if (!confirm(`Revoke the key for “${k.name}”? That machine stops publishing immediately.`))
                                e.preventDefault();
                            }}
                          >
                            <input type="hidden" name="id" value={k.id} />
                            <button class="btn btn--danger btn--sm" type="submit">Revoke</button>
                          </form>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
