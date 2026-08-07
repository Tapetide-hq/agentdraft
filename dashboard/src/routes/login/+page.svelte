<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { form, data } = $props();
</script>

<Seo title="Sign in — agentdraft" description="Sign in to agentdraft." path="/login" noindex />

<h1>SIGN <span class="accent">IN.</span></h1>
<p style="max-width:32rem">
  Paste a scoped API key. It is stored in an httpOnly cookie on this origin and is never
  exposed to browser scripts.
</p>

<div class="panel panel--accent" style="max-width:30rem">
  <div class="panel__head">api key</div>
  <div class="panel__body">
    <form method="POST">
      <label for="api_key">Key</label>
      <input id="api_key" name="api_key" type="password" placeholder="ad_..." autocomplete="off" required />
      {#if form?.message}<p class="error" style="margin-top:.75rem">{form.message}</p>{/if}
      <div style="margin-top:1.15rem">
        <button class="btn" type="submit">Sign in</button>
      </div>
    </form>
  </div>
</div>

{#if data?.googleEnabled}
  <div class="card" style="max-width:30rem">
    <h3>Or continue with Google</h3>
    <a class="btn btn--ghost" href="/auth/google">Sign in with Google</a>
  </div>
{/if}

<p class="subtle" style="font-size:13px">
  No key yet? The instance owner bootstraps the first key via
  <code>POST /api/bootstrap</code>, then mints scoped keys on the Keys page.
</p>
