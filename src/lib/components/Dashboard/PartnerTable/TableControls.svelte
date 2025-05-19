<!-- src/lib/components/Dashboard/PartnerTable/TableControls.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let searchTerm: string = '';
  export let currentFilter: 'all' | 'recent' | 'active' | 'suspended' = 'all'; // 'all' as a sensible default

  const dispatch = createEventDispatcher<{
    search: string;
    filterChange: typeof currentFilter;
  }>();

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchTerm = target.value;
    dispatch('search', searchTerm);
  }

  function applyFilter(newFilter: typeof currentFilter) {
    if (currentFilter === newFilter) return; // Avoid dispatching if filter is the same
    currentFilter = newFilter;
    dispatch('filterChange', currentFilter);
  }

  // Convenience mapping for button styling
  const filterButtonBaseClasses = "px-2.5 py-1.5 text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors";
  const filterButtonActiveClasses = "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500";
  const filterButtonInactiveClasses = "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400";

</script>

<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
  <!-- Search Input -->
  <div class="relative flex-grow sm:max-w-xs w-full">
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11A5.5 5.5 0 000-11zM2 9a7 7 0 0112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
      </svg>
    </div>
    <input
      type="search"
      id="tableSearchInput"
      bind:value={searchTerm}
      on:input={handleSearchInput}
      placeholder="Search partners..."
      class="form-input block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
    />
  </div>

  <!-- Filter Buttons -->
  <div class="flex items-center justify-center sm:justify-start space-x-2 flex-shrink-0">
    <span class="text-sm font-medium text-gray-600 hidden sm:inline">Filter:</span>
    <button
      on:click={() => applyFilter('all')}
      class="{filterButtonBaseClasses} {currentFilter === 'all' ? filterButtonActiveClasses : filterButtonInactiveClasses}"
    >All</button>
    <button
      on:click={() => applyFilter('active')}
      class="{filterButtonBaseClasses} {currentFilter === 'active' ? filterButtonActiveClasses : filterButtonInactiveClasses}"
    >Active</button>
    <button
      on:click={() => applyFilter('suspended')}
      class="{filterButtonBaseClasses} {currentFilter === 'suspended' ? filterButtonActiveClasses : filterButtonInactiveClasses}"
    >Suspended</button>
    <!-- 'Recent' filter needs more complex logic, add if desired (e.g., last 7 days created_at) -->
    <!-- <button on:click={() => applyFilter('recent')} class="filter-btn ...">Recent</button> -->
  </div>
</div>