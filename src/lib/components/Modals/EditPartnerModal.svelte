<!-- src/lib/components/Modals/EditPartnerModal.svelte -->
<script lang="ts">
  import ModalBase from '$lib/components/UI/ModalBase.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import type { Database } from '../../../types/supabase'; // Adjust path if necessary
  type PartnerRow = Database['public']['Tables']['partners']['Row'];
  import { createEventDispatcher, afterUpdate } from 'svelte';
  import type { ActionData } from '../../../routes/(app)/dashboard/$types'; // For form prop type from page

  export let showModal: boolean = false;
  export let partnerToEdit: PartnerRow | null = null;
  // `formResult` will be bound to the page's `form` store, which updates after any action
  // We need to check if the action that updated `form` was for *this specific* edit form
  export let formResult: ActionData | undefined | null = null;

  const dispatch = createEventDispatcher();

  let currentFormAction = ''; // To track the action for filtering formResult.errors
  let partnerFormKey = 0; // To force re-mount of PartnerForm if partnerToEdit changes drastically

  $: {
    if (partnerToEdit?.id) {
      currentFormAction = `?/editPartner&id=${partnerToEdit.id}`;
      // Increment key to re-initialize PartnerForm when a new partner is selected for editing
      // This ensures onMount in PartnerForm correctly populates with new partner data
      partnerFormKey = Date.now(); // Simple key change
    } else {
      currentFormAction = '?/editPartner'; // Fallback
    }
  }

  function close() {
    dispatch('close');
  }

  // When modal closes, also clear any errors that might have been for this modal's form submission
  // This is a bit broad, better handling would be action-specific error clearing
  afterUpdate(() => {
      if (!showModal) {
          // Consider how to clear 'formResult' or its errors relevant to this modal.
          // Usually, 'form' on the page updates globally.
      }
  });

</script>

<ModalBase bind:showModal title="Edit Partner Details & Revenue" on:close={close} modalSize="5xl">
  <div slot="body">
    {#if partnerToEdit && showModal} <!-- Added showModal check here -->
      {#key partnerFormKey} <!-- Re-mount PartnerForm when partnerToEdit changes -->
        <PartnerForm
          partner={partnerToEdit}
          formAction={currentFormAction}
          submitButtonText="Update Partner"
          serverErrors={formResult?.action === currentFormAction ? formResult?.errors : null}
        />
      {/key}
    {:else}
      <p class="text-center text-gray-500 py-10">Loading partner data or no partner selected...</p>
    {/if}
  </div>
</ModalBase>