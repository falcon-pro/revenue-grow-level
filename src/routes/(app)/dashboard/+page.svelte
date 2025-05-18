<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData; // For addPartner results, and now potentially deletePartner results

  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import DeletePartnerModal from '$lib/components/Modals/DeletePartnerModal.svelte'; // Import Delete Modal
  import type { Partner as PartnerType } from '$lib/utils/types'; // Or your Supabase Partner type

  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null; // Use your defined PartnerType

  // Function to open the delete modal
  function openDeleteModal(partner: PartnerType) { // Use PartnerType
    partnerToDelete = partner;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    partnerToDelete = null;
    // Check if the delete action returned a success message to refresh data
    // This `form` variable is updated by SvelteKit after ANY form action on this page completes.
    if (form?.action === '?/deletePartner' && form?.success) {
        // Trigger data invalidation to refresh the partner list
        // This requires careful use of `invalidate` which we will cover properly
        // For now, a manual refresh or just acknowledging the message is okay.
        // invalidate((url) => url.pathname === '/dashboard'); // Example of invalidation
        console.log("Delete successful, list should be refreshed if invalidation is implemented.");
    }
  }

  // Reactive statements for messages from any action (add or delete)
  let actionMessage: string | null = null;
  let actionSuccess: boolean = false;
  $: if (form?.message) {
    actionMessage = form.message;
    actionSuccess = form.success === true; // Ensure it's explicitly true
    // Clear message after a few seconds
    setTimeout(() => {
        actionMessage = null;
    }, 5000);
    // If a delete was successful via use:enhance, the list won't auto-refresh without invalidation
    // The form variable on the page is updated after any form action.
  }
</script>

<div class="space-y-8">
  <!-- Message display for actions -->
  {#if actionMessage}
    <div class="p-4 rounded-md {actionSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
      {actionMessage}
    </div>
  {/if}

  <div>
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <PartnerForm
      formAction="?/addPartner"
      submitButtonText="Add Partner Entry"
      serverErrors={form?.action === '?/addPartner' ? form?.errors : null}
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
      <!-- Listen for the requestDelete event from PartnerTable -->
      <PartnerTable
        partners={data.partners}
        on:requestDelete={(event) => openDeleteModal(event.detail)}
      />
    {:else}
      <PartnerTable partners={[]} />
    {/if}
  </div>
</div>

<!-- Delete Partner Modal Instance -->
{#if partnerToDelete}
  <DeletePartnerModal
    bind:showModal={showDeleteModal}
    partnerName={partnerToDelete.name}
    partnerId={partnerToDelete.id}
    on:close={closeDeleteModal}
  />
{/if}