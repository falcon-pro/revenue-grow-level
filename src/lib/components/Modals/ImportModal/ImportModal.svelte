<!-- src/lib/components/Modals/ImportModal/ImportModal.svelte -->
<script lang="ts">
  import ModalBase from '$lib/components/UI/ModalBase.svelte';
  import { createEventDispatcher } from 'svelte';

  export let showModal: boolean = false;
  // We'll add props and functions for file handling, preview, etc., later

  const dispatch = createEventDispatcher();
  let isLoading = false; // For file processing or submission later

  function close() {
    if (isLoading) return;
    dispatch('close');
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
        console.log('File selected:', file.name, file.type, file.size);
        // TODO: Call function to process the file (SheetJS parsing) - Step 5.2
        // For now, just log it.
    }
  }
</script>

<ModalBase bind:showModal title="Import Partner Revenue Entries" on:close={close} modalSize="6xl">
  <div slot="body" class="space-y-4">
    <div>
      <label for="importFileInput" class="block text-sm font-medium text-gray-700 mb-1">
        Select Excel File (.xlsx)
      </label>
      <input
        type="file"
        id="importFileInput"
        name="importFile"
        accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        on:change={handleFileSelect}
        class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
      <p class="mt-1 text-xs text-gray-600">
        <span class="font-medium">Required columns:</span> Name, Mobile, Email.<br />
        <span class="font-medium">Optional:</span> Address, Webmoney, Multi Acc No, Adstera Link, Adstera Email, API Key, Creation Date, Start Date, Account Status, Revenue Period (YYYY-MM), Revenue (USD), Payment Status.<br />
        <span class="italic">If Revenue (USD) provided, Revenue Period (YYYY-MM) is also required.</span>
      </p>
      <!-- Spinner for file processing (Step 5.2) -->
      <div id="importSpinner" class="hidden flex items-center text-sm text-blue-600 mt-2">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing file...
      </div>
    </div>

    <!-- Error/Warning Summary for Preview (Step 5.2/5.3) -->
    <div id="importErrorsContainer" class="hidden p-3 bg-red-50 border border-red-200 rounded-md text-sm">
    </div>

    <!-- Preview Table Container (Step 5.2/5.3) -->
    <div class="border border-gray-200 rounded-md overflow-hidden max-h-[45vh] min-h-[200px] flex flex-col">
        <div class="overflow-x-auto flex-grow">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50 sticky top-0 z-10">
                <tr>
                    <th class="w-12 px-3 py-2 text-left font-medium text-gray-500">
                    <input type="checkbox" id="importSelectAll" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" title="Select/Deselect All Valid" disabled>
                    </th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[150px]">Name</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[180px]">Email</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[120px]">Mobile</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[100px]">Period</th>
                    <th class="px-3 py-2 text-right font-medium text-gray-500 min-w-[100px]">Revenue(USD)</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[110px]">Pay Status</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[200px]">Row Status</th>
                </tr>
                </thead>
                <tbody id="importPreviewTableBody" class="bg-white divide-y divide-gray-200">
                <!-- Rows will be injected here by JS in Step 5.2/5.3 -->
                <tr><td colspan="8" class="py-6 px-4 text-center text-gray-500 italic">Please select an Excel (.xlsx) file to preview.</td></tr>
                </tbody>
            </table>
        </div>
    </div>
  </div>

  <div slot="footer" class="flex flex-row-reverse gap-x-3">
    <button
      id="importAddSelectedBtn"
      type="button"
      disabled 
      on:click={() => console.log('TODO: Submit selected rows for import - Step 5.3')}
      class="btn-primary inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50"
    >
      {#if isLoading} <!-- Will use this isLoading for submission -->
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing...
      {:else}
        Add/Update Selected Entries
      {/if}
    </button>
    <button
      type="button"
      on:click={close}
      disabled={isLoading}
      class="btn-secondary inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
    >
      Cancel
    </button>
  </div>
</ModalBase>