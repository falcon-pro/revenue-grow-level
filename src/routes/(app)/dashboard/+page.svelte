<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
</script>

<h2 class="text-2xl font-semibold text-gray-800 mb-6">Dashboard Overview</h2>

{#if data.admin}
    <p class="mb-4 text-sm text-gray-600">Displaying data for: <strong>{data.admin.id}</strong></p>
{/if}

{#if data.partners}
  <PartnerTable partners={data.partners} />
{:else}
  <p class="text-red-500">Error: Partner data not available.</p>
{/if}

<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mt-6 mb-6" role="alert">
  <p class="font-bold">Note:</p>
  <p>Table columns are simplified for now. Full column display and functionality will be added next. Action buttons are placeholders.</p>
</div>