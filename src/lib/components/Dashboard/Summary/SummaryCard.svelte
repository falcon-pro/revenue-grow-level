<!-- src/lib/components/Dashboard/Summary/SummaryCard.svelte -->
<script lang="ts">
  export let label: string = 'Label';
  export let value: string | number = '-';
  export let description: string = '';
  export let valueClasses: string = 'text-indigo-700'; // Default styling for the value
  export let iconHtml: string = ''; // Optional: for an SVG icon later
</script>

<div class="bg-white p-4 rounded-lg shadow border border-gray-200">
  <div class="flex items-center justify-between mb-1">
    <p class="text-sm font-medium text-gray-600">{label}</p>
    {#if iconHtml}
      {@html iconHtml} <!-- For simple SVG strings or later a slot for component -->
    {/if}
  </div>
  <p class="text-xl sm:text-2xl font-bold {valueClasses} truncate">{value}</p>
  {#if description}
    <p class="text-xs text-gray-500 truncate">{description}</p>
  {/if}
</div>