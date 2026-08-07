<script lang="ts">
  // Per-page SEO head tags.
  //
  // Indexing policy, deliberately narrow: ONLY the public marketing/docs surface is
  // indexable. Authenticated pages (dashboard, projects, keys, draft detail) pass
  // noindex, and PUBLISHED DOCUMENTS are noindex at the content worker itself. Letting
  // user-generated documents into search results invites spam, phishing and accidental
  // data exposure, and `noindex` is not access control — it is only a crawler hint.
  interface Props {
    title: string;
    description: string;
    path?: string;
    noindex?: boolean;
  }
  let { title, description, path = "/", noindex = false }: Props = $props();

  const SITE = "https://app.agentdraft.tapetide.com";
  const canonical = `${SITE}${path}`;
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />

  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {:else}
    <meta name="robots" content="index, follow" />
  {/if}

  <!-- Open Graph / Twitter: drives how the link renders when someone shares the repo
       or the tool in a chat, which is a real discovery channel for developer tools. -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="agentdraft" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>
