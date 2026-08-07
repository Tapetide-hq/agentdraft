<script lang="ts">
  let { data, form } = $props();
</script>

<h1>API Keys</h1>
<p class="muted">
  Keys authenticate the CLI and agents. The full key is shown once at creation and
  cannot be retrieved later. Managing keys requires a <code>manage</code>-scoped key.
</p>

{#if !data.canManage}
  <div class="card">
    <p class="error">The signed-in key does not have the <code>manage</code> scope.</p>
    <p class="muted">Sign in with a manage-scoped key (or the bootstrap key) to administer keys.</p>
  </div>
{:else}
  {#if form?.newKey}
    <div class="card" style="border-color:var(--ok)">
      <h3 class="ok">New key created — copy it now</h3>
      <p class="muted">This is the only time the full key is shown.</p>
      <input readonly value={form.newKey} onclick={(e) => (e.currentTarget as HTMLInputElement).select()} class="mono" />
    </div>
  {/if}

  <div class="card" style="max-width:560px">
    <h3>Create a key</h3>
    <form method="POST" action="?/create">
      <label for="name">Name</label>
      <input id="name" name="name" placeholder="my-agent" />
      <span class="muted" style="display:block;margin:0.75rem 0 0.35rem;font-size:0.85rem">Scopes</span>
      <div class="row" style="gap:1.25rem;flex-wrap:wrap">
        <label class="row" style="margin:0;gap:0.4rem"><input type="checkbox" name="scopes" value="upload" checked style="width:auto" /> upload</label>
        <label class="row" style="margin:0;gap:0.4rem"><input type="checkbox" name="scopes" value="read" checked style="width:auto" /> read</label>
        <label class="row" style="margin:0;gap:0.4rem"><input type="checkbox" name="scopes" value="manage" style="width:auto" /> manage</label>
      </div>
      {#if form?.message}<p class="error">{form.message}</p>{/if}
      <div style="margin-top:1rem"><button class="btn" type="submit">Create key</button></div>
    </form>
  </div>

  <div class="card">
    <h3>Your keys</h3>
    {#if data.keys.length === 0}
      <p class="muted">No keys yet.</p>
    {:else}
      <table>
        <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {#each data.keys as k}
            <tr>
              <td>{k.name}</td>
              <td class="mono">{k.key_prefix}…</td>
              <td class="muted">{k.scopes}</td>
              <td class="muted">{k.last_used_at ? new Date(k.last_used_at + "Z").toLocaleString() : "—"}</td>
              <td>{#if k.revoked_at}<span class="pill error">revoked</span>{:else}<span class="pill ok">active</span>{/if}</td>
              <td>
                {#if !k.revoked_at}
                  <form method="POST" action="?/revoke">
                    <input type="hidden" name="id" value={k.id} />
                    <button class="btn danger" type="submit">Revoke</button>
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
