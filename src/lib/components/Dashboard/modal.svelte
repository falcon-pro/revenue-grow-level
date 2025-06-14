<!-- Modal.svelte -->
<script>
  export let open = false;
  export let onClose = () => {};
</script>

{#if open}
  <div class="fixed inset-0 top-15 bg-blue-100 opacity-98 flex items-center justify-center z-10">
    <div class="bg-white p-6 rounded shadow-lg relative max-w-max-95">
      <button class="absolute top-3 right-2 cursor-pointer hover:bg-blue-200 bg-blue-200 p-3 rounded-full" on:click={onClose}>✖</button>
      <slot />
    </div>
  </div>
{/if}
