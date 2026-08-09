<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data, form } = $props();
</script>

<Seo title="API Keys — agentdraft" description="Create and revoke scoped API keys." path="/settings/keys" noindex />

<h1>API <span class="accent">KEYS.</span></h1>
<p style="max-width:36rem">
  Create <strong>one key per machine</strong> your agents run on — laptop, remote box, each
  CI runner. Naming them per machine means you can revoke a single machine without
  touching the others. The full value is shown once at creation and cannot be retrieved
  later.
</p>

{#if !data.canManage}
  <div class="card">
    <p class="error">This session cannot manage keys.</p>
    <p class="subtle" style="margin:0">
      Keys can only be created from the dashboard after signing in with Google.
    </p>
  </div>
{:else}
  {#if form?.newKey}
    <div class="panel panel--accent">
      <div class="panel__head">new key for “{form.name}” — copy it now</div>
      <div class="panel__body">
        <p class="subtle" style="margin-top:0">
          This is the only time the full key is shown. Store it on that machine and it
          never needs to be seen again.
        </p>
        <input
          readonly
          value={form.newKey}
          class="mono"
          onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
        />
        <p class="subtle" style="margin:.9rem 0 0;font-size:13px">Then, on that machine:</p>
        <pre><code>agentdraft auth set {form.newKey}</code></pre>
      </div>
    </div>
  {/if}

  <div class="panel panel--accent" style="max-width:36rem">
    <div class="panel__head">new machine key</div>
    <div class="panel__body">
      <form method="POST" action="?/create">
        <label for="name">Machine name</label>
        <input id="name" name="name" placeholder="macbook-pro · ci-runner-1 · gpu-box" required />
        <p class="subtle" style="margin:.5rem 0 0;font-size:13px">
          Use something you will recognise months from now when deciding what to revoke.
        </p>
        <span class="label" style="display:block;margin:1.1rem 0 .35rem">Scopes</span>
        <div class="row" style="gap:1.25rem;flex-wrap:wrap">
          <label class="row" style="margin:0;gap:.4rem;text-transform:none;letter-spacing:0">
            <input type="checkbox" name="scopes" value="upload" checked style="width:auto" /> upload
          </label>
          <label class="row" style="margin:0;gap:.4rem;text-transform:none;letter-spacing:0">
            <input type="checkbox" name="scopes" value="read" checked style="width:auto" /> read
          </label>
        </div>
        <p class="subtle" style="margin:.6rem 0 0;font-size:13px">
          Machine keys publish and read. They cannot sign in to this dashboard or create
          further keys, so a leaked key can never take over the account.
        </p>
        {#if form?.message}<p class="error">{form.message}</p>{/if}
        <div style="margin-top:1.15rem"><button class="btn" type="submit">Create key</button></div>
      </form>
    </div>
  </div>

  <div class="card">
    <h3>Your machines</h3>
    {#if data.keys.length === 0}
      <p class="subtle">No keys yet. Create one above for the first machine.</p>
    {:else}
      <table>
        <thead>
          <tr><th>Machine</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {#each data.keys as k}
            <tr>
              <td>{k.name}</td>
              <td class="mono">{k.key_prefix}&hellip;</td>
              <td class="subtle">{k.scopes}</td>
              <td class="subtle">
                {k.last_used_at ? new Date(k.last_used_at + "Z").toLocaleString() : "never"}
              </td>
              <td>
                {#if k.revoked_at}
                  <span class="pill pill--danger">revoked</span>
                {:else}
                  <span class="pill pill--ok">active</span>
                {/if}
              </td>
              <td>
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
                    <button class="btn btn--danger" type="submit">Revoke</button>
                  </form>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}
