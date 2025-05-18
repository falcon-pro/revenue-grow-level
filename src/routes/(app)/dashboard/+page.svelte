<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import { navigating } from '$app/stores'; // SvelteKit store for navigation state

  // $: console.log('Navigating state:', $navigating); // For observing navigation
</script>

<h2 class="text-2xl font-semibold text-gray-800 mb-6">Dashboard Overview</h2>

{#if data.admin}
    <p class="mb-4 text-sm text-gray-600">Displaying data for: <strong>{data.admin.id}</strong></p>
{/if}

<!--
  SvelteKit's default data loading means `data.partners` will be available once the page renders
  after the `load` function in `+page.server.ts` completes.
  The `$navigating` store is true when SvelteKit is fetching data for a new page *during client-side navigation*.
  For initial load, the skeleton might not be visible for long unless data fetching is slow.
  We use `data.partners` being potentially undefined before load completes.
-->
{#if $navigating && !$navigating.to?.data?.partners }
  <!-- Show skeleton if navigating to this page and new partner data isn't yet available in the navigation target -->
  <TableSkeleton rows={5} columns={16}/>
{:else if data.partners }
  <PartnerTable partners={data.partners} />
{:else if !$navigating}
  <!-- Only show "Error" if not navigating and partners are still undefined/null -->
  <p class="text-red-500 p-4 bg-red-50 rounded-md">
    Error: Partner data not available or failed to load.
  </p>
{/if}


<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mt-6 mb-6" role="alert">
  <p class="font-bold">Note:</p>
  <p>Table columns are simplified for now. Full column display and functionality will be added next. Action buttons are placeholders.</p>
</div>