<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData; // Contains `partners` from the load function

  // $: console.log('Dashboard page Svelte data:', data); // For browser console debugging
</script>

<h2 class="text-2xl font-semibold text-gray-800 mb-6">Dashboard Overview</h2>

{#if data.partners && data.partners.length > 0}
  <h3 class="text-lg font-medium mb-2">Partners for Admin ID: {data.admin?.id || 'N/A'} ({data.partners.length})</h3>
  <pre class="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
    {JSON.stringify(data.partners, null, 2)}
  </pre>
{:else if data.partners}
  <p class="text-gray-600">No partners found for this admin.</p>
{:else}
  <p class="text-red-500">Error loading partners or data not available.</p>
{/if}

<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mt-6 mb-6" role="alert">
  <p class="font-bold">Work in Progress!</p>
  <p>Proper table display will be implemented next.</p>
</div>