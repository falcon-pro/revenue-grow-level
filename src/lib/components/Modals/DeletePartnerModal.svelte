<!-- src/lib/components/Modals/DeletePartnerModal.svelte -->
<script lang="ts">
  import ModalBase from '$lib/components/UI/ModalBase.svelte';
  import { createEventDispatcher, onMount } from 'svelte'; // onMount to reset isLoading
  import { enhance } from '$app/forms'; // For progressive enhancement
  import type { SubmitFunction } from '@sveltejs/kit';


  export let showModal: boolean = false;
  export let partnerName: string | null | undefined = 'this partner';
  export let partnerId: string | null = null;

  let isLoading = false;
  let formElement: HTMLFormElement; // To manually reset the form if needed

  const dispatch = createEventDispatcher();

  function close() {
    if (isLoading) return;
    dispatch('close');
  }

  const handleSubmit: SubmitFunction = () => {
    isLoading = true;
    return async ({ result, update }) => {
      // `result` contains the data returned by the server 'deletePartner' action
      // `update` is a function to force SvelteKit to re-run load functions
      if (result.type === 'success' || result.type === 'failure') {
          // If using invalidate to refresh list, do it here
          // await update({ reset: false, invalidateAll: false }); // Or specific invalidation
          // For now, just handling isLoading and closing
      }
      isLoading = false;
      if (result.type === 'success') {
          close(); // Close modal on successful deletion
      }
      // Error messages from `fail` will be handled by the page's `form` prop for delete actions
      // We might need a dedicated place for delete action messages if not using `form` for that.
      await update(); // Call update to apply form action result to the page's `form` store
    };
  };

  // Reset isLoading when modal is shown again (e.g. if previous attempt failed but modal wasn't closed)
  $: if (showModal) {
      isLoading = false;
  }

</script>

<ModalBase bind:showModal title="Confirm Deletion" on:close={close} modalSize="md">
  <div slot="body">
    <div class="sm:flex sm:items-start">
      <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
        <svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
        <h3 class="text-lg font-medium leading-6 text-gray-900" id="modal-title-delete">
          Delete {partnerName || 'Partner'}?
        </h3>
        <div class="mt-2">
          <p class="text-sm text-gray-500">
            Are you sure you want to delete <strong>{partnerName || 'this partner'}</strong>?
            This action cannot be undone.
          </p>
        </div>
      </div>
    </div>
  </div>

  <div slot="footer" class="flex flex-row-reverse gap-x-3">
    <!-- Progressive Enhancement: `use:enhance` will handle the form submission with JS -->
    <form method="POST" action="?/deletePartner" use:enhance={handleSubmit} bind:this={formElement}>
      <input type="hidden" name="partnerId" value={partnerId || ''} />
      <button
        type="submit"
        disabled={isLoading}
        class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:opacity-50"
      >
        {#if isLoading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Deleting...
        {:else}
            Delete Partner
        {/if}
      </button>
    </form>
    <button
      type="button"
      disabled={isLoading}
      on:click={close}
      class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
    >
      Cancel
    </button>
  </div>
</ModalBase>