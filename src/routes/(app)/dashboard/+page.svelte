<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types'; // ActionData is for form's server response
  export let data: PageData;
  export let form: ActionData; // Will hold response from ?/addPartner action

  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte'; // Import the new form
  // import { navigating } from '$app/stores';
</script>

<div class="space-y-8"> 
  <div>
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <PartnerForm
      formAction="?/addPartner"
      submitButtonText="Add Partner Entry"
      serverErrors={form?.errors}
    />
    {#if form?.message}
      <p class="mt-3 text-sm {form.success ? 'text-green-600 bg-green-50 p-3 rounded-md' : 'text-red-600 bg-red-50 p-3 rounded-md'}">
        {form.message}
      </p>
    {/if}
  </div>

  <div>
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Partner Records</h2>
    {#if data.admin}
        <p class="mb-4 text-sm text-gray-600">Displaying data for: <strong>{data.admin.id}</strong></p>
    {/if}

    {#if data.partners === undefined || data.partners === null}
        <TableSkeleton rows={5} columns={16}/>
    {:else if data.partners.length > 0}
        <PartnerTable partners={data.partners} />
    {:else}
        <PartnerTable partners={[]} />
    {/if}
  </div>
</div>