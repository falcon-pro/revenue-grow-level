<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import type { LayoutData } from './$types';
  export let data: LayoutData;
</script>
<div class="bg-gray-200 min-h-screen flex flex-col">
  <header class="bg-slate-700 text-white p-3 shadow-md">
    <div class="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
      <span class="text-lg font-semibold">Admin Dashboard</span>
      <div class="text-xs">
        {#if data.admin}
          <span>(Logged in as: {data.admin.id})</span>
          <form method="POST" action="/logout" class="inline ml-2 sm:ml-4">
            <button type="submit" class="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-xs">Logout</button>
          </form>
        {/if}
      </div>
    </div>
  </header>
  <main class="flex-grow container mx-auto p-2 sm:p-4 md:p-0 lg:p-0">
    <slot />
  </main>
  <footer class="text-center py-4 text-xs text-gray-500 border-t border-gray-200 bg-white">
    © {new Date().getFullYear()} Your Dashboard App
  </footer>
</div>