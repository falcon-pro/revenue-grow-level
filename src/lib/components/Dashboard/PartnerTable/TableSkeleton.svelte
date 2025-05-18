<!-- src/lib/components/Dashboard/PartnerTable/TableSkeleton.svelte -->
<script lang="ts">
  import Skeleton from '$lib/components/UI/Skeleton.svelte';
  export let rows: number = 5; // Number of skeleton rows to display
  export let columns: number = 16; // Match your actual number of table columns
</script>

<div class="table-wrapper border border-gray-200 rounded-lg shadow-sm overflow-hidden">
  <div class="table-container overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200 animate-pulse">
      <thead class="bg-gray-50">
        <tr>
          {#each Array(columns) as _, i}
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <Skeleton height="10px" width={i === 0 || i === 2 ? "120px" : (i === columns -1 ? "80px" : "80px")} className="opacity-50" />
            </th>
          {/each}
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#each Array(rows) as _}
          <tr>
            {#each Array(columns) as _, i}
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                <Skeleton height="12px" width={i === 0 ? "140px" : ( i === 2 ? "160px" : "70px")} />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>