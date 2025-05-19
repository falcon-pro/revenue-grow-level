<!-- src/lib/components/Dashboard/PartnerTable/PartnerTable.svelte -->
<script lang="ts">
  import type { Database } from '../../../../types/supabase'; // Adjust path
  type Partner = Database['public']['Tables']['partners']['Row'];
  type SortableColumnKey = keyof Partner | 'effectiveRevenue' | 'revenuePeriodRange' | 'latestPayStatus';


  import PartnerTableRow from './PartnerTableRow.svelte';
  import { createEventDispatcher } from 'svelte';

  export let partners: Partner[] = [];
  export let sortColumn: SortableColumnKey | null = 'created_at';
  export let sortDirection: 'asc' | 'desc' = 'desc';

  $: console.log('[PartnerTable.svelte] Received props - sortColumn:', sortColumn, 'sortDirection:', sortDirection);


  const dispatch = createEventDispatcher<{ requestSort: SortableColumnKey }>(); // Typed dispatch

  interface ColumnDefinition {
    key: SortableColumnKey;
    label: string;
    sortable: boolean;
    classes?: string; // For min-width, text-align, etc.
    thClasses?: string; // Specific for TH if different
    tdClasses?: string; // Specific for TD (used in PartnerTableRow usually)
  }

  // Define your columns here to make the header row dynamic
  const columns: ColumnDefinition[] = [
    { key: 'name', label: 'Name', sortable: true, classes: 'min-w-[150px]' },
    { key: 'mobile', label: 'Mobile', sortable: false, classes: 'min-w-[120px]' },
    { key: 'email', label: 'Email', sortable: true, classes: 'min-w-[180px]' },
    { key: 'address', label: 'Address', sortable: false, classes: 'min-w-[180px]' },
    { key: 'webmoney', label: 'Webmoney', sortable: false, classes: 'min-w-[110px]' },
    { key: 'multi_account_no', label: 'Multi Acc', sortable: false, classes: 'min-w-[110px]' },
    { key: 'adstera_link', label: 'Ad Link', sortable: false, classes: 'min-w-[120px]' },
    { key: 'adstera_email_link', label: 'Ad Email', sortable: false, classes: 'min-w-[120px]' },
    { key: 'adstera_api_key', label: 'API Key', sortable: false, classes: 'min-w-[120px]' },
    { key: 'created_at', label: 'Added On', sortable: true, classes: 'min-w-[160px]' },
    { key: 'account_start', label: 'Start Date', sortable: true, classes: 'min-w-[160px]' },
    { key: 'revenuePeriodRange', label: 'Rev Period', sortable: true, classes: 'min-w-[140px]' },
    { key: 'effectiveRevenue', label: 'Disp. Revenue', sortable: true, classes: 'min-w-[190px]' },
    { key: 'latestPayStatus', label: 'Latest Pay Status', sortable: true, classes: 'min-w-[110px] text-center' },
    { key: 'account_status', label: 'Acc Status', sortable: true, classes: 'min-w-[110px] text-center' },
    { key: 'actions', label: 'Actions', sortable: false, classes: 'min-w-[120px] text-right' },
  ];

 function requestSort(columnKey: SortableColumnKey) { // Make sure columnKey is typed
    if (!columns.find(c => c.key === columnKey)?.sortable) return;
    dispatch('requestSort', columnKey); // Dispatch with the key
  }
  
</script>

{#if partners.length === 0}
  <div class="border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
    <p class="text-center text-gray-500 italic">
      No partners found.
    </p>
  </div>
{:else}
  <div class="table-wrapper border border-gray-200 rounded-lg shadow-sm overflow-hidden">
    <div class="table-container overflow-x-auto max-h-[calc(100vh-400px)]">
      <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-100 sticky top-0 z-10 shadow-sm">
  <tr>
    {#each columns as col (col.key)}
      <th
        scope="col"
        class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap {col.classes || ''} {col.thClasses || ''} {col.sortable ? 'cursor-pointer hover:bg-gray-200 transition-colors' : ''}"
        on:click={() => col.sortable && requestSort(col.key)}
        title={col.sortable ? `Click to sort by ${col.label}` : col.label}
        aria-sort={col.sortable && sortColumn === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <div class="flex items-center">
          <span>{col.label}</span>
          <!-- THIS IS THE CRITICAL PART FOR THE INDICATOR -->
          {#if col.sortable && sortColumn === col.key}
            <span class="ml-1.5 text-gray-600">
              {#if sortDirection === 'asc'}▲{:else}▼{/if}
            </span>
          {/if}
        </div>
      </th>
    {/each}
  </tr>
</thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each partners as partner (partner.id)}
            <PartnerTableRow
              {partner}
              on:requestDelete={(event) => dispatch('requestDelete', event.detail)}
              on:requestEdit={(event) => dispatch('requestEdit', event.detail)}
              on:requestToggleStatus={(event) => dispatch('requestToggleStatus', event.detail)}
            />
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}