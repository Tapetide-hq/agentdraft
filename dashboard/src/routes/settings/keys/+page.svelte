<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>API Keys — agentdraft</title></svelte:head>

<h1>API <span class="accent">KEYS.</span></h1>
<p style="max-width:34rem">
  Keys authenticate the CLI and your agents. The full value is shown once at creation and
  cannot be retrieved later. Minting keys requires the <code>manage</code> scope.
</p>

{#if !data.canManage}
  <div class="card">
    <p class="error">The signed-in key does not have the <code>manage</code> scope.</p>
    <p class="subtle" style="margin:0">
      Sign in with a manage-scoped key (or the bootstrap key) to administer keys.
    </p>
  </div>
{:else}
  {#if form?.newKey}
    <div class="panel panel--accent">
      <div class="panel__head">new key — copy it now</div>
      <div class="panel__body">
        <p class="subtle">This is the only time the full key is shown.</p>
        <input
          readonly
          value={form.newKey}
          class="mono"
          onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
        />
      </div>
    </div>
  {/if}

  <div class="panel panel--accent" style="max-width:34rem">
    <div class="panel__head">create key</div>
    <div class="panel__body">
      <form method="POST" action="?/create">
        <label for="name">Name</label>
        <input id="name" name="name" placeholder="ci-agent" />
        <span class="label" style="display:block;margin:.9rem 0 .35rem">Scopes</span>
        <div class="row" style="gap:1.25rem;flex-wrap:wrap">
          <label class="row" style="margin:0;gap:.4rem;text-transform:none;letter-spacing:0">
            <input type="checkbox" name="scopes" value="upload" checked style="width:auto" /> upload
          </label>
          <label class="row" style="margin:0;gap:.4rem;text-transform:none;letter-spacing:0">
            <input type="checkbox" name="scopes" value="read" checked style="width:auto" /> read
          </label>
          <label class="row" style="margin:0;gap:.4rem;text-transform:none;letter-spacing:0">
            <input type="checkbox" name="scopes" value="manage" style="width:auto" /> manage
          </label>
        </div>
        {#if form?.message}<p class="error">{form.message}</p>{/if}
        <div style="margin-top:1.15rem"><button class="btn" type="submit">Create key</button></div>
      </form>
    </div>
  </div>

  <div class="card">
    <h3>Your keys</h3>
    {#if data.keys.length === 0}
      <p class="subtle">No keys yet.</p>
    {:else}
      <table>
        <thead>
          <tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {#each data.keys as k}
            <tr>
              <td>{k.name}</td>
              <td class="mono">{k.key_prefix}&hellip;</td>
              <td class="subtle">{k.scopes}</td>
              <td class="subtle">
                {k.last_used_at ? new Date(k.last_used_at + "Z").toLocaleString() : "—"}
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
                  <form method="POST" action="?/revoke">
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
