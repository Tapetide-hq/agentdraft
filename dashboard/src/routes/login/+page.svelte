<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { form, data } = $props();

  const errors: Record<string, string> = {
    unavailable: "Google sign-in is not configured on this deployment.",
    missing_code: "Google did not return an authorization code. Please try again.",
    failed: "Google sign-in could not be completed. Please try again.",
    nosession: "Signed in with Google, but no session was issued. Please try again.",
    access_denied: "You declined the Google consent screen.",
  };
  const errorText = $derived(
    data?.googleError ? (errors[data.googleError] ?? `Google sign-in failed (${data.googleError}).`) : null,
  );
</script>

<Seo title="Sign in — agentdraft" description="Sign in to agentdraft." path="/login" noindex />

<h1>SIGN <span class="accent">IN.</span></h1>

{#if data?.hosted}
  <p style="max-width:32rem">
    Sign in with Google to reach your dashboard, publish drafts, and create an API key for
    each machine your agents run on.
  </p>

  <div class="panel panel--accent" style="max-width:30rem">
    <div class="panel__head">continue with google</div>
    <div class="panel__body">
      {#if errorText}
        <p class="error" style="margin-top:0">{errorText}</p>
      {/if}
      <a class="btn" href="/auth/google">Sign in with Google</a>
      <p class="subtle" style="margin:1rem 0 0;font-size:13px">
        API keys are machine credentials. They publish drafts but cannot sign in here or
        create further keys — so a key leaked from a CI config or a dotfile can never be
        used to take over the account.
      </p>
    </div>
  </div>
{:else}
  <!-- Self-hosted deployment with no IdP configured: key paste is the only way in. -->
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
{/if}
