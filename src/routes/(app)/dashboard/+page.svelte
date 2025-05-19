<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;

  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import DeletePartnerModal from '$lib/components/Modals/DeletePartnerModal.svelte';
  import EditPartnerModal from '$lib/components/Modals/EditPartnerModal.svelte';
  import ImportModal from '$lib/components/Modals/ImportModal/ImportModal.svelte';

  import type { Database } from '../../../types/supabase';
  type PartnerType = Database['public']['Tables']['partners']['Row'];

  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null;
  let showEditModal = false;
  let partnerToEdit: PartnerType | null = null;
  let showImportModal = false;

  let actionMessage: string | null = null;
  let actionSuccess: boolean = false;

  function displayActionMessage(message: string, success: boolean, duration: number = 5000) {
    actionMessage = message;
    actionSuccess = success;
    setTimeout(() => { actionMessage = null; }, duration);
  }

  function openImportModal() { showImportModal = true; }
  async function closeImportModal() {
    showImportModal = false;
    // If the `form` prop was updated by an import action called via `use:enhance` (not our current manual fetch)
    if (form?.action === '?/importPartners' && form?.success) {
        displayActionMessage(form.message || 'Import processed.', true);
        await invalidateAll();
    }
  }
  async function onImportSuccess(event: CustomEvent<{message?: string, count?: number}>) {
      displayActionMessage(event.detail.message || `Import successful, ${event.detail.count || 'some'} records processed.`, true, 7000);
      await invalidateAll();
  }


  function openDeleteModal(partner: PartnerType) { partnerToDelete = partner; showDeleteModal = true; }
  async function closeDeleteModal() {
    const wasSuccess = form?.action === '?/deletePartner' && form?.success === true;
    const msg = form?.message;
    showDeleteModal = false; partnerToDelete = null;
    if (wasSuccess) {
        displayActionMessage(msg || 'Partner deleted successfully.', true);
        await invalidateAll();
    }
  }

  function openEditModal(partner: PartnerType) { partnerToEdit = { ...partner }; showEditModal = true; }
  async function closeEditModal() {
    const wasSuccess = form?.action?.startsWith('?/editPartner') && form?.success === true;
    const msg = form?.message;
    showEditModal = false; partnerToEdit = null;
    if (wasSuccess) {
        displayActionMessage(msg || 'Partner updated successfully.', true);
        await invalidateAll();
    }
  }

  async function handleTogglePartnerStatus(partnerToToggle: PartnerType) {
    if (!partnerToToggle || !partnerToToggle.id) return;
    const partnerIndex = data.partners.findIndex(p => p.id === partnerToToggle.id);
    if (partnerIndex === -1) { displayActionMessage("Error: Could not find partner to update locally.", false); return; }

    const originalStatus = data.partners[partnerIndex].account_status;
    const newStatus = originalStatus === 'active' ? 'suspended' : 'active';
    const optimisticallyUpdatedPartners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: newStatus } : p);
    data.partners = optimisticallyUpdatedPartners;

    const formData = new FormData();
    formData.append('partnerId', partnerToToggle.id);
    formData.append('currentStatus', originalStatus || 'active');

    try {
        const response = await fetch('?/toggleAccountStatus', { method: 'POST', body: formData });
        const result = deserialize(await response.text());

        if (result.type === 'success' && result.data?.data?.success === true) {
            displayActionMessage(result.data.data.message || 'Status updated successfully!', true);
            await invalidateAll(); // Confirm with server and get any other changes
        } else {
            const errorMsg = result.data?.data?.message || result.data?.message || result.error?.message || 'Failed to update status on server.';
            throw new Error(errorMsg);
        }
    } catch (err: any) {
        displayActionMessage(err.message || 'An error occurred while updating status.', false);
        data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: originalStatus } : p); // Revert
    }
  }

  // Handle messages from standard (add/edit) form submissions via use:enhance
  $: if (form && form.message && form.action !== formCache?.action) { // Check if form object *itself* changed meaningfully
    if (form.action === '?/addPartner' || form.action?.startsWith('?/editPartner')) {
        displayActionMessage(form.message, form.success === true);
        if (form.success && form.action === '?/addPartner') {
            invalidateAll(); // Invalidate for Add only here; Edit/Delete handled in closeXModal
        }
    }
    formCache = form; // Cache to compare against next change
  }
  let formCache: ActionData | undefined | null = null; // For message display logic

</script>

<div class="space-y-8 p-4 md:p-6 lg:p-8">
  {#if actionMessage}
    <div class="p-4 mb-6 rounded-md text-sm border {actionSuccess ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-300'}" role="alert">
      <p class="font-medium">{actionSuccess ? 'Success!' : 'Error!'}</p>
      <p>{actionMessage}</p>
    </div>
  {/if}

  <div>
    <h2 class="text-xl md:text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <PartnerForm formAction="?/addPartner" submitButtonText="Add Partner Entry" serverErrors={form?.action === '?/addPartner' ? form : null} />
  </div>

  <hr class="my-8 border-gray-300" />

  <div>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <h2 class="text-xl md:text-2xl font-semibold text-gray-800 whitespace-nowrap">Partner Records</h2>
        <div class="flex space-x-2">
            <button type="button" on:click={openImportModal} class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
                Import Data
            </button>
        </div>
    </div>
    {#if data.admin} <p class="mb-4 text-sm text-gray-600">Managing for: <strong>{data.admin.id}</strong></p> {/if}
    {#if data.partners === undefined || data.partners === null}
      <TableSkeleton rows={5} columns={16}/> <p class="text-center text-gray-500 mt-4">Loading partners...</p>
    {:else if data.partners.length > 0}
      <PartnerTable partners={data.partners} on:requestDelete={(e)=>openDeleteModal(e.detail as PartnerType)} on:requestEdit={(e)=>openEditModal(e.detail as PartnerType)} on:requestToggleStatus={(e)=>handleTogglePartnerStatus(e.detail as PartnerType)}/>
    {:else}
      <PartnerTable partners={[]} /> <p class="text-center text-gray-500 py-8 italic">No partners added yet.</p>
    {/if}
  </div>
</div>

{#if partnerToDelete && showDeleteModal} <DeletePartnerModal bind:showModal={showDeleteModal} partnerName={partnerToDelete.name} partnerId={partnerToDelete.id} on:close={closeDeleteModal} /> {/if}
{#if partnerToEdit && showEditModal} <EditPartnerModal bind:showModal={showEditModal} {partnerToEdit} formResult={form} on:close={closeEditModal} /> {/if}
<ImportModal bind:showModal={showImportModal} on:close={closeImportModal} on:importSuccess={onImportSuccess} />