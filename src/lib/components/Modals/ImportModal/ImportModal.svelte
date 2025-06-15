<!-- src/lib/components/Modals/ImportModal/ImportModal.svelte -->
<script lang="ts">
  import ModalBase from '$lib/components/UI/ModalBase.svelte';
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import * as XLSX from 'xlsx';
  import { page } from '$app/stores';
  import { deserialize } from '$app/forms';

  import type { Database } from '../../../../types/supabase';
  type PartnerRow = Database['public']['Tables']['partners']['Row'];

  export let showModal: boolean = false;
  const dispatch = createEventDispatcher();

  interface ValidationResult { errors: string[]; warnings: string[]; statusText: string; statusClass: string; isOkToImport: boolean; }
  interface ParsedImportRow { index: number; mappedData: Record<string, any>; validation: ValidationResult | null; isSelected: boolean; }

  let parsedSheetData: ParsedImportRow[] = [];
  let fileProcessingError: string | null = null;
  let isLoadingFile = false;
  let isSubmittingImport = false;
  let importSelectAllChecked = false;
  let existingPartnerEmails = new Set<string>();
  let pageStoreSubscription: (() => void) | null = null;

  onMount(() => {
    pageStoreSubscription = page.subscribe(currPage => {
      if (currPage.data && (currPage.data as any).partners) {
        existingPartnerEmails = new Set(
          ((currPage.data as any).partners as PartnerRow[])
            .map(partner => partner.email?.toLowerCase())
            .filter(Boolean) as string[]
        );
      }
    });
  });

  onDestroy(() => {
    if (pageStoreSubscription) pageStoreSubscription();
  });

  function resetImportState() {
    parsedSheetData = [];
    fileProcessingError = null;
    isLoadingFile = false; // Reset these here now too as part of full reset
    isSubmittingImport = false;
    importSelectAllChecked = false;
    const fileInput = document.getElementById('importFileInputModal') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  function doResetAndDispatchClose() {
    resetImportState();
    dispatch('close');
  }

  function closeByUserAction() {
    if (isLoadingFile || isSubmittingImport) {
        // console.log("ImportModal: Close attempt while busy."); // Keep for debug if needed
        return;
    }
    doResetAndDispatchClose();
  }

  function convertToJSDate(value: any): Date | null { if (!value) return null; if (value instanceof Date && !isNaN(value.valueOf())) return value; try { if (typeof value === 'number' && value > 25568 && value < 2958465) { const excelEpoch = new Date(Date.UTC(1899, 11, 30)); const d = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000); if (!isNaN(d.valueOf())) return d; } const d = new Date(value); if (!isNaN(d.valueOf())) return d; } catch (e) {} return null; }
  function formatRevenuePeriod(value: any): string | null { if (!value) return null; const date = convertToJSDate(value); if (date) { try { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; } catch { return null; } } if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value.trim())) return value.trim(); return null;}
  function normalizePaymentStatus(value: any): string | null { const str = String(value || '').toLowerCase().trim().replace(/\s+/g, '_'); const allowed = ['pending', 'received', 'not_received']; return allowed.includes(str) ? str : null;}
  
  function validateImportRow(rowData: Record<string, any>): ValidationResult { const errors: string[] = []; const warnings: string[] = []; if (!rowData.name) errors.push("Name missing."); if (!rowData.email) errors.push("Email missing."); else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rowData.email))) errors.push("Email invalid format."); if (!rowData.mobile) errors.push("Mobile missing."); if (rowData.email && !errors.some(e => e.toLowerCase().includes('email'))) { if (existingPartnerEmails.has(String(rowData.email).toLowerCase())) { warnings.push("Email exists (will update)."); } } const validRevenuePeriod = rowData.revenuePeriod && /^\d{4}-\d{2}$/.test(String(rowData.revenuePeriod)); const hasRevenueUSD = rowData.revenueUSD !== undefined && rowData.revenueUSD !== null && String(rowData.revenueUSD).trim() !== ''; let parsedUSDIsValid = true; if (hasRevenueUSD) { const cleanedUsd = String(rowData.revenueUSD).replace(/[^0-9.-]+/g, ""); const parsedVal = parseFloat(cleanedUsd); if (isNaN(parsedVal) || parsedVal < 0) { errors.push("RevUSD invalid."); parsedUSDIsValid = false; } } if (hasRevenueUSD && parsedUSDIsValid && !validRevenuePeriod) { errors.push("Period (YYYY-MM) needed w/ RevUSD."); } if (rowData.revenuePeriod && !validRevenuePeriod && hasRevenueUSD && parsedUSDIsValid) { errors.push("Period fmt invalid (YYYY-MM)."); } if (rowData.paymentStatus !== undefined && rowData.paymentStatus !== null && !normalizePaymentStatus(rowData.paymentStatus)) { errors.push("PayStatus invalid."); } const accountStatus = String(rowData.accountStatus || '').toLowerCase().trim(); if (rowData.accountStatus !== undefined && rowData.accountStatus !== null && accountStatus !== '' && !['active', 'suspended'].includes(accountStatus)) { errors.push("AccStatus invalid."); } const isOkToImport = errors.length === 0; let statusText = '✔️ Ready'; let statusClass = 'text-green-600'; if (!isOkToImport) { statusText = `⚠️ ${errors.slice(0, 2).join(' ')}${errors.length > 2 ? '...' : ''}`; statusClass = 'text-red-600 font-medium'; } else if (warnings.length > 0) { statusText = `ℹ️ ${warnings.slice(0,1).join(' ')}${warnings.length > 1 ? '...' : ''}`; statusClass = 'text-blue-600'; } return { errors, warnings, statusText, statusClass, isOkToImport }; }
  
  async function handleFileSelect(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; fileProcessingError = null; parsedSheetData = []; importSelectAllChecked = false; isLoadingFile = true; /* Keep input.value to allow re-processing if needed if file errors later (user corrects then re-submits same selected file instance without re-choosing) - though typical UX is to clear: input.value = ''; */ if (!file) { isLoadingFile = false; return; } if (!file.name.toLowerCase().endsWith('.xlsx')) { fileProcessingError = "Invalid file type. XLSX only."; isLoadingFile = false; input.value=''; return; }  const spinner = document.getElementById('importSpinnerModal'); if (spinner) spinner.classList.remove('hidden'); try { const data = await file.arrayBuffer(); const workbook = XLSX.read(data, { type: 'array', cellDates: true }); const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false, dateNF:'YYYY-MM-DD HH:mm:ss' }); if (!jsonData || jsonData.length < 2) throw new Error("File empty or no data rows."); const excelHeadersRaw = jsonData[0].map(h => String(h || '').trim()); const headerMappings: Record<string, string[]> = { name: ['Partner Name', 'Name'], mobile: ['Mobile', 'Phone'], email: ['Email', 'Email Address'], address: ['Address'], webmoney: ['Webmoney ID', 'Webmoney'], multi_account_no: ['Multi Account No', 'Multi Acc No'], adstera_link: ['Adstera Link'], adstera_email_link: ['Adstera Email Link', 'Adstera Email'], adstera_api_key: ['Adstera API Key', 'API Key', 'Adstera API'], account_creation: ['Account Creation Date', 'Creation Date', 'Account Created'], account_start: ['Account Start Date', 'Start Date'], revenuePeriod: ['Revenue Period', 'Period', 'Month'], revenueUSD: ['Revenue (USD)', 'Revenue USD', 'USD Amount', 'Revenue'], paymentStatus: ['Payment Status', 'Pay Status', 'Status'], accountStatus: ['Account Status', 'Partner Status'] }; const foundHeaders: Record<string, number> = {}; for (const canonicalName in headerMappings) { const possibleNames = headerMappings[canonicalName]; const index = excelHeadersRaw.findIndex(h => possibleNames.some(pn => h.toLowerCase() === pn.toLowerCase())); if (index !== -1) foundHeaders[canonicalName] = index; } const requiredCanonical = ['name', 'email', 'mobile']; const missingRequired = requiredCanonical.filter(rc => foundHeaders[rc] === undefined); if (missingRequired.length > 0) { const missingDisplay = missingRequired.map(rc => headerMappings[rc][0] || rc); throw new Error(`Missing required columns: ${missingDisplay.join(', ')}.`); } parsedSheetData = jsonData.slice(1).map((rowArray, index) => { const mappedData: Record<string, any> = { _originalIndexExcel: index + 2 }; for (const fieldName in foundHeaders) { let value = rowArray[foundHeaders[fieldName]]; if (fieldName === 'email' && value) value = String(value).toLowerCase().trim(); else if (fieldName === 'revenuePeriod') value = formatRevenuePeriod(value); else if (fieldName === 'paymentStatus') value = normalizePaymentStatus(value); else if (fieldName === 'accountStatus' && value) value = String(value).toLowerCase().trim(); else if ((fieldName === 'account_creation' || fieldName === 'account_start') && value) { const dateVal = convertToJSDate(value); value = dateVal ? dateVal.toISOString() : null; } else if (fieldName === 'revenueUSD') { if (value !== null && value !== undefined && String(value).trim() !== '') { const cleaned = String(value).replace(/[^0-9.-]+/g, ""); const numVal = parseFloat(cleaned); value = isNaN(numVal) ? null : numVal; } else { value = null; } } else if (value && typeof value === 'string') { value = value.trim(); } mappedData[fieldName] = value; } const validation = validateImportRow(mappedData); return { index: index, mappedData, validation, isSelected: validation.isOkToImport }; }); if (parsedSheetData.length === 0) fileProcessingError = "No valid data rows extracted."; updateSelectAllCheckboxState(); } catch (error: any) { console.error("Error processing Excel file:", error); fileProcessingError = `File processing error: ${error.message}`; parsedSheetData = []; } finally { isLoadingFile = false; if (spinner) spinner.classList.add('hidden'); }}
  
  function handleImportRowCheckboxChange(toggledRowIndex: number) { if (parsedSheetData[toggledRowIndex] && parsedSheetData[toggledRowIndex].validation?.isOkToImport) { const newRow = { ...parsedSheetData[toggledRowIndex], isSelected: !parsedSheetData[toggledRowIndex].isSelected }; parsedSheetData = parsedSheetData.map((row, idx) => idx === toggledRowIndex ? newRow : row); updateSelectAllCheckboxState(); } }
  function handleImportSelectAllToggle(event: Event) { const checkbox = event.target as HTMLInputElement; importSelectAllChecked = checkbox.checked; parsedSheetData = parsedSheetData.map(row => ({ ...row, isSelected: row.validation?.isOkToImport ? importSelectAllChecked : false })); updateSelectAllCheckboxState(); }
  function updateSelectAllCheckboxState() { const validRows = parsedSheetData.filter(r => r.validation?.isOkToImport); const selectAllCheckboxEl = document.getElementById('importSelectAllModal') as HTMLInputElement; if (!selectAllCheckboxEl) return; if (validRows.length === 0) { importSelectAllChecked = false; selectAllCheckboxEl.disabled = true; } else { selectAllCheckboxEl.disabled = false; importSelectAllChecked = validRows.every(r => r.isSelected); }}
  $: atLeastOneRowSelected = parsedSheetData.some(row => row.isSelected && row.validation?.isOkToImport);

  async function handleSubmitSelectedImports() {
    const selectedRowsToImport = parsedSheetData
        .filter(row => row.isSelected && row.validation?.isOkToImport)
        .map(row => row.mappedData);

    if (selectedRowsToImport.length === 0) {
        fileProcessingError = "No valid rows are selected for import.";
        setTimeout(() => fileProcessingError = null, 4000);
        return;
    }
    isSubmittingImport = true; fileProcessingError = null;
    const formData = new FormData();
    formData.append('partnersToImportJson', JSON.stringify(selectedRowsToImport));

    let importSucceededOverall = false; // Moved declaration outside try block

    try {
        const response = await fetch('?/importPartners', { method: 'POST', body: formData });
        const responseText = await response.text();
        const result = deserialize(responseText);

        console.log("IMPORT ACTION Full Deserialized result:", JSON.stringify(result, null, 2));

        if (result.type === 'success' && result.data) {
            const outerData = result.data as { type?: string; status?: number; data?: any; success?: boolean; message?: string; successfulUpserts?: number};

            if (outerData.data && typeof outerData.data === 'object' && outerData.data.success === true) { // Primary check for nested payload
                const serverPayload = outerData.data as { success?: boolean; message?: string; successfulUpserts?: number };
                dispatch('importSuccess', { message: serverPayload.message, count: serverPayload.successfulUpserts });
                importSucceededOverall = true;
            } else if (outerData.success === true) { // Fallback check for direct payload
                 dispatch('importSuccess', { message: outerData.message, count: outerData.successfulUpserts });
                 importSucceededOverall = true;
            } else {
                fileProcessingError = outerData.data?.message || outerData.message || "Import processed, but server indicated an issue.";
                if(outerData.data?.errorsByRow) console.error("Import errors from server:", outerData.data.errorsByRow);
            }
        } else if (result.type === 'failure') {
            const failurePayload = result.data as { success?: boolean; message?: string; errorsByRow?: any[], successfulUpserts?:number };
            fileProcessingError = failurePayload?.message || 'Some partners could not be imported due to errors.';
            if (failurePayload?.errorsByRow) console.error("Import server validation errors by row:", failurePayload.errorsByRow);
        } else if (result.type === 'error') {
            fileProcessingError = result.error?.message || 'An unexpected server error occurred during import.';
        } else {
            fileProcessingError = 'Unknown server response type. Check console.';
            console.error("Unknown result from importPartners action:", result);
        }
    } catch (err: any) {
        console.error("Client-side error during import submission fetch:", err);
        fileProcessingError = `Client-side fetch error: ${err.message || 'Could not communicate with server.'}`;
    } finally {
        isSubmittingImport = false; // Always reset this
    }

    if (importSucceededOverall) { // Check the flag set in the try block
        doResetAndDispatchClose(); // This calls resetImportState() and dispatch('close')
    }
  }
</script>

<!-- TEMPLATE for ImportModal.svelte (Assumed correct from previous, no changes here for this fix) -->
<ModalBase bind:showModal title="Import Partner Revenue Entries" on:close={closeByUserAction} modalSize="6xl">
  <div slot="body" class="space-y-4">
    <div>
      <label for="importFileInputModal" class="block text-sm font-medium text-gray-700 mb-1"> Select Excel File (.xlsx) </label>
      <input type="file" id="importFileInputModal" name="importFileModal" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" on:change={handleFileSelect} class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
      <p class="mt-1 text-xs text-gray-600">
        <span class="font-medium">Required columns:</span> Name, Mobile, Email.<br />
        <span class="font-medium">Optional:</span> Address, Webmoney, etc., Revenue Period (YYYY-MM), Revenue (USD), Payment Status.<br />
        <span class="italic">If Revenue (USD) provided, Revenue Period (YYYY-MM) is also required.</span>
      </p>
      <div id="importSpinnerModal" class:hidden={!isLoadingFile && !isSubmittingImport} class="flex items-center text-sm text-blue-600 mt-2">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        {#if isLoadingFile}Processing file...{:else if isSubmittingImport}Submitting import...{/if}
      </div>
    </div>
    {#if fileProcessingError}
      <div class="p-3 bg-red-100 border border-red-300 rounded-md text-sm text-red-700" role="alert"> {fileProcessingError} </div>
    {/if}
    <div class="border border-gray-200 rounded-md overflow-hidden max-h-[45vh] min-h-[200px] flex flex-col">
        <div class="overflow-x-auto flex-grow">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-100 sticky top-0 z-10">
                <tr>
                    <th class="w-12 px-3 py-2.5 text-left font-medium text-gray-500"> <input type="checkbox" id="importSelectAllModal" on:change={handleImportSelectAllToggle} bind:checked={importSelectAllChecked} disabled={parsedSheetData.filter(r => r.validation?.isOkToImport).length === 0} class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" title="Select/Deselect All Valid Rows"> </th>
                    <th class="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[150px]">Name</th> <th class="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[180px]">Email</th> <th class="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[120px]">Mobile</th> <th class="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[100px]">Period</th> <th class="px-3 py-2.5 text-right font-medium text-gray-500 min-w-[100px]">Revenue(USD)</th> <th class="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[110px]">Pay Status</th> <th class="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[200px]">Row Status</th>
                </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    {#if parsedSheetData.length === 0 && !isLoadingFile && !fileProcessingError} <tr><td colspan="8" class="py-10 px-4 text-center text-gray-500 italic">Please select an Excel (.xlsx) file to preview.</td></tr> {:else if parsedSheetData.length === 0 && isLoadingFile} <tr><td colspan="8" class="py-10 px-4 text-center text-gray-500 italic">Loading data from file...</td></tr> {/if}
                    {#each parsedSheetData as row, i (row.index)}
                        <tr class:bg-red-50={row.validation && !row.validation.isOkToImport && !row.isSelected} class:bg-blue-50={row.validation?.warnings.length > 0 && row.validation?.isOkToImport && !row.isSelected} class:bg-green-50={row.isSelected && row.validation?.isOkToImport} class="hover:bg-gray-50 transition-colors duration-100">
                            <td class="px-3 py-2.5 text-center"> <input type="checkbox" class="import-row-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" checked={row.isSelected} disabled={!row.validation?.isOkToImport} on:change={() => handleImportRowCheckboxChange(row.index)} title={row.validation?.isOkToImport ? 'Select this row' : (row.validation?.errors.join(' ') || 'Cannot select, has errors')}> </td>
                            <td class="px-3 py-2.5 whitespace-nowrap truncate max-w-[150px]" title={row.mappedData?.name || ''}>{row.mappedData?.name || '-'}</td> <td class="px-3 py-2.5 whitespace-nowrap truncate max-w-[180px]" title={row.mappedData?.email || ''}>{row.mappedData?.email || '-'}</td> <td class="px-3 py-2.5 whitespace-nowrap truncate max-w-[120px]" title={row.mappedData?.mobile || ''}>{row.mappedData?.mobile || '-'}</td> <td class="px-3 py-2.5 whitespace-nowrap">{row.mappedData?.revenuePeriod || '-'}</td> <td class="px-3 py-2.5 whitespace-nowrap text-right">{row.mappedData?.revenueUSD != null && !isNaN(parseFloat(String(row.mappedData.revenueUSD))) ? parseFloat(String(row.mappedData.revenueUSD)).toFixed(2) : '-'}</td> <td class="px-3 py-2.5 whitespace-nowrap capitalize">{(String(row.mappedData?.paymentStatus || '-')).replace('_', ' ')}</td> <td class="px-3 py-2.5 whitespace-nowrap truncate max-w-[200px] {row.validation?.statusClass || 'text-gray-400'}" title={row.validation ? row.validation.errors.concat(row.validation.warnings).join(' ') : 'Pending'}>{row.validation?.statusText || 'Validating...'}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
  </div>
  <div slot="footer" class="flex md:flex-row-reverse flex-col gap-2 gap-x-3">
    <button id="importAddSelectedBtnModal" type="button" disabled={!atLeastOneRowSelected || isLoadingFile || isSubmittingImport} on:click={handleSubmitSelectedImports} class="inline-flex items-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50"> {#if isSubmittingImport} <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Importing... {:else} Add/Update Selected ({parsedSheetData.filter(r=>r.isSelected && r.validation?.isOkToImport).length}) Entries {/if} </button>
    <button type="button" on:click={closeByUserAction} disabled={isLoadingFile || isSubmittingImport} class="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"> Cancel </button>
  </div>
</ModalBase>