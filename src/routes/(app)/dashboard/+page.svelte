<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData; // From server load function
  export let form: ActionData; // From server actions (addPartner, editPartner, deletePartner via use:enhance)

  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import DeletePartnerModal from '$lib/components/Modals/DeletePartnerModal.svelte';
  import EditPartnerModal from '$lib/components/Modals/EditPartnerModal.svelte';
  import ImportModal from '$lib/components/Modals/ImportModal/ImportModal.svelte'; 

  import type { Database } from '../../../types/supabase'; // Adjust path if needed
  type PartnerType = Database['public']['Tables']['partners']['Row'];

  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  // Modal States
  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null;
  let showEditModal = false;
  let partnerToEdit: PartnerType | null = null;

  // Global Action Message State (for all actions on this page)
  let actionMessage: string | null = null;
  let actionSuccess: boolean = false;

   let showImportModal = false; // New state for Import Modal

  function openImportModal() {
    showImportModal = true;
  }
  function closeImportModal() {
    showImportModal = false;
    // TODO: Reset import modal state (parsed data, selections) when fully implemented
  }

  // --- Open/Close Modal Functions ---
  function openDeleteModal(partner: PartnerType) {
    partnerToDelete = partner;
    showDeleteModal = true;
  }
  async function closeDeleteModal() {
    const previousAction = form?.action; // Capture before modal closes and potentially clears form state
    const previousSuccess = form?.success;
    const previousMessage = form?.message;

    showDeleteModal = false;
    partnerToDelete = null;

    if (previousAction === '?/deletePartner' && previousSuccess === true) {
        actionMessage = previousMessage || 'Partner deleted successfully.';
        actionSuccess = true;
        await invalidateAll(); // Refresh list from server
        setTimeout(() => { actionMessage = null; }, 5000);
    }
  }

  function openEditModal(partner: PartnerType) {
    partnerToEdit = { ...partner }; // Use a copy for editing
    showEditModal = true;
  }
  async function closeEditModal() {
    const previousAction = form?.action;
    const previousSuccess = form?.success;
    const previousMessage = form?.message;

    showEditModal = false;
    partnerToEdit = null;

    if (previousAction?.startsWith('?/editPartner') && previousSuccess === true) {
        actionMessage = previousMessage || 'Partner updated successfully.';
        actionSuccess = true;
        await invalidateAll(); // Refresh list from server
        setTimeout(() => { actionMessage = null; }, 5000);
    }
  }

  // --- Handle Status Toggle with Optimistic Update ---
  async function handleTogglePartnerStatus(partnerToToggle: PartnerType) {
    if (!partnerToToggle || !partnerToToggle.id) {
        console.error("handleTogglePartnerStatus: Invalid partner data provided.");
        return;
    }

    const partnerIndex = data.partners.findIndex(p => p.id === partnerToToggle.id);
    if (partnerIndex === -1) {
        console.error("handleTogglePartnerStatus: Partner to toggle not found in local data.partners array.");
        actionMessage = "Error: Could not find partner to update locally.";
        actionSuccess = false;
        setTimeout(() => { actionMessage = null; }, 5000);
        return;
    }

    const originalStatus = data.partners[partnerIndex].account_status;
    const newStatus = originalStatus === 'active' ? 'suspended' : 'active';

    // 1. Optimistic UI Update
    // Create a new array to ensure Svelte's reactivity is triggered for the list
    const optimisticallyUpdatedPartners = data.partners.map((p, index) => {
        if (index === partnerIndex) {
            return { ...p, account_status: newStatus }; // Create a new partner object with the new status
        }
        return p;
    });
    data.partners = optimisticallyUpdatedPartners; // Assign new array to `data.partners`

    // Prepare form data for the server action
    const formData = new FormData();
    formData.append('partnerId', partnerToToggle.id);
    formData.append('currentStatus', originalStatus || 'active'); // Send the original status

    try {
        const response = await fetch('?/toggleAccountStatus', {
            method: 'POST',
            body: formData
        });

        // Check if response is ok before trying to deserialize
        if (!response.ok) {
            // Attempt to get error message from server if it's a SvelteKit fail() response
            let serverErrorMessage = 'Failed to update status. Server responded unexpectedly.';
            try {
                const errorResult = deserialize(await response.text());
                if (errorResult.type === 'failure' && errorResult.data?.message) {
                    serverErrorMessage = errorResult.data.message;
                } else if (errorResult.type === 'error' && errorResult.error?.message) {
                     serverErrorMessage = errorResult.error.message;
                }
            } catch (e) { /* ignore deserialize error if response wasn't SvelteKit action format */ }

            throw new Error(serverErrorMessage); // Throw to be caught by catch block
        }

        const result = deserialize(await response.text());

        if (result.type === 'success' && result.data?.data?.success === true) {
            actionMessage = result.data.data.message || 'Status updated successfully!';
            actionSuccess = true;
            // UI was already updated optimistically. Now call invalidateAll to sync with server.
            await invalidateAll(); // Confirms and fetches latest full state from server.
        } else {
            // Server action itself indicated failure (e.g., from a fail() call in action)
            const errorMessage = result.data?.data?.message || result.data?.message || 'Failed to update status on server.';
            throw new Error(errorMessage); // Throw to be caught by catch block for revert
        }

    } catch (err: any) {
        console.error("Error during toggle status or server rejected:", err);
        actionMessage = err.message || 'An error occurred while updating status.';
        actionSuccess = false;

        // --- Revert optimistic update on any failure (network, server fail(), server error) ---
        const revertedPartners = data.partners.map((p, index) => {
            if (index === partnerIndex) {
                return { ...p, account_status: originalStatus }; // Revert to original status
            }
            return p;
        });
        data.partners = revertedPartners; // Assign new array to trigger reactivity
    }

    // Clear message after a few seconds
    if (actionMessage) {
       setTimeout(() => { actionMessage = null; }, 5000);
    }
  }

  // --- Handle messages from standard (add/edit) form submissions ---
  // These submissions update the `form` prop directly via SvelteKit's default form handling
  $: if (form && form.message && (form.action === '?/addPartner' || form.action?.startsWith('?/editPartner'))) {
    if (form.message !== actionMessage) { // Avoid re-displaying the same message if `form` reference changes for other reasons
        actionMessage = form.message;
        actionSuccess = form.success === true;
        if (form.success) {
            // For add/edit, if modal doesn't auto-close and invalidate, do it here
            // But our closeEditModal and closeDeleteModal already handle invalidation on success
            if (form.action === '?/addPartner') {
                invalidateAll(); // For 'addPartner', always invalidate to show the new item
            }
        }
        setTimeout(() => { actionMessage = null; }, 5000);
    }
  }
</script>

<div class="space-y-8 p-4 md:p-6 lg:p-8">

  <!-- Global Action Message Display -->
  {#if actionMessage}
    <div
      class="p-4 mb-6 rounded-md text-sm border {actionSuccess
        ? 'bg-green-50 text-green-700 border-green-300'
        : 'bg-red-50 text-red-700 border-red-300'}"
      role="alert"
    >
      <p class="font-medium">{actionSuccess ? 'Success!' : (actionMessage.startsWith('Error:') ? '' : 'Error!')}</p>
      <p>{actionMessage}</p>
    </div>
  {/if}

  <div>
    <h2 class="text-xl md:text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <PartnerForm
      formAction="?/addPartner"
      submitButtonText="Add Partner Entry"
      serverErrors={form?.action === '?/addPartner' ? form : null} 
    />
  </div>

  <hr class="my-8 border-gray-300" />

   <div>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <h2 class="text-xl md:text-2xl font-semibold text-gray-800 whitespace-nowrap">Partner Records</h2>
        <div class="flex space-x-2">
            <button
                type="button"
                on:click={openImportModal}
                class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
                Import Data
            </button>
        </div>
    </div>

    {#if data.admin}
      <p class="mb-4 text-sm text-gray-600">Currently managing records for: <strong>{data.admin.id}</strong></p>
    {/if}

    {#if data.partners === undefined || data.partners === null}
      <TableSkeleton rows={5} columns={16}/>
      <p class="text-center text-gray-500 mt-4">Loading partners...</p>
    {:else if data.partners.length > 0}
      <PartnerTable
        partners={data.partners}
        on:requestDelete={(event) => openDeleteModal(event.detail as PartnerType)}
        on:requestEdit={(event) => openEditModal(event.detail as PartnerType)}
        on:requestToggleStatus={(event) => handleTogglePartnerStatus(event.detail as PartnerType)}
      />
    {:else}
      <PartnerTable partners={[]} />
       <p class="text-center text-gray-500 py-8 italic">
            No partners have been added for this account yet. Use the form above to add one.
        </p>
    {/if}
  </div>
</div>

<!-- Modal Instances -->
{#if partnerToDelete && showDeleteModal}
  <DeletePartnerModal bind:showModal={showDeleteModal} partnerName={partnerToDelete.name} partnerId={partnerToDelete.id} on:close={closeDeleteModal} />
{/if}
{#if partnerToEdit && showEditModal}
  <EditPartnerModal bind:showModal={showEditModal} partnerToEdit={partnerToEdit} formResult={form} on:close={closeEditModal} />
{/if}

<!-- Import Modal Instance -->
<ImportModal bind:showModal={showImportModal} on:close={closeImportModal} />