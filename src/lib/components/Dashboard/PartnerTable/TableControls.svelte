<!-- src/lib/components/Dashboard/PartnerTable/TableControls.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let searchTerm: string = ''; // Receives bound value from parent
  export let currentFilter: 'all' | 'recent' | 'active' | 'suspended' = 'all'; // Receives one-way prop from parent

  const dispatch = createEventDispatcher<{
    search: string;
    filterChange: typeof currentFilter;
  }>();

  // When a filter button is clicked, dispatch the event.
  // The parent (+page.svelte) will update its `activeFilter` state,
  // which will then flow back down into this component's `currentFilter` prop.
  function dispatchFilterChange(newFilterValue: typeof currentFilter) {
    if (currentFilter === newFilterValue && newFilterValue !== 'all') return; // 'all' can be re-clicked
    dispatch('filterChange', newFilterValue);
  }

  // For search, direct bind in parent works because input's bind:value updates parent's searchTerm
  // but dispatching an event on:input is also good practice if other logic needs to run immediately
  function onSearchValueInput(event: Event) {
    const target = event.target as HTMLInputElement;
    // searchTerm = target.value; // This updates the prop which is bound in parent.
    dispatch('search', target.value); // Parent handler will also update its `searchTerm`
  }

  const filterButtonBaseClasses = "px-2.5 py-1.5 text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors disabled:opacity-50";
  const filterButtonActiveClasses = "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500";
  const filterButtonInactiveClasses = "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400";
</script>

<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
  <div class="relative flex-grow sm:max-w-xs w-full">
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11A5.5 5.5 0 000-11zM2 9a7 7 0 0112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" /></svg>
    </div>
    <input
      type="search"
      id="tableSearchInput"
      bind:value={searchTerm} 
      on:input={onSearchValueInput}
      placeholder="Search partners..."
      class="form-input block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
    />
  </div>

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