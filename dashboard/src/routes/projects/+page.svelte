<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data, form } = $props();
</script>

<Seo title="Projects — agentdraft" description="Group drafts by repo, service, or agent fleet." path="/projects" noindex />

<div class="page">
  <div class="container">
    <div class="page-head">
      <div>
        <h1>Projects</h1>
        <p>Projects group related drafts together, for example everything about one repository or one service.</p>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <h3 style="margin-bottom:1.25rem">Create a project</h3>
        <form method="POST" action="?/create">
          <label for="name">Name</label>
          <input id="name" name="name" placeholder="payments-service" required />
          <label for="description">Description</label>
          <input id="description" name="description" placeholder="Optional. What does this project cover?" />
          {#if form?.message}<p class="notice notice--error" style="margin-top:1rem">{form.message}</p>{/if}
          {#if form?.created}<p class="notice notice--ok" style="margin-top:1rem">Project created.</p>{/if}
          <div class="form-actions">
            <button class="btn" type="submit">Create project <span class="arrow">&rarr;</span></button>
          </div>
        </form>
      </div>

      <div>
        {#if data.projects.length > 0}
          <div class="grid">
            {#each data.projects as p (p.id)}
              <div class="card" style="margin:0">
                <div class="row row--between" style="margin-bottom:.75rem">
                  <span class="pill pill--outline mono">{p.id}</span>
                </div>
                <h3 style="margin-bottom:.35rem">{p.name}</h3>
                {#if p.description}
                  <p class="muted" style="margin:0">{p.description}</p>
                {:else}
                  <p class="subtle small" style="margin:0">No description</p>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="card card--mint empty">
            <h3>No projects yet</h3>
            <p>Create one using the form, then add its id to the upload command so the draft lands in that project.</p>
            <div class="term">
              <div class="term__bar" aria-hidden="true"><span></span><span></span><span></span></div>
              <pre><code><span class="prompt">$</span> agentdraft upload plan.md --project &lt;id&gt;</code></pre>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
