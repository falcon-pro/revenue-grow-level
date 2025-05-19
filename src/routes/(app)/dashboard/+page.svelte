<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData; // From server load function (contains partners, admin from layout)
  export let form: ActionData; // From server actions

  // UI Components
  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import DeletePartnerModal from '$lib/components/Modals/DeletePartnerModal.svelte';
  import EditPartnerModal from '$lib/components/Modals/EditPartnerModal.svelte';
  import ImportModal from '$lib/components/Modals/ImportModal/ImportModal.svelte';
  import SummaryStats from '$lib/components/Dashboard/Summary/SummaryStats.svelte'; // <<< NEW IMPORT

  // Types
  import type { Database } from '../../../types/supabase'; // Adjust path if needed
  type PartnerType = Database['public']['Tables']['partners']['Row'];

  // SvelteKit Utilities
  import { deserialize, enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';

  // --- Component State ---
  // Modal States
  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null;
  let showEditModal = false;
  let partnerToEdit: PartnerType | null = null;
  let showImportModal = false;

  // Action Feedback State
  let actionMessage: string | null = null;
  let actionSuccess: boolean = false;
  let formCacheKey: string | null = null; // For comparing form prop to avoid re-processing messages

  // Specific Action Loading States
  let isRefreshingAllApis = false; // For the "Refresh All API Keys" button

  // --- Helper Functions ---
  function displayActionMessage(message: string, success: boolean, duration: number = 5000) {
    actionMessage = message;
    actionSuccess = success;
    setTimeout(() => { actionMessage = null; }, duration);
  }

  // --- Modal Control Functions ---
  function openImportModal() { showImportModal = true; }
  async function closeImportModal() { /* ... (same as before, consider if form state from import action needs handling) ... */ showImportModal = false; }
  async function onImportSuccess(event: CustomEvent<{message?: string, count?: number}>) {
      displayActionMessage(event.detail.message || `Import successful, ${event.detail.count || 'some'} records processed.`, true, 7000);
      if (browser) await invalidateAll();
  }

  function openDeleteModal(partner: PartnerType) { partnerToDelete = partner; showDeleteModal = true; }
  async function closeDeleteModal() {
    const wasSuccess = form?.action === '?/deletePartner' && form?.success === true;
    const msg = form?.message;
    showDeleteModal = false; partnerToDelete = null;
    if (wasSuccess) {
        displayActionMessage(msg || 'Partner deleted.', true);
        if (browser) await invalidateAll();
    }
  }

  function openEditModal(partner: PartnerType) { partnerToEdit = { ...partner }; showEditModal = true; }
  async function closeEditModal() {
    const wasSuccess = form?.action?.startsWith('?/editPartner') && form?.success === true;
    const msg = form?.message;
    showEditModal = false; partnerToEdit = null;
    if (wasSuccess) {
        displayActionMessage(msg || 'Partner updated.', true);
        if (browser) await invalidateAll();
    }
  }

  // --- Action Handlers ---
  async function handleTogglePartnerStatus(partnerToToggle: PartnerType) {
    if (!partnerToToggle || !partnerToToggle.id) return;
    const partnerIndex = data.partners.findIndex(p => p.id === partnerToToggle.id);
    if (partnerIndex === -1) { displayActionMessage("Error: Partner not found locally.", false); return; }

    const originalStatus = data.partners[partnerIndex].account_status;
    const newStatus = originalStatus === 'active' ? 'suspended' : 'active';
    data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: newStatus } : p); // Optimistic

    const formData = new FormData();
    formData.append('partnerId', partnerToToggle.id);
    formData.append('currentStatus', originalStatus || 'active');

    try {
        const response = await fetch('?/toggleAccountStatus', { method: 'POST', body: formData });
        const result = deserialize(await response.text());
        if (result.type === 'success' && result.data?.data?.success === true) {
            displayActionMessage(result.data.data.message || 'Status updated!', true);
            if (browser) await invalidateAll();
        } else { throw new Error(result.data?.data?.message || result.data?.message || result.error?.message || 'Failed to update status.');}
    } catch (err: any) {
        displayActionMessage(err.message || 'Error updating status.', false);
        data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: originalStatus } : p); // Revert
    }
  }

  // --- Reactive Handling for `form` prop updates from Add/Edit Actions ---
  $: {
    const currentFormKey = `${form?.action}-${form?.message}-${form?.success}-${Object.keys(form?.errors || {}).join(',')}`;
    if (browser && form && form.message && currentFormKey !== formCacheKey) {
        if (form.action === '?/addPartner' || form.action?.startsWith('?/editPartner') || form.action === '?/refreshAllApiRevenue') {
            displayActionMessage(form.message, form.success === true);
            if (form.success === true) {
                // For 'addPartner', list is refreshed.
                // For 'editPartner' & 'deletePartner', list refreshed by their closeXModal functions.
                // For 'refreshAllApiRevenue', the individual fetches will trigger UI updates when they complete & data reloads.
                // Initial success message "Process initiated..." is enough from `refreshAllApiRevenue` action itself.
                // `invalidateAll()` here will ensure the partner list reloads to show 'api_loading' states.
                if (form.action === '?/addPartner' || form.action === '?/refreshAllApiRevenue') {
                     console.log(`Client: Action ${form.action} successful (from form prop), invalidating data...`);
                     invalidateAll();
                }
            }
        }
        formCacheKey = currentFormKey;
    } else if (browser && form === undefined && formCacheKey) { // Form cleared (e.g. by navigation away and back)
        formCacheKey = null;
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
      <p class="font-medium">{actionSuccess ? 'Success!' : (actionMessage.toLowerCase().includes('error') || !actionSuccess ? 'Error!' : 'Info:')}</p>
      <p>{actionMessage}</p>
    </div>
  {/if}

  <!-- NEW: Summary Stats Section -->
  {#if data.partners }
    <SummaryStats partners={data.partners} />
  {/if}

  <hr class="my-8 border-gray-300" />

  <!-- Add Partner Form Section -->
  <div>
    <h2 class="text-xl md:text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <PartnerForm
      formAction="?/addPartner"
      submitButtonText="Add Partner Entry"
      serverErrors={form?.action === '?/addPartner' ? form : null}
    />
  </div>

  <hr class="my-8 border-gray-300" />

  <!-- Partner Records Section -->
  <div>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <h2 class="text-xl md:text-2xl font-semibold text-gray-800 whitespace-nowrap">Partner Records</h2>
        <div class="flex flex-wrap gap-2">
            <button
                type="button"
                on:click={openImportModal}
                class="btn-primary inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <svg class="-ml-0.5 sm:-ml-1 mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
                Import
            </button>
            <form method="POST" action="?/refreshAllApiRevenue" use:enhance={() => {
                isRefreshingAllApis = true;
                displayActionMessage('Starting API revenue refresh for all relevant accounts...', true, 10000);
                return async ({ result }) => {
                    await applyAction(result); // Updates the page's `form` store
                    isRefreshingAllApis = false;
                    // Message & invalidateAll are handled by the main `$: if (form ...)` block
                };
            }}>
                <button
                    type="submit"
                    disabled={isRefreshingAllApis}
                    class="btn-warning inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                >
                    {#if isRefreshingAllApis}
                        <svg class="animate-spin -ml-0.5 sm:-ml-1 mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Refreshing...
                    {:else}
                        <svg class="-ml-0.5 sm:-ml-1 mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.324 2.43l-1.131.283a.75.75 0 00-.64 1.008l.066.263a6.973 6.973 0 005.537 3.586A7.002 7.002 0 0018 13.002a7.005 7.005 0 00-1.767-4.667l.262.065a.75.75 0 001.008-.64l.283-1.13a5.5 5.5 0 01-2.474 4.8zM4.94 5.842A6.975 6.975 0 0110.002 2a7.002 7.002 0 016.706 9.015l-.262-.066a.75.75 0 00-1.008.64l-.283 1.131a5.502 5.502 0 013.842-7.988.75.75 0 00-.64-1.007l-1.13.282a5.5 5.5 0 00-9.326-2.43l1.13-.283a.75.75 0 01.64-1.007l-.066-.263zm12.188 1.88L17.39 8.29a.75.75 0 00-1.06-1.061l-.262.262a3.001 3.001 0 00-4.243 0L10 9.293l-1.828-1.83a3.001 3.001 0 00-4.243 0l-.262-.262A.75.75 0 002.608 8.29l.262.568A5.476 5.476 0 002 13.002a5.5 5.5 0 008.576 4.243l.262.262a.75.75 0 001.06 0l.568-.262a5.476 5.476 0 004.152-8.576z" clip-rule="evenodd" /></svg>
                        Refresh APIs
                    {/if}
                </button>
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

<!-- Modal Instances -->
{#if partnerToDelete && showDeleteModal} <DeletePartnerModal bind:showModal={showDeleteModal} partnerName={partnerToDelete.name} partnerId={partnerToDelete.id} on:close={closeDeleteModal} /> {/if}
{#if partnerToEdit && showEditModal} <EditPartnerModal bind:showModal={showEditModal} {partnerToEdit} formResult={form} on:close={closeEditModal} /> {/if}
<ImportModal bind:showModal={showImportModal} on:close={closeImportModal} on:importSuccess={onImportSuccess} />