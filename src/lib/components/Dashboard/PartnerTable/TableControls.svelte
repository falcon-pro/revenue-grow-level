<!-- src/lib/components/Dashboard/PartnerTable/TableControls.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // Props received from the parent page
  export let searchTerm: string = ''; // Value controlled by parent for display
  export let currentFilter: 'all' | 'recent' | 'active' | 'suspended' = 'all'; // Value controlled by parent for display

  const dispatch = createEventDispatcher<{
    searchChange: string;    // Event when user types in search input
    filterChange: typeof currentFilter; // Event when a filter button is clicked
  }>();

  // When a filter button is clicked
  function dispatchFilterChange(newFilterValue: typeof currentFilter) {
    if (currentFilter === newFilterValue && newFilterValue !== 'all') return; // Avoid re-dispatching for same active filter (unless 'all')
    dispatch('filterChange', newFilterValue); // Tell parent the user wants to change the filter
  }

  // When the search input value changes (on every keystroke)
  function onSearchValueInput(event: Event) {
    const target = event.target as HTMLInputElement;
    dispatch('searchChange', target.value); // Dispatch the new search term to the parent
  }

  // Styling classes for buttons
  const filterButtonBaseClasses = "px-2.5 py-1.5 text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors disabled:opacity-50";
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
      value={searchTerm}
      on:input={onSearchValueInput} 
      placeholder="Search partners..."
      class="form-input block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
    />
  </div>

  <!-- Filter Buttons -->
  <div class="flex items-center justify-center sm:justify-start space-x-2 flex-shrink-0">
    <span class="text-sm font-medium text-gray-600 hidden sm:inline">Filter:</span>
    <button
      on:click={() => dispatchFilterChange('all')}
      class="{filterButtonBaseClasses} {currentFilter === 'all' ? filterButtonActiveClasses : filterButtonInactiveClasses}"
      disabled={currentFilter === 'all'}
    >All</button>
    <button
      on:click={() => dispatchFilterChange('active')}
      class="{filterButtonBaseClasses} {currentFilter === 'active' ? filterButtonActiveClasses : filterButtonInactiveClasses}"
      disabled={currentFilter === 'active'}
    >Active</button>
    <button
      on:click={() => dispatchFilterChange('suspended')}
      class="{filterButtonBaseClasses} {currentFilter === 'suspended' ? filterButtonActiveClasses : filterButtonInactiveClasses}"
      disabled={currentFilter === 'suspended'}
    >Suspended</button>
  </div>
</div>