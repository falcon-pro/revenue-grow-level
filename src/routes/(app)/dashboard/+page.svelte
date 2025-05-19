<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData; // For ALL form actions on this page

  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import DeletePartnerModal from '$lib/components/Modals/DeletePartnerModal.svelte';
  import EditPartnerModal from '$lib/components/Modals/EditPartnerModal.svelte'; // Import Edit Modal

  // Assuming PartnerType is defined and imported correctly (e.g. from Supabase types)
  import type { Database } from '../../../types/supabase';
  type PartnerType = Database['public']['Tables']['partners']['Row'];


  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null;
  let showEditModal = false;
  let partnerToEdit: PartnerType | null = null;


  function openDeleteModal(partner: PartnerType) {
    partnerToDelete = partner;
    showDeleteModal = true;
  }
  function closeDeleteModal() {
    showDeleteModal = false;
    partnerToDelete = null;
    if (form?.action === '?/deletePartner' && form?.success === true) {
      // TODO: Invalidate partners data list for auto-refresh
      // invalidate((url) => url.pathname === '/dashboard/partners'); or similar
    }
  }

  function openEditModal(partner: PartnerType) {
    partnerToEdit = { ...partner }; // Create a copy to avoid direct mutation if form binds deeply
    showEditModal = true;
  }
  function closeEditModal() {
    showEditModal = false;
    partnerToEdit = null;
    if (form?.action?.startsWith('?/editPartner') && form?.success === true) {
        // TODO: Invalidate partners data list for auto-refresh
    }
  }

  let actionMessage: string | null = null;
  let actionSuccess: boolean = false;
  $: if (form?.message) { // This 'form' prop is updated by SvelteKit after any action on this page
    actionMessage = form.message;
    actionSuccess = form.success === true;
    setTimeout(() => { actionMessage = null; }, 5000);
  }
</script>

<div class="space-y-8">
  {#if actionMessage}
    <div class="p-4 mb-4 rounded-md text-sm {actionSuccess ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}">
      {actionMessage}
    </div>
  {/if}

  <div>
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <PartnerForm
      formAction="?/addPartner"
      submitButtonText="Add Partner Entry"
      serverErrors={form?.action === '?/addPartner' ? form : null} 
    />
  </div>

  <div>
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Partner Records</h2>
    {#if data.admin}
      <p class="mb-4 text-sm text-gray-600">Displaying data for: <strong>{data.admin.id}</strong></p>
    {/if}

    {#if data.partners === undefined || data.partners === null}
      <TableSkeleton rows={5} columns={16}/>
    {:else if data.partners.length > 0}
      <PartnerTable
        partners={data.partners}
        on:requestDelete={(event) => openDeleteModal(event.detail as PartnerType)}
        on:requestEdit={(event) => openEditModal(event.detail as PartnerType)}
      />
    {:else}
      <PartnerTable partners={[]} />
    {/if}
  </div>
</div>

{#if partnerToDelete}
  <DeletePartnerModal
    bind:showModal={showDeleteModal}
    partnerName={partnerToDelete.name}
    partnerId={partnerToDelete.id}
    on:close={closeDeleteModal}
  />
{/if}

{#if partnerToEdit && showEditModal} 
  <EditPartnerModal
    bind:showModal={showEditModal}
    partnerToEdit={partnerToEdit}
    formResult={form} 
    on:close={closeEditModal}
  />
{/if}