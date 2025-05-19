<!-- src/lib/components/Dashboard/Summary/SummaryCard.svelte -->
<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let description: string = '';
  export let trend: 'up' | 'down' | 'neutral' = 'neutral';
  export let loading: boolean = false;
  export let icon: string | null = null;
  
  // Dynamic value coloring based on trend
  $: valueColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-indigo-600';
</script>

<div class="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 hover:border-indigo-100 group">
  <div class="flex justify-between items-start mb-3">
    <div>
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      {#if loading}
        <div class="h-8 w-3/4 mt-2 bg-gray-200 rounded animate-pulse"></div>
      {:else}
        <p class={`text-2xl font-bold mt-1 ${valueColor} transition-colors duration-200`}>
          {value}
          {#if trend !== 'neutral'}
            <span class="ml-2 text-sm inline-flex items-center">
              {#if trend === 'up'}
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M12 7a1 1 0 01-1 1H9v1h2a1 1 0 110 2H9v1h2a1 1 0 110 2H9v1a1 1 0 11-2 0v-1H5a1 1 0 110-2h2v-1H5a1 1 0 110-2h2V8H5a1 1 0 010-2h2V5a1 1 0 112 0v1h2a1 1 0 011 1z" clip-rule="evenodd"/>
                </svg>
              {:else}
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clip-rule="evenodd"/>
                </svg>
              {/if}
            </span>
          {/if}
        </p>
      {/if}
    </div>
    
    {#if icon}
      <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors duration-200">
        {@html icon}
      </div>
    {/if}
  </div>
  
  {#if description && !loading}
    <p class="text-xs text-gray-500 mt-2 truncate">{description}</p>
  {:else if loading}
    <div class="h-4 w-full mt-2 bg-gray-200 rounded animate-pulse"></div>
  {/if}
</div>