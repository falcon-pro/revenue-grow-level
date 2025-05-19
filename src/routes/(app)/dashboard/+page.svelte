<!-- src/routes/(app)/dashboard/+page.svelte (Guarded invalidateAll) -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance, applyAction } from '$app/forms'; // Add enhance and applyAction
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
  import { browser } from '$app/environment'; // Import browser

  // Modal States
  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null;
  let showEditModal = false;
  let partnerToEdit: PartnerType | null = null;
  let showImportModal = false;

  // Action Message State
  let actionMessage: string | null = null;
  let actionSuccess: boolean = false;

  // Form Cache for message display logic
  let formCacheKey: string | null = null; // Use a simple key based on action + message to detect actual change

  let isRefreshingAllApis = false; // For button loading state

  function displayActionMessage(message: string, success: boolean, duration: number = 5000) {
    actionMessage = message;
    actionSuccess = success;
    setTimeout(() => { actionMessage = null; }, duration);
  }

  function openImportModal() { showImportModal = true; }
  async function closeImportModal() {
    showImportModal = false;
    if (form?.action === '?/importPartners' && form?.success && browser) { // Guard
        // `form` should update via SvelteKit. This is an example if more complex state needs setting.
        // For `importPartners` we use custom event `onImportSuccess` which is better.
        // displayActionMessage(form.message || 'Import processed.', true);
        // await invalidateAll();
    }
  }
  async function onImportSuccess(event: CustomEvent<{message?: string, count?: number}>) {
      displayActionMessage(event.detail.message || `Import successful, ${event.detail.count || 'some'} records processed.`, true, 7000);
      if (browser) { // Guard
          await invalidateAll();
      }
  }

  function openDeleteModal(partner: PartnerType) { partnerToDelete = partner; showDeleteModal = true; }
  async function closeDeleteModal() {
    // Check against the form prop *after* the action completed
    // `form` is reactive and updated by SvelteKit
    const wasSuccess = form?.action === '?/deletePartner' && form?.success === true;
    const msg = form?.message;

    showDeleteModal = false;
    partnerToDelete = null;

    if (wasSuccess) { // `form.success` is already set if action returned it.
        displayActionMessage(msg || 'Partner deleted successfully.', true);
        if (browser) { // Guard invalidateAll
            await invalidateAll();
        }
    }
  }

  function openEditModal(partner: PartnerType) { partnerToEdit = { ...partner }; showEditModal = true; }
  async function closeEditModal() {
    const wasSuccess = form?.action?.startsWith('?/editPartner') && form?.success === true;
    const msg = form?.message;

    showEditModal = false;
    partnerToEdit = null;

    if (wasSuccess) {
        displayActionMessage(msg || 'Partner updated successfully.', true);
        if (browser) { // Guard invalidateAll
            await invalidateAll();
        }
    }
  }

  async function handleTogglePartnerStatus(partnerToToggle: PartnerType) {
    if (!partnerToToggle || !partnerToToggle.id) return;
    const partnerIndex = data.partners.findIndex(p => p.id === partnerToToggle.id);
    if (partnerIndex === -1) { displayActionMessage("Error: Could not find partner locally.", false); return; }

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
            displayActionMessage(result.data.data.message || 'Status updated!', true);
            if (browser) { // Guard invalidateAll
                await invalidateAll();
            }
        } else {
            const errorMsg = result.data?.data?.message || result.data?.message || result.error?.message || 'Failed to update status.';
            throw new Error(errorMsg);
        }
    } catch (err: any) {
        displayActionMessage(err.message || 'Error updating status.', false);
        data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: originalStatus } : p); // Revert
    }
  }

  // This reactive block handles messages for standard form submissions (Add/Edit)
  // that update the `form` prop.
  $: {
    const currentFormKey = `${form?.action}-${form?.message}-${form?.success}`;
    if (browser && form && form.message && currentFormKey !== formCacheKey) { // Check if form object has actually changed in relevant ways
        if (form.action === '?/addPartner' || form.action?.startsWith('?/editPartner')) {
            displayActionMessage(form.message, form.success === true);
            if (form.success === true) {
                if (form.action === '?/addPartner') {
                    console.log("Client: Add partner successful (from form prop), invalidating data...");
                    invalidateAll(); // Refresh list for add. Edit/Delete handled by closeXModal.
                }
            }
        }
        formCacheKey = currentFormKey; // Update cache after processing
    } else if (browser && form && !form.message && formCacheKey) {
        // Form was cleared (e.g., navigation), clear cache so next message shows
        formCacheKey = null;
    }
  }

</script>

<div class="space-y-8 p-4 md:p-6 lg:p-8">
  {#if actionMessage}
    <div class="p-4 mb-6 rounded-md text-sm border {actionSuccess ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-300'}" role="alert">
      <p class="font-medium">{actionSuccess ? 'Success!' : (actionMessage.toLowerCase().includes('error') || !actionSuccess ? 'Error!' : 'Info')}</p>
      <p>{actionMessage}</p>
    </div>
  {/if}

  <div>
    <h2 class="text-xl md:text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <!-- For addPartner, serverErrors comes from `form` prop when action matches -->
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
            <button type="button" on:click={openImportModal} class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
                Import Data
            </button>
            <!-- src/routes/(app)/dashboard/+page.svelte -->
<!-- Inside the <div class="flex space-x-2"> for table header buttons -->

<form method="POST" action="?/refreshAllApiRevenue" use:enhance={() => {
    // Optional: Client-side feedback before server responds
    isRefreshingAllApis = true;
    // Can't easily get total count here without another call, so generic message
    displayActionMessage('Starting API revenue refresh for all relevant accounts...', true, 10000);

    return async ({ result }) => {
        // This runs after the action completes
        await applyAction(result); // Standard way to apply action result to page `form` store
        isRefreshingAllApis = false;
        // The main page `form` reactive block will display the message from `result.data.message`
        // and call invalidateAll() if `result.data.success` is true.
        if (result.type === 'success' && result.data?.success) {
           // No need to call invalidateAll() here if the generic form handler does it.
           // Or call it if you want specific timing for this action.
           // The message will be displayed by the generic form handler.
           // await invalidateAll();
        } else if (result.type === 'failure' || result.type === 'error') {
           // Error message already set by generic form handler
        }
    };
}}>
    <button
        type="submit"
        disabled={isRefreshingAllApis}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
    >
        {#if isRefreshingAllApis}
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Refreshing All...
        {:else}
            <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.324 2.43l-1.131.283a.75.75 0 00-.64 1.008l.066.263a6.973 6.973 0 005.537 3.586A7.002 7.002 0 0018 13.002a7.005 7.005 0 00-1.767-4.667l.262.065a.75.75 0 001.008-.64l.283-1.13a5.5 5.5 0 01-2.474 4.8zM4.94 5.842A6.975 6.975 0 0110.002 2a7.002 7.002 0 016.706 9.015l-.262-.066a.75.75 0 00-1.008.64l-.283 1.131a5.502 5.502 0 013.842-7.988.75.75 0 00-.64-1.007l-1.13.282a5.5 5.5 0 00-9.326-2.43l1.13-.283a.75.75 0 01.64-1.007l-.066-.263zm12.188 1.88L17.39 8.29a.75.75 0 00-1.06-1.061l-.262.262a3.001 3.001 0 00-4.243 0L10 9.293l-1.828-1.83a3.001 3.001 0 00-4.243 0l-.262-.262A.75.75 0 002.608 8.29l.262.568A5.476 5.476 0 002 13.002a5.5 5.5 0 008.576 4.243l.262.262a.75.75 0 001.06 0l.568-.262a5.476 5.476 0 004.152-8.576z" clip-rule="evenodd" />
            </svg>
            Refresh All API Keys
        {/if}
    </button>
</form>
        </div>
    </div>
    {#if data.admin} <p class="mb-4 text-sm text-gray-600">Managing for: <strong>{data.admin.id}</strong></p> {/if}
    {#if data.partners === undefined || data.partners === null}
      <TableSkeleton rows={5} columns={16}/> <p class="text-center text-gray-500 mt-4">Loading partners...</p>
    {:else if data.partners.length > 0}
      <PartnerTable
        partners={data.partners}
        on:requestDelete={(e)=>openDeleteModal(e.detail as PartnerType)}
        on:requestEdit={(e)=>openEditModal(e.detail as PartnerType)}
        on:requestToggleStatus={(e)=>handleTogglePartnerStatus(e.detail as PartnerType)}
      />
    {:else}
      <PartnerTable partners={[]} /> <p class="text-center text-gray-500 py-8 italic">No partners added yet.</p>
    {/if}
  </div>
</div>

{#if partnerToDelete && showDeleteModal} <DeletePartnerModal bind:showModal={showDeleteModal} partnerName={partnerToDelete.name} partnerId={partnerToDelete.id} on:close={closeDeleteModal} /> {/if}
{#if partnerToEdit && showEditModal} <EditPartnerModal bind:showModal={showEditModal} {partnerToEdit} formResult={form} on:close={closeEditModal} /> {/if}
<ImportModal bind:showModal={showImportModal} on:close={closeImportModal} on:importSuccess={onImportSuccess} />