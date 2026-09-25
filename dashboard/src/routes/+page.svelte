<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data } = $props();
  const cta = $derived(data.authed ? { href: "/dashboard", text: "Open dashboard" } : { href: "/login", text: "Get started" });
</script>

<Seo
  title="agentdraft — publish AI agent plans to stable review URLs (HTML + Markdown)"
  description="Publish HTML and Markdown plans from AI coding agents to stable, versioned review URLs. One command from any machine — local, remote, or CI. Open source, self-hostable on Cloudflare."
  path="/"
/>

<!-- HERO: dark band, bottom-right corner rounded, nav floats over it. -->
<section class="band band--hero hero">
  <div class="hero__glow" aria-hidden="true"></div>
  <div class="container hero__grid">
    <div>
      <h1>Every agent's plan, one URL you can actually open</h1>
      <p class="lead">
        Your coding agents write plans on laptops, remote boxes and CI runners. agentdraft
        publishes each one to a stable, versioned review URL with a single command.
      </p>
      <div class="hero__actions">
        <a class="btn btn--light btn--lg" href={cta.href}>{cta.text} <span class="arrow">&rarr;</span></a>
        <a
          class="btn btn--outline btn--lg"
          href="https://github.com/Tapetide-hq/agentdraft"
          target="_blank"
          rel="noopener">View on GitHub</a
        >
      </div>
    </div>

    <div class="term" aria-label="Example: publishing a plan from the terminal">
      <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
      <pre><code><span class="prompt">$</span> agentdraft upload plan.md
<span class="dim">validated · rendered · v3</span>
<span class="url">https://agentdraft.tapetide.com/d/a1b2c3d4e5f6</span>

<span class="prompt">$</span> agentdraft upload audit.html --private
<span class="dim">validated · byte-for-byte · v1</span>
<span class="url">https://agentdraft.tapetide.com/d/9f8e7d6c5b4a</span></code></pre>
    </div>
  </div>
</section>

<!-- HOW IT WORKS: numbered steps, Parrot style. -->
<section class="section" id="how">
  <div class="container">
    <div class="section-title">
      <h2>How it works</h2>
      <p>From a file on some machine to a link in your browser, in under a minute.</p>
    </div>

    <div class="steps">
      <ol class="steps__list" style="list-style:none;padding:0;margin:0">
        <li class="step">
          <span class="step__n">1</span>
          <div>
            <h3>Create a machine key</h3>
            <p>Sign in once, mint one scoped key per machine your agents run on.</p>
          </div>
        </li>
        <li class="step">
          <span class="step__n">2</span>
          <div>
            <h3>Point your agents at it</h3>
            <p>One CLI binary, no runtime. <code>agentdraft auth set</code> on each box.</p>
          </div>
        </li>
        <li class="step">
          <span class="step__n">3</span>
          <div>
            <h3>Publish with one command</h3>
            <p>Markdown is rendered for reading, HTML is served byte-for-byte.</p>
          </div>
        </li>
        <li class="step">
          <span class="step__n">4</span>
          <div>
            <h3>Review from anywhere</h3>
            <p>Every re-upload is a new immutable version. Old ones stay live.</p>
          </div>
        </li>
      </ol>

      <div class="steps__visual">
        <div class="card card--flush" aria-hidden="true">
          <div class="card__head">
            <h3 style="font-size:18px">migration-plan.md</h3>
            <span class="pill pill--dark">v3</span>
          </div>
          <div class="card__body">
            <div class="row row--wrap" style="gap:.5rem;margin-bottom:1.25rem">
              <span class="pill">markdown</span>
              <span class="pill pill--ok">public</span>
              <span class="pill pill--outline">main@4f2c1a9</span>
            </div>
            <div style="height:14px;border-radius:7px;background:var(--surface);width:78%;margin-bottom:12px"></div>
            <div style="height:14px;border-radius:7px;background:var(--surface);width:92%;margin-bottom:12px"></div>
            <div style="height:14px;border-radius:7px;background:var(--surface);width:64%;margin-bottom:12px"></div>
            <div style="height:14px;border-radius:7px;background:var(--surface);width:85%"></div>
          </div>
          <div class="card__body">
            <div class="row row--between">
              <span class="small subtle">Version history</span>
              <span class="small subtle">3 versions</span>
            </div>
            <div class="row row--wrap" style="gap:.5rem;margin-top:.75rem">
              <span class="pill pill--dark">v3</span>
              <span class="pill">v2</span>
              <span class="pill">v1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- WHERE IT RUNS: tile grid, mirrors the "brokerages we support" band. -->
<section class="section">
  <div class="container">
    <div class="section-title">
      <h2>Works everywhere your agents do</h2>
      <p>One command, the same URL scheme, no matter which machine produced the plan.</p>
    </div>
    <div class="tiles">
      <div class="tile"><strong>Your laptop</strong><span>Local agents, local files</span></div>
      <div class="tile"><strong>Remote boxes</strong><span>No more SSH to read a plan</span></div>
      <div class="tile"><strong>CI runners</strong><span>Artifacts that never expire</span></div>
      <div class="tile"><strong>Cloud VMs</strong><span>Long-running agents</span></div>
      <div class="tile"><strong>Containers</strong><span>Even after they're gone</span></div>
    </div>
  </div>
</section>

<!-- SECURITY TRIO -->
<section class="section">
  <div class="container">
    <div class="section-title">
      <h2>Your documents, your control. Locked down by default</h2>
      <p>Published pages are treated as untrusted content from the first byte.</p>
    </div>
    <div class="grid-3">
      <div class="feature">
        <div class="feature__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <h3>Validated at upload</h3>
        <p>Scripts, forms and event handlers are rejected before a document is stored, by one authoritative server-side policy.</p>
      </div>
      <div class="feature">
        <div class="feature__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 4v5"/></svg>
        </div>
        <h3>Isolated origin</h3>
        <p>Documents are served from a separate origin that never holds a session cookie, behind a strict Content Security Policy.</p>
      </div>
      <div class="feature">
        <div class="feature__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1016 0 8 8 0 10-16 0z"/><path d="M8 12l3 3 5-6"/></svg>
        </div>
        <h3>Open source, self-hostable</h3>
        <p>MIT licensed and built for Cloudflare's free tier. Run it on your own account and keep every draft in your own storage.</p>
      </div>
    </div>
  </div>
</section>

<!-- DARK MID BAND: what a review URL gives you (stat cards, green values). -->
<section class="band band--mid" style="padding:90px 0;margin-top:60px">
  <div class="container">
    <div class="section-title" style="margin-bottom:2.5rem">
      <h2>This is what you've been missing</h2>
      <p>The plan was fine. Getting to it was the problem.</p>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
      <div class="stat">
        <div class="stat__label">Publish</div>
        <div class="stat__value">1 command</div>
        <div class="stat__foot">from any machine, no runtime</div>
      </div>
      <div class="stat">
        <div class="stat__label">History</div>
        <div class="stat__value">Immutable</div>
        <div class="stat__foot">every version stays live</div>
      </div>
      <div class="stat">
        <div class="stat__label">Formats</div>
        <div class="stat__value">HTML + MD</div>
        <div class="stat__foot">rendered or byte-for-byte</div>
      </div>
      <div class="stat">
        <div class="stat__label">Scripts executed</div>
        <div class="stat__value">0</div>
        <div class="stat__foot">rejected at upload, always</div>
      </div>
      <div class="stat">
        <div class="stat__label">Visibility</div>
        <div class="stat__value">Your call</div>
        <div class="stat__foot">public by link or private to you</div>
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="section" id="faq">
  <div class="container">
    <div class="section-title" style="margin:0 auto;text-align:center">
      <h2>Frequently asked questions</h2>
    </div>
    <div class="faq">
      <details open>
        <summary>How does agentdraft work?</summary>
        <p>
          Install the CLI, set a key once per machine, and run <code>agentdraft upload plan.md</code>.
          You get back a stable URL. Upload the same file again and it becomes the next version at
          the same URL, with the earlier versions still reachable.
        </p>
      </details>
      <details>
        <summary>Why not just paste Markdown into chat?</summary>
        <p>
          A chat window flattens headings, tables and code into a wall of asterisks, and it scrolls
          away. A review URL renders the document properly, keeps every revision, and can be opened
          from any device without access to the machine that wrote it.
        </p>
      </details>
      <details>
        <summary>Is uploaded HTML safe to open?</summary>
        <p>
          Uploads are validated against a published policy: no scripts, no forms, no event handlers,
          no external script loads. Documents are then served from an isolated origin with a strict
          CSP and no cookies, so a hostile file cannot reach your session.
        </p>
      </details>
      <details>
        <summary>Can I keep a draft private?</summary>
        <p>
          Yes. Any draft can be public by link or private to your account, and you can set the
          default for new drafts. Private links keep working for you and show a sign-in page to
          anyone else.
        </p>
      </details>
      <details>
        <summary>Can I run it myself?</summary>
        <p>
          agentdraft is MIT licensed and deploys to Cloudflare Workers, D1 and R2 on the free tier.
          The self-hosting guide walks through the four pieces: API, content origin, dashboard and CLI.
        </p>
      </details>
    </div>
  </div>
</section>

<!-- FINAL CTA BAR -->
<section class="section" style="padding-top:40px">
  <div class="container" style="text-align:center">
    <a class="cta-bar" href={cta.href}>
      Start publishing your agents' plans
      <span class="arrow" aria-hidden="true">&rarr;</span>
    </a>
  </div>
</section>
