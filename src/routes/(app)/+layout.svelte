<!-- src/routes/(app)/+layout.svelte -->
<div class="bg-gray-200 min-h-screen">
  <header class="bg-slate-700 text-white p-3">
    Admin Section Header
  </header>

  <div class="p-5">
    <slot /> <!-- Page content will go here -->
  </div>

  <footer class="text-center p-3 bg-slate-700 text-white text-xs">
    Admin Footer
  </footer>
</div>