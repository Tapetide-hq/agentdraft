<script lang="ts">
  let { form } = $props();
</script>

<h1>Sign in</h1>
<p class="muted">
  WebHost v1 is invite-only. Paste an API key created by the service owner. The key is
  stored in an httpOnly cookie on this origin and is never exposed to browser scripts.
</p>

<div class="card" style="max-width:480px">
  <form method="POST">
    <label for="api_key">API key</label>
    <input id="api_key" name="api_key" type="password" placeholder="wh_..." autocomplete="off" required />
    {#if form?.message}
      <p class="error">{form.message}</p>
    {/if}
    <div style="margin-top:1rem">
      <button class="btn" type="submit">Sign in</button>
    </div>
  </form>
</div>

<p class="muted">
  No key yet? The owner bootstraps the first key via <code>POST /api/bootstrap</code>,
  then mints scoped keys on the API Keys page.
</p>
