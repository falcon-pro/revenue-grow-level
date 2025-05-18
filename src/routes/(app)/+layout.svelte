<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import type { LayoutData } from './$types';
  export let data: LayoutData; // Contains `admin` from the load function
</script>

<div class="bg-gray-200 min-h-screen">
  <header class="bg-slate-700 text-white p-3">
    Admin Section Header
    {#if data.admin}
      <span class="text-xs ml-4">(Logged in as: {data.admin.id})</span>
    {/if}
  </header>

  <div class="p-5">
    <slot />
  </div>

  <footer class="text-center p-3 bg-slate-700 text-white text-xs">
    Admin Footer
  </footer>
</div>