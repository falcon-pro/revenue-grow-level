<!-- src/lib/components/UI/ToastContainer.svelte -->
<script lang="ts">
  import { toastMessages } from '$lib/stores/toastStore';
  import Toast from './Toast.svelte';
</script>

{#if $toastMessages.length > 0}
  <div
    aria-live="assertive"
    class="fixed inset-0 flex flex-col items-end justify-start px-4 py-6 pointer-events-none sm:p-6 sm:items-end sm:justify-start z-[100]"
  >
    <div class="w-full max-w-sm space-y-3">
      {#each $toastMessages as toast (toast.id)}
        <Toast {toast} />
      {/each}
    </div>
  </div>
{/if}