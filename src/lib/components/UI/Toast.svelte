<!-- src/lib/components/UI/Toast.svelte -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { removeToast, type ToastMessage } from '$lib/stores/toastStore';

  export let toast: ToastMessage;

  let timer: number | undefined = undefined;

  // This component self-removes if duration was managed externally (less common with current store)
  // The store already handles timed removal. This is a fallback or for manual removal.
  function dismiss() {
    removeToast(toast.id);
  }

  // Style mapping for different toast types
  const typeClasses = {
    success: 'bg-green-500 border-green-600',
    error: 'bg-red-500 border-red-600',
    info: 'bg-blue-500 border-blue-600',
    warning: 'bg-yellow-500 border-yellow-600'
  };

  // Icon mapping (using simple text, could be SVGs)
  const typeIcons = {
    success: '✅', // ✔️
    error: '❌',   // ❎
    info: 'ℹ️',
    warning: '⚠️'
  };

</script>

<div
  in:fly={{ y: -20, duration: 300, delay: 50 }}
  out:fade={{ duration: 200 }}
  class="relative flex items-start p-4 mb-3 rounded-md shadow-lg text-white border-l-4 {typeClasses[toast.type]}"
  role="alert"
>
  <div class="flex-shrink-0 text-xl mr-3">
    <span>{typeIcons[toast.type]}</span>
  </div>
  <div class="flex-grow">
    <p class="text-sm font-medium">{toast.message}</p>
  </div>
  <div class="ml-4 flex-shrink-0">
    <button
      on:click={dismiss}
      class="-mx-1.5 -my-1.5 bg-transparent rounded-md p-1.5 inline-flex text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-current focus:ring-white"
    >
      <span class="sr-only">Dismiss</span>
      <!-- Heroicon name: x-mark -->
      <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
      </svg>
    </button>
  </div>
</div>