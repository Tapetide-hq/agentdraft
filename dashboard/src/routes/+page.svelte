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
      <h1>Turn your AI agents' plans into links you can open anywhere</h1>
      <p class="lead">
        Coding agents write plans, audits and proposals on laptops, servers and CI runners.
        agentdraft publishes each one to a permanent link with one command, so you can read
        it in a browser instead of hunting for the file.
      </p>
      <div class="hero__actions">
        <a class="btn btn--light btn--lg" href={cta.href}>{cta.text} <span class="arrow">&rarr;</span></a>
        <a class="btn btn--outline btn--lg" href="#how">See how it works</a>
      </div>
    </div>

    <div class="term" aria-label="Example: publishing a plan from the terminal">
      <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
      <pre><code><span class="prompt">$</span> agentdraft upload plan.md
<span class="dim">checked · rendered · version 3</span>
<span class="url">https://agentdraft.tapetide.com/d/a1b2c3d4e5f6</span>

<span class="prompt">$</span> agentdraft upload audit.html --private
<span class="dim">checked · private · version 1</span>
<span class="url">https://agentdraft.tapetide.com/d/9f8e7d6c5b4a</span></code></pre>
    </div>
  </div>
</section>

<!-- HOW IT WORKS: numbered steps, Parrot style. -->
<section class="section" id="how">
  <div class="container">
    <div class="section-title">
      <h2>How it works</h2>
      <p>Four steps, and the first three you only do once.</p>
    </div>

    <div class="steps">
      <ol class="steps__list" style="list-style:none;padding:0;margin:0">
        <li class="step">
          <span class="step__n">1</span>
          <div>
            <h3>Create an API key</h3>
            <p>Sign in and create one key for each machine your agents run on.</p>
          </div>
        </li>
        <li class="step">
          <span class="step__n">2</span>
          <div>
            <h3>Install the CLI</h3>
            <p>One small binary. Run <code>agentdraft auth set</code> once with the key.</p>
          </div>
        </li>
        <li class="step">
          <span class="step__n">3</span>
          <div>
            <h3>Publish with one command</h3>
            <p>Markdown is turned into a readable page. HTML is shown exactly as uploaded.</p>
          </div>
        </li>
        <li class="step">
          <span class="step__n">4</span>
          <div>
            <h3>Open the link anywhere</h3>
            <p>Upload the same file again and it becomes a new version. Older versions stay available.</p>
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
      <h2>Works wherever your agents run</h2>
      <p>The same command and the same kind of link, whichever machine the plan came from.</p>
    </div>
    <div class="tiles">
      <div class="tile"><strong>Your laptop</strong><span>Share a local plan without emailing a file</span></div>
      <div class="tile"><strong>Remote servers</strong><span>Read the plan without opening SSH</span></div>
      <div class="tile"><strong>CI pipelines</strong><span>Reports that outlive the job</span></div>
      <div class="tile"><strong>Cloud machines</strong><span>Check on long-running agents</span></div>
      <div class="tile"><strong>Containers</strong><span>The link works after the container is gone</span></div>
    </div>
  </div>
</section>

<!-- SECURITY TRIO -->
<section class="section">
  <div class="container">
    <div class="section-title">
      <h2>Safe to open, by design</h2>
      <p>Agents can produce anything, so every published page is treated as untrusted.</p>
    </div>
    <div class="grid-3">
      <div class="feature">
        <div class="feature__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <h3>Checked before it is stored</h3>
        <p>Uploads containing scripts, forms or event handlers are rejected, so a page can never run code in your browser.</p>
      </div>
      <div class="feature">
        <div class="feature__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 4v5"/></svg>
        </div>
        <h3>Kept apart from your account</h3>
        <p>Published pages are served from a separate domain that never sees your login, so a document cannot reach your session.</p>
      </div>
      <div class="feature">
        <div class="feature__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1016 0 8 8 0 10-16 0z"/><path d="M8 12l3 3 5-6"/></svg>
        </div>
        <h3>Open source, run it yourself</h3>
        <p>MIT licensed and built for Cloudflare's free tier. Deploy it to your own account and keep every draft in your own storage.</p>
      </div>
    </div>
  </div>
</section>

<!-- DARK MID BAND: what a review URL gives you (stat cards, green values). -->
<section class="band band--mid" style="padding:90px 0;margin-top:60px">
  <div class="container">
    <div class="section-title" style="margin-bottom:2.5rem">
      <h2>What you get</h2>
      <p>The plan was always fine. Getting to it was the hard part.</p>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
      <div class="stat">
        <div class="stat__label">To publish</div>
        <div class="stat__value">1 command</div>
        <div class="stat__foot">from any machine, nothing else to install</div>
      </div>
      <div class="stat">
        <div class="stat__label">Versions</div>
        <div class="stat__value">Kept forever</div>
        <div class="stat__foot">every upload stays available</div>
      </div>
      <div class="stat">
        <div class="stat__label">Formats</div>
        <div class="stat__value">HTML + MD</div>
        <div class="stat__foot">Markdown rendered, HTML as uploaded</div>
      </div>
      <div class="stat">
        <div class="stat__label">Scripts allowed</div>
        <div class="stat__value">0</div>
        <div class="stat__foot">rejected before the page is stored</div>
      </div>
      <div class="stat">
        <div class="stat__label">Who can read</div>
        <div class="stat__value">You decide</div>
        <div class="stat__foot">anyone with the link, or only you</div>
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
          Install the small command-line tool, connect it to your account once, and run
          <code>agentdraft upload plan.md</code>. It prints a link you can open anywhere. Upload
          the same file again and the link shows the new version, with earlier versions still
          available.
        </p>
      </details>
      <details>
        <summary>Why not just paste Markdown into chat?</summary>
        <p>
          Chat windows flatten headings, tables and code into a wall of symbols, and the message
          scrolls out of reach. A link shows the document properly formatted, keeps every
          revision, and opens on any device without access to the machine that wrote it.
        </p>
      </details>
      <details>
        <summary>Is uploaded HTML safe to open?</summary>
        <p>
          Yes. Every upload is checked before it is stored, and anything containing scripts,
          forms or event handlers is rejected. Pages are then served from a separate domain
          that never sees your login, so even a malicious file cannot reach your account.
        </p>
      </details>
      <details>
        <summary>Can I keep a draft private?</summary>
        <p>
          Yes. Each draft can be public, meaning anyone with the link can open it, or private,
          meaning only you can. You can also set the default for new drafts. A private link still
          works for you and asks anyone else to sign in.
        </p>
      </details>
      <details>
        <summary>Can I run it myself?</summary>
        <p>
          Yes. agentdraft is open source under the MIT licence and runs on Cloudflare's free tier.
          The self-hosting guide on GitHub walks through deploying the four parts: the API, the
          page server, this dashboard and the command-line tool.
        </p>
      </details>
    </div>
  </div>
</section>

<!-- FINAL CTA BAR -->
<section class="section" style="padding-top:40px">
  <div class="container" style="display:flex;justify-content:center">
    <a class="cta-bar" href={cta.href}>
      Start publishing your agents' plans
      <span class="arrow" aria-hidden="true">&rarr;</span>
    </a>
  </div>
</section>
