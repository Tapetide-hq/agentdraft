<script lang="ts">
  let { data, form } = $props();
</script>

<h1>Projects</h1>

<div class="card" style="max-width:520px">
  <h3>New project</h3>
  <form method="POST" action="?/create">
    <label for="name">Name</label>
    <input id="name" name="name" required />
    <label for="description">Description (optional)</label>
    <input id="description" name="description" />
    {#if form?.message}<p class="error">{form.message}</p>{/if}
    {#if form?.created}<p class="ok">Project created.</p>{/if}
    <div style="margin-top:1rem"><button class="btn" type="submit">Create</button></div>
  </form>
</div>

{#if data.projects.length > 0}
  <div class="grid">
    {#each data.projects as p}
      <div class="card">
        <div class="mono muted">{p.id}</div>
        <h3 style="margin:0.3rem 0">{p.name}</h3>
        {#if p.description}<p class="muted">{p.description}</p>{/if}
      </div>
    {/each}
  </div>
{:else}
  <p class="muted">No projects yet.</p>
{/if}
