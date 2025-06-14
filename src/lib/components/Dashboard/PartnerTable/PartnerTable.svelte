<script lang="ts">
  import type { Database } from '../../../../types/supabase'; // Adjust path
  type Partner = Database['public']['Tables']['partners']['Row'];
  export type SortableColumnKey = keyof Partner | 'effectiveRevenue' | 'revenuePeriodRange' | 'latestPayStatus';

  // This will become PartnerCard.svelte conceptually
  import PartnerTableRow from './PartnerTableRow.svelte'; 
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition'; // For smoother appearance of cards

  export let partners: Partner[] = [];
  export let sortColumn: SortableColumnKey | null = 'created_at';
  export let sortDirection: 'asc' | 'desc' = 'desc';

  $: console.log('[PartnerTable.svelte - Card Mode] Props:', sortColumn, sortDirection);

  const dispatch = createEventDispatcher<{ 
    requestSort: SortableColumnKey;
    requestDelete: Partner;
    requestEdit: Partner;
    requestToggleStatus: Partner;
  }>();

  // Redefine columns slightly for sorting UI, as they won't be table headers.
  // We'll primarily use sortable ones for the UI.
  interface SortOption {
    key: SortableColumnKey;
    label: string;
  }

  const sortOptions: SortOption[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'created_at', label: 'Added On' },
    { key: 'account_start', label: 'Start Date' },
    { key: 'revenuePeriodRange', label: 'Rev. Period' },
    { key: 'effectiveRevenue', label: 'Disp. Revenue' },
    { key: 'latestPayStatus', label: 'Pay Status' },
    { key: 'account_status', label: 'Acc. Status' },
  ];

 function requestSort(columnKey: SortableColumnKey) {
    dispatch('requestSort', columnKey);
  }
</script>

{#if partners.length === 0}
  <div class="border border-slate-200/80 rounded-xl shadow-lg overflow-hidden p-8 sm:p-12 bg-white text-center">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="currentColor" class="w-20 h-20 mx-auto mb-6 text-slate-400">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75s.168-.75.375-.75S9.75 9.336 9.75 9.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
    </svg>
    <h3 class="text-xl font-semibold text-slate-700 mb-2">No Partners Found</h3>
    <p class="text-slate-500">
      It looks like there are no partners to display. Try adding a new partner or adjusting your filters.
    </p>
  </div>
{:else}
  <div class="space-y-6">
    <!-- Sorting Controls -->
    <div class="bg-white p-4 rounded-lg shadow sticky top-0 z-0 border border-slate-200/60">
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
            <span class="text-sm font-medium text-slate-600 mr-2">Sort by:</span>
            {#each sortOptions as option (option.key)}
                <button
                    on:click={() => requestSort(option.key)}
                    class="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-150 ease-in-out
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sky-500
                           {sortColumn === option.key 
                              ? 'bg-sky-600 text-white shadow-sm hover:bg-sky-700' 
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 hover:border-slate-300'}"
                    title={`Sort by ${option.label} (${sortColumn === option.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'neutral'})`}
                    aria-pressed={sortColumn === option.key}
                >
                    <div class="flex items-center">
                        {option.label}
                        {#if sortColumn === option.key}
                            <span class="ml-1.5">
                                {#if sortDirection === 'asc'}
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5"><path fill-rule="evenodd" d="M10 5a.75.75 0 01.75.75v6.638l1.96-2.158a.75.75 0 111.118 1.004l-3.25 3.5a.75.75 0 01-1.118 0l-3.25-3.5a.75.75 0 111.118-1.004l1.96 2.158V5.75A.75.75 0 0110 5z" clip-rule="evenodd" /></svg>
                                {:else}
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5"><path fill-rule="evenodd" d="M10 15a.75.75 0 01-.75-.75V7.612l-1.96 2.158a.75.75 0 11-1.118-1.004l3.25-3.5a.75.75 0 011.118 0l3.25 3.5a.75.75 0 11-1.118-1.004l-1.96-2.158v6.638A.75.75 0 0110 15z" clip-rule="evenodd" /></svg>
                                {/if}
                            </span>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>
    </div>

    <!-- Partner Cards Grid -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {#each partners as partner (partner.id)}
        <div in:slide|local={{ duration: 250, delay: 50 * partners.indexOf(partner) % 500 }} out:slide|local={{ duration: 150 }}>
          <PartnerTableRow 
            {partner}
            on:requestDelete={(event) => dispatch('requestDelete', event.detail)}
            on:requestEdit={(event) => dispatch('requestEdit', event.detail)}
            on:requestToggleStatus={(event) => dispatch('requestToggleStatus', event.detail)}
          />
        </div>
      {/each}
    </div>
  </div>
{/if}