<!-- src/lib/components/Dashboard/Summary/SummaryCard.svelte -->
<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let change: string; // e.g., "+5.2%"
  export let icon: string | null;
  export let loading: boolean;
  export let trend: 'up' | 'down' | 'neutral' = 'up';

  const trendUpIcon = `<svg width="12" height="12" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" class="inline-block"><path d="M1 6L3.5 3.5L6 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const trendDownIcon = `<svg width="12" height="12" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" class="inline-block"><path d="M1 1L3.5 3.5L6 2L9 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  $: trendColor = trend === 'up' ? 'text-purple-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';
</script>

{#if loading}
  <!-- Loading Skeleton -->
  <div class="bg-[#161B22] p-5 rounded-xl border border-[#30363d] animate-pulse">
    <div class="flex justify-between items-start">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gray-700 rounded-lg"></div>
        <div class="w-20 h-5 bg-gray-700 rounded"></div>
      </div>
      <div class="w-12 h-5 bg-gray-700 rounded"></div>
    </div>
    <div class="h-9 w-1/2 bg-gray-700 rounded mt-4"></div>
  </div>
{:else}
  <!-- Actual Card -->
  <div class="bg-[#161B22] p-5 rounded-xl border border-[#30363d] transition-all hover:border-gray-600">
    <div class="flex justify-between items-start">
      <div class="flex items-center gap-3">
        {#if icon}
          <div class="bg-gray-800 p-2 rounded-lg text-gray-400">
            {@html icon}
          </div>
        {/if}
        <p class="text-sm font-medium text-gray-400">{label}</p>
      </div>

      {#if trend !== 'neutral'}
        <div class="flex items-center gap-1 text-sm font-semibold {trendColor}">
          {#if trend === 'up'}
            {@html trendUpIcon}
          {:else if trend === 'down'}
            {@html trendDownIcon}
          {/if}
          <span>{change}</span>
        </div>
      {/if}
    </div>
    <p class="text-3xl font-bold text-white mt-4">{value}</p>
  </div>
{/if}