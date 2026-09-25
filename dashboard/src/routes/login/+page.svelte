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

  // Carry the return-to path onto the Google button and the key-paste form action, so a
  // viewer who followed a private draft link lands back on that document after signing
  // in rather than on the dashboard. `data.next` is already validated server-side.
  const nextQS = $derived(
    data?.next && data.next !== "/dashboard" ? `?next=${encodeURIComponent(data.next)}` : "",
  );
</script>

<Seo title="Sign in — agentdraft" description="Sign in to agentdraft." path="/login" noindex />

<div class="page auth-page">
  <div class="container">
    <div class="card auth-card">
      <h1 class="auth-title">Get started</h1>
      <p class="auth-sub">
        {#if data?.hosted}
          Sign in with Google to reach your dashboard, publish drafts and create a key for
          each machine your agents run on.
        {:else}
          Paste a scoped API key to open your dashboard. It is stored in an httpOnly cookie
          on this origin and never exposed to browser scripts.
        {/if}
      </p>

      {#if errorText}
        <p class="notice notice--error">{errorText}</p>
      {/if}

      {#if data?.hosted}
        <a class="btn btn--lg auth-google" href="/auth/google{nextQS}">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.5 13.6 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.4-4 7.2-10 7.2-17.4z"/>
            <path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-8-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8-6.2z"/>
            <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.4-5.7c-2.1 1.4-4.8 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-8 6.2C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Continue with Google
          <span class="arrow">&rarr;</span>
        </a>
        <p class="field-hint" style="margin-top:1.25rem">
          API keys are machine credentials. They publish drafts but cannot sign in here or
          create further keys, so a key leaked from CI or a dotfile can never take over the
          account.
        </p>
      {:else}
        <!-- Self-hosted deployment with no IdP configured: key paste is the only way in. -->
        <form method="POST">
          <label for="api_key">API key</label>
          <input id="api_key" name="api_key" type="password" placeholder="ad_…" autocomplete="off" required />
          {#if form?.message}<p class="error small" style="margin:.75rem 0 0">{form.message}</p>{/if}
          <div class="form-actions">
            <button class="btn btn--lg" type="submit" style="width:100%">Sign in <span class="arrow">&rarr;</span></button>
          </div>
        </form>

        {#if data?.googleEnabled}
          <div class="auth-or"><span>or</span></div>
          <a class="btn btn--outline btn--lg auth-google" href="/auth/google{nextQS}">Continue with Google</a>
        {/if}
      {/if}

      <p class="auth-terms">
        By signing in you agree to publish only content you are allowed to share. Published
        drafts are served as untrusted content from an isolated origin.
      </p>
    </div>
  </div>
</div>

<style>
  .auth-page {
    min-height: calc(100vh - 90px);
    display: flex;
    align-items: center;
    background:
      radial-gradient(60% 50% at 80% 0%, rgb(var(--green-rgb) / 0.08), transparent 70%),
      var(--white);
  }
  .auth-card {
    max-width: 30rem;
    margin: 0 auto;
    padding: 2.5rem;
  }
  .auth-title {
    font-size: 36px;
    letter-spacing: -0.03em;
    margin-bottom: 0.5rem;
  }
  .auth-sub {
    font-size: 16px;
    margin-bottom: 1.75rem;
  }
  .auth-google {
    width: 100%;
  }
  .auth-google .arrow {
    margin-left: auto;
  }
  .auth-or {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.5rem 0;
    color: var(--ink-faint);
    font-size: 13px;
  }
  .auth-or::before,
  .auth-or::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--line);
  }
  .auth-terms {
    margin: 1.75rem 0 0;
    font-size: 13px;
    color: var(--ink-faint);
    text-align: center;
  }
</style>
