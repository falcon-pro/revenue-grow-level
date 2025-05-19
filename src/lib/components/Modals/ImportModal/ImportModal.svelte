<!-- src/lib/components/Modals/ImportModal/ImportModal.svelte -->
<script lang="ts">
  import ModalBase from '$lib/components/UI/ModalBase.svelte';
  import { createEventDispatcher } from 'svelte';
  import * as XLSX from 'xlsx'; // Import SheetJS

  export let showModal: boolean = false;

  const dispatch = createEventDispatcher();

  // State for the import process
  interface ParsedRowData {
    index: number; // Original row index from sheet (0-based for data rows)
    rawData: Record<string, any>; // Raw data from sheetJS
    mappedData?: Record<string, any>; // Data mapped to our known field names
    // We will add validation status here later
    // validation?: { errors: string[], warnings: string[], statusText: string, statusClass: string };
    // isSelected?: boolean;
  }

  let parsedSheetData: ParsedRowData[] = [];
  let fileProcessingError: string | null = null;
  let isLoadingFile = false; // For the file processing spinner

  // --- DOM Element Bindings --- (Not strictly needed if updating via reactive array)
  // let importPreviewTableBodyEl: HTMLTableSectionElement;
  // let importErrorsContainerEl: HTMLDivElement;
  // let importSpinnerEl: HTMLDivElement;
  // let importSelectAllCheckboxEl: HTMLInputElement;
  // let importAddSelectedBtnEl: HTMLButtonElement;


  function close() {
    if (isLoadingFile) return; // Prevent closing while processing file maybe? Or allow and cancel.
    parsedSheetData = []; // Reset data on close
    fileProcessingError = null;
    dispatch('close');
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      parsedSheetData = [];
      fileProcessingError = null;
      return;
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      fileProcessingError = "Invalid file type. Please upload an XLSX file.";
      parsedSheetData = [];
      input.value = ''; // Reset file input
      return;
    }

    isLoadingFile = true;
    fileProcessingError = null;
    parsedSheetData = []; // Clear previous preview

    // Show spinner (alternative to binding, direct class manipulation)
    const spinner = document.getElementById('importSpinner'); // Assuming you keep IDs
    if (spinner) spinner.classList.remove('hidden');


    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true }); // cellDates: true is important
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Using header: 1 to get array of arrays, defval: null for empty cells
      // raw: false to get formatted values (e.g. dates as JS dates if cellDates true)
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });

      if (!jsonData || jsonData.length < 1) { // jsonData[0] should be headers
        throw new Error("File is empty or does not contain a header row.");
      }
      if (jsonData.length < 2) {
         throw new Error("File does not contain any data rows after the header.");
      }


      const headers: string[] = jsonData[0].map(h => String(h || '').trim().toLowerCase()); // Normalize headers
      
      // Basic mapping - can be expanded like your original
      // For now, let's try to find 'name', 'email', 'mobile' and a few others.
      // In a real app, make this robust like your original headerMappings
      const nameHeaderVariations = ['name', 'partner name', 'full name'];
      const emailHeaderVariations = ['email', 'email address'];
      const mobileHeaderVariations = ['mobile', 'phone'];
      // ... add more mappings for other relevant fields for display/validation ...
      const revenuePeriodVariations = ['revenue period', 'period', 'month'];
      const revenueUsdVariations = ['revenue (usd)', 'revenue usd', 'usd amount', 'revenue'];
      const paymentStatusVariations = ['payment status', 'pay status', 'status'];


      const nameIndex = headers.findIndex(h => nameHeaderVariations.includes(h));
      const emailIndex = headers.findIndex(h => emailHeaderVariations.includes(h));
      const mobileIndex = headers.findIndex(h => mobileHeaderVariations.includes(h));
      const revenuePeriodIndex = headers.findIndex(h => revenuePeriodVariations.includes(h));
      const revenueUsdIndex = headers.findIndex(h => revenueUsdVariations.includes(h));
      const paymentStatusIndex = headers.findIndex(h => paymentStatusVariations.includes(h));


      // Check for required headers (example)
      if (nameIndex === -1 || emailIndex === -1 || mobileIndex === -1) {
          throw new Error("Missing one or more required columns: Name, Email, Mobile.");
      }

      // Slice(1) to skip header row for data processing
      parsedSheetData = jsonData.slice(1).map((rowArray, index) => {
        const rowObject: Record<string, any> = {};
        // This creates a simple object with original header names as keys.
        // For actual import, you'd map to your canonical field names (e.g. partnerData.name, partnerData.email)
        // headers.forEach((header, colIndex) => {
        //    if(header) rowObject[header] = rowArray[colIndex]; // Using original header name for now
        // });

        // Map to known fields for consistent access later
        const mapped = {
            name: rowArray[nameIndex],
            email: rowArray[emailIndex],
            mobile: rowArray[mobileIndex],
            // Only add these if their columns were found
            revenuePeriod: revenuePeriodIndex !== -1 ? rowArray[revenuePeriodIndex] : null,
            revenueUSD: revenueUsdIndex !== -1 ? rowArray[revenueUsdIndex] : null,
            paymentStatus: paymentStatusIndex !== -1 ? rowArray[paymentStatusIndex] : null,
        };

        return {
          index: index,
          rawData: rowObject, // Will be empty based on current mapping, we are using `mapped` instead
          mappedData: mapped
        };
      });

      if (parsedSheetData.length === 0) {
        fileProcessingError = "No data rows found in the Excel file.";
      }

    } catch (error: any) {
      console.error("Error processing Excel file:", error);
      fileProcessingError = `Error processing file: ${error.message}`;
      parsedSheetData = [];
    } finally {
      isLoadingFile = false;
      if (spinner) spinner.classList.add('hidden');
      input.value = ''; // Reset file input so user can select same file again if needed after an error
    }
  }

</script>

<ModalBase bind:showModal title="Import Partner Revenue Entries" on:close={close} modalSize="6xl">
  <div slot="body" class="space-y-4">
    <div>
      <label for="importFileInputModal" class="block text-sm font-medium text-gray-700 mb-1">
        Select Excel File (.xlsx)
      </label>
      <input
        type="file"
        id="importFileInputModal"
        name="importFileModal"
        accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        on:change={handleFileSelect}
        class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
      <p class="mt-1 text-xs text-gray-600">
        <span class="font-medium">Required columns:</span> Name, Mobile, Email.<br />
        <span class="font-medium">Optional:</span> Address, Webmoney, Multi Acc No, Adstera Link, Adstera Email, API Key, Creation Date, Start Date, Account Status, Revenue Period (YYYY-MM), Revenue (USD), Payment Status.<br />
        <span class="italic">If Revenue (USD) provided, Revenue Period (YYYY-MM) is also required.</span>
      </p>
      <div id="importSpinner" class:hidden={!isLoadingFile} class="flex items-center text-sm text-blue-600 mt-2">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {#if isLoadingFile}Processing file...{/if}
      </div>
    </div>

    {#if fileProcessingError}
      <div id="importErrorsContainer" class="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
        {fileProcessingError}
      </div>
    {/if}

    <div class="border border-gray-200 rounded-md overflow-hidden max-h-[45vh] min-h-[200px] flex flex-col">
        <div class="overflow-x-auto flex-grow">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50 sticky top-0 z-10">
                <tr>
                    <th class="w-12 px-3 py-2 text-left font-medium text-gray-500">
                    <input type="checkbox" id="importSelectAllModal" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" title="Select/Deselect All Valid" disabled>
                    </th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[150px]">Name</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[180px]">Email</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[120px]">Mobile</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[100px]">Period</th>
                    <th class="px-3 py-2 text-right font-medium text-gray-500 min-w-[100px]">Revenue(USD)</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[110px]">Pay Status</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 min-w-[200px]">Row Status (Validation Next)</th>
                </tr>
                </thead>
                <tbody id="importPreviewTableBodyModal" class="bg-white divide-y divide-gray-200">
                    {#if parsedSheetData.length === 0 && !isLoadingFile && !fileProcessingError}
                        <tr><td colspan="8" class="py-6 px-4 text-center text-gray-500 italic">Please select an Excel (.xlsx) file to preview.</td></tr>
                    {:else if parsedSheetData.length === 0 && isLoadingFile}
                         <tr><td colspan="8" class="py-6 px-4 text-center text-gray-500 italic">Loading data from file...</td></tr>
                    {/if}
                    {#each parsedSheetData as row, i (row.index)}
                        <tr class="hover:bg-gray-50">
                            <td class="px-3 py-2 text-center">
                                <input type="checkbox" class="import-row-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" data-index={i} disabled>
                            </td>
                            <td class="px-3 py-2 whitespace-nowrap truncate max-w-[150px]" title={row.mappedData?.name || ''}>{row.mappedData?.name || '-'}</td>
                            <td class="px-3 py-2 whitespace-nowrap truncate max-w-[180px]" title={row.mappedData?.email || ''}>{row.mappedData?.email || '-'}</td>
                            <td class="px-3 py-2 whitespace-nowrap truncate max-w-[120px]" title={row.mappedData?.mobile || ''}>{row.mappedData?.mobile || '-'}</td>
                            <td class="px-3 py-2 whitespace-nowrap">{row.mappedData?.revenuePeriod || '-'}</td>
                            <td class="px-3 py-2 whitespace-nowrap text-right">{row.mappedData?.revenueUSD != null ? row.mappedData.revenueUSD : '-'}</td>
                            <td class="px-3 py-2 whitespace-nowrap">{row.mappedData?.paymentStatus || '-'}</td>
                            <td class="px-3 py-2 whitespace-nowrap text-gray-400 italic">Pending validation</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
  </div>

  <div slot="footer" class="flex flex-row-reverse gap-x-3">
    <button
      id="importAddSelectedBtnModal"
      type="button"
      disabled 
      on:click={() => console.log('Submit selected rows...')}
       class="btn-primary inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50"
    >
      Add/Update Selected Entries
    </button>
    <button
      type="button"
      on:click={close}
      disabled={isLoadingFile}
      class="btn-secondary inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
    >
      Cancel
    </button>
  </div>
</ModalBase>