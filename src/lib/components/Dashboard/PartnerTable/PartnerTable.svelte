<!-- src/lib/components/Dashboard/PartnerTable/PartnerTable.svelte -->
<script lang="ts">
  import type { tables } from '$lib/utils/types'; // Assuming you'll create this for partner type
  // Or use the generated Supabase type if available and convenient
  // import type { Database } from '../../../types/supabase';
  // type Partner = Database['public']['Tables']['partners']['Row'];
  // For now, let's use a generic type or 'any' if types.ts is not set up yet
  // For simplicity right now if types.ts doesn't have 'tables.partner':
  type Partner = any;


  import PartnerTableRow from './PartnerTableRow.svelte';

  export let partners: Partner[] = [];
</script>

{#if partners.length === 0}
  <p class="text-center text-gray-500 py-8 italic">
    No partners found for this admin or matching current filters.
  </p>
{:else}
  <div class="table-wrapper border border-gray-200 rounded-lg shadow-sm overflow-hidden">
    <div class="table-container overflow-x-auto max-h-[calc(100vh-300px)]">
      <table class="min-w-full divide-y divide-gray-200">
<thead class="bg-gray-50 sticky top-0 z-10">
  <tr>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[150px]">Name</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Mobile</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">Email</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">Address</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Webmoney</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Multi Acc</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Ad Link</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Ad Email Link</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">API Key</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Added On</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Start Date</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[140px]">Rev Period Range</th>
    <th scope="col" class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[190px]">Displayed Revenue</th>
    <th scope="col" class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Latest Pay Status</th>
    <th scope="col" class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Acc Status</th>
    <th scope="col" class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Actions</th>
  </tr>
</thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each partners as partner (partner.id)}
            <PartnerTableRow {partner} />
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}