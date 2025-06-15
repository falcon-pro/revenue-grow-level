<!-- src/lib/components/UI/ModalBase.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition'; // Svelte's built-in transition

  export let showModal: boolean = false;
  export let title: string = 'Modal Title';
  export let modalSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' = 'md';

  const dispatch = createEventDispatcher();

  function closeModal() {
      dispatch('close');
  }

  // Handle Escape key to close modal
  function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
          closeModal();
      }
  }

  onMount(() => {
      if (typeof window !== 'undefined') window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeydown);
  });

  const sizeClasses = {
      sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl', '4xl': 'max-w-4xl', '5xl': 'max-w-5xl', '6xl': 'max-w-6xl', '7xl': 'max-w-7xl'
  };
</script>

{#if showModal}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
    on:click|self={closeModal} 
    transition:fade={{ duration: 150 }}
  >
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-gray-500 bg-opacity-0.8 transition-opacity" aria-hidden="true"></div>

    <!-- Modal Panel -->
    <div class="relative bg-white rounded-lg shadow-xl transform transition-all sm:my-8 w-full {sizeClasses[modalSize]} flex flex-col max-h-[90vh]">
      <!-- Modal Header -->
      <div class="bg-gray-50 px-4 py-3 sm:px-6 border-b border-gray-200 flex justify-between items-center rounded-t-lg">
        <h3 class="text-lg font-medium leading-6 text-gray-900" id="modal-title">
          <slot name="header">{title}</slot>
        </h3>
        <button
          type="button"
          on:click={closeModal}
          class="text-gray-400 hover:text-gray-500 focus:outline-none"
          aria-label="Close modal"
        >
          <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="px-4 py-5 sm:p-6 overflow-y-auto flex-grow">
        <slot name="body">Modal content goes here.</slot>
      </div>

      <!-- Modal Footer (Optional) -->
      {#if $$slots.footer}
        <div class="whitespace-nowrap bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg border-t border-gray-200">
          <slot name="footer"></slot>
        </div>
      {/if}
    </div>
  </div>
{/if}