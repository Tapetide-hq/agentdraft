<script lang="ts">
  import Seo from "$lib/Seo.svelte";
  let { data, form } = $props();
</script>

<Seo title="Projects — agentdraft" description="Group drafts by repo, service, or agent fleet." path="/projects" noindex />

<h1>PROJECTS<span class="accent">.</span></h1>
<p class="subtle">Group drafts by repo, service, or agent fleet.</p>

<div class="panel panel--accent" style="max-width:32rem">
  <div class="panel__head">new project</div>
  <div class="panel__body">
    <form method="POST" action="?/create">
      <label for="name">Name</label>
      <input id="name" name="name" required />
      <label for="description">Description</label>
      <input id="description" name="description" />
      {#if form?.message}<p class="error">{form.message}</p>{/if}
      {#if form?.created}<p class="ok">Project created.</p>{/if}
      <div style="margin-top:1.15rem"><button class="btn" type="submit">Create</button></div>
    </form>
  </div>
</div>

{#if data.projects.length > 0}
  <div class="grid">
    {#each data.projects as p}
      <div class="card">
        <div class="mono subtle" style="font-size:12px">{p.id}</div>
        <h3 style="margin:.4rem 0">{p.name}</h3>
        {#if p.description}<p class="muted" style="margin:0">{p.description}</p>{/if}
      </div>
    {/each}
  </div>
{:else}
  <p class="subtle">No projects yet.</p>
{/if}
