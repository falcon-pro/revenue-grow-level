<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import type { LayoutData } from './$types';
  export let data: LayoutData;
</script>

<div class="bg-gray-200 min-h-screen flex flex-col">
  <header class="bg-slate-700 text-white p-3">
    <div class="container mx-auto flex justify-between items-center">
      <span class="text-lg font-semibold">Admin Section</span>
      <div>
        {#if data.admin}
          <span class="text-xs mr-4">(Logged in as: {data.admin.id})</span>
          <form method="POST" action="/logout" class="inline">
            <button type="submit" class="text-xs bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded">
              Logout
            </button>
          </form>
        {/if}
      </div>
    </div>
  </header>

  <div class="p-5">
    <slot />
  </div>

  <footer class="text-center p-3 bg-slate-700 text-white text-xs">
    Admin Footer
  </footer>
</div>