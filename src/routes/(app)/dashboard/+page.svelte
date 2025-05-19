<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;

  // UI Components
  import SummaryStats from '$lib/components/Dashboard/Summary/SummaryStats.svelte';
  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import TableControls from '$lib/components/Dashboard/PartnerTable/TableControls.svelte';
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import DeletePartnerModal from '$lib/components/Modals/DeletePartnerModal.svelte';
  import EditPartnerModal from '$lib/components/Modals/EditPartnerModal.svelte';
  import ImportModal from '$lib/components/Modals/ImportModal/ImportModal.svelte';

  // Types
  import type { Database } from '../../../types/supabase';
  type PartnerType = Database['public']['Tables']['partners']['Row'];
  type SortableColumnKey = keyof PartnerType | 'effectiveRevenue' | 'revenuePeriodRange' | 'latestPayStatus' ;

  // Utils
  import { formatDateForExcel, formatRevenueForExcel, getRevenuePeriodRangeForExcel } from '$lib/utils/exportHelpers';
  import { getEffectiveRevenue } from '$lib/utils/revenue';
  import { getMonthName } from '$lib/utils/helpers';
  import * as XLSX from 'xlsx';

  // SvelteKit Utilities
  import { deserialize, enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { toast } from '$lib/stores/toastStore';

  // --- Component State ---
  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null;
  let showEditModal = false;
  let partnerToEdit: PartnerType | null = null;
  let showImportModal = false;
  let isRefreshingAllApis = false;
  let formCacheKey: string | null = null; // For comparing form prop to avoid re-processing messages

  // --- State for Table Controls & Sorting (RENAMED) ---
  let searchTerm: string = '';
  let activeFilter: 'all' | 'recent' | 'active' | 'suspended' = 'all';
  let pageSortColumn: SortableColumnKey = 'created_at'; // RENAMED
  let pageSortDirection: 'asc' | 'desc' = 'desc';      // RENAMED

  // --- Modal Control & Action Handlers (Using toast) ---
  function openImportModal() { showImportModal = true; }
  async function closeImportModal() { showImportModal = false; /* ... existing form check for import ... */ if (form?.action === '?/importPartners' && form?.success && browser) { if (browser) await invalidateAll(); }}
  async function onImportSuccess(event: CustomEvent<{message?: string, count?: number}>) { toast.success(event.detail.message || `Import successful, ${event.detail.count || 'some'} records.`, 7000); if (browser) await invalidateAll(); }
  function openDeleteModal(partner: PartnerType) { partnerToDelete = partner; showDeleteModal = true; }
  async function closeDeleteModal() { const wasSuccess = form?.action === '?/deletePartner' && form?.success === true; const msg = form?.message; showDeleteModal = false; partnerToDelete = null; if (wasSuccess) { toast.success(msg || 'Partner deleted.'); if (browser) await invalidateAll(); } else if (form?.action === '?/deletePartner' && !form?.success) { toast.error(msg || 'Failed to delete.'); }}
  function openEditModal(partner: PartnerType) { partnerToEdit = { ...partner }; showEditModal = true; }
  async function closeEditModal() { const wasSuccess = form?.action?.startsWith('?/editPartner') && form?.success === true; const msg = form?.message; showEditModal = false; partnerToEdit = null; if (wasSuccess) { toast.success(msg || 'Partner updated.'); if (browser) await invalidateAll(); } else if (form?.action?.startsWith('?/editPartner') && !form?.success) { toast.error(msg || 'Failed to update.'); }}
  async function handleTogglePartnerStatus(partnerToToggle: PartnerType) { if (!partnerToToggle || !partnerToToggle.id) return; const partnerIndex = data.partners.findIndex(p => p.id === partnerToToggle.id); if (partnerIndex === -1) { toast.error("Error: Partner not found."); return; } const originalStatus = data.partners[partnerIndex].account_status; const newStatus = originalStatus === 'active' ? 'suspended' : 'active'; data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: newStatus } : p); const formData = new FormData(); formData.append('partnerId', partnerToToggle.id); formData.append('currentStatus', originalStatus || 'active'); try { const response = await fetch('?/toggleAccountStatus', { method: 'POST', body: formData }); const result = deserialize(await response.text()); if (result.type === 'success' && result.data?.data?.success === true) { toast.success(result.data.data.message || 'Status updated!'); if (browser) await invalidateAll(); } else { throw new Error(result.data?.data?.message || result.data?.message || result.error?.message || 'Failed to update status.');} } catch (err: any) { toast.error(err.message || 'Error updating status.'); data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: originalStatus } : p);}}

  // --- Reactive Handling for `form` prop (toast integration) ---
  $: { const currentFormStateSignature = form ? `${form.action}-${form.message}-${form.success}-${JSON.stringify(form.errors)}` : null; if (browser && form && form.message && currentFormStateSignature !== formCacheKey) { if (form.action === '?/addPartner' || form.action?.startsWith('?/editPartner') || form.action === '?/refreshAllApiRevenue') { if (form.success === true) { toast.success(form.message); if (form.action === '?/addPartner' || form.action === '?/refreshAllApiRevenue') { if (browser) invalidateAll(); }} else if (form.success === false) { toast.error(form.message || 'Action failed.'); }} formCacheKey = currentFormStateSignature; } else if (browser && form === undefined && formCacheKey !== null) { formCacheKey = null; }}

  // --- Event Handlers for TableControls (Using RENAMED sort state) ---
  function handleSearchUpdate(event: CustomEvent<string>) {
    searchTerm = event.detail;
  }
  function handleFilterUpdate(event: CustomEvent<typeof activeFilter>) {
    activeFilter = event.detail;
  }
  function handleSortRequest(event: CustomEvent<SortableColumnKey>) {
    const columnKey = event.detail;
    console.log('[+page.svelte] handleSortRequest called with columnKey:', columnKey);
    if (pageSortColumn === columnKey) { // Use RENAMED state
        pageSortDirection = pageSortDirection === 'asc' ? 'desc' : 'asc'; // Use RENAMED state
    } else {
        pageSortColumn = columnKey; // Use RENAMED state
        pageSortDirection = (columnKey === 'name' || columnKey === 'email') ? 'asc' : 'desc'; // Use RENAMED state
    }
    console.log('[+page.svelte] New sort state - Column:', pageSortColumn, 'Direction:', pageSortDirection);
  }

  // --- Derived `displayedPartners` array (Using RENAMED sort state) ---
  let displayedPartners: PartnerType[] = [];
  $: if (data.partners) {
      console.log('[+page.svelte] Recalculating displayedPartners. Sort Column:', pageSortColumn, 'Direction:', pageSortDirection, 'Filter:', activeFilter, 'Search:', searchTerm); // Use RENAMED
      let filtered = [...data.partners];
      if (searchTerm.trim() !== '') { const lowerSearchTerm = searchTerm.toLowerCase().trim(); filtered = filtered.filter(partner => Object.values(partner).some(value => value !== null && String(value).toLowerCase().includes(lowerSearchTerm))); }
      if (activeFilter === 'active' || activeFilter === 'suspended') { filtered = filtered.filter(p => p.account_status === activeFilter); }

      if (pageSortColumn) { // Use RENAMED state
          filtered.sort((a, b) => {
              let valA: any; let valB: any;
              switch (pageSortColumn) { // Use RENAMED state
                  case 'effectiveRevenue': valA = getEffectiveRevenue(a).totalUSD; valB = getEffectiveRevenue(b).totalUSD; break;
                  case 'revenuePeriodRange': const getLPT = (p: PartnerType) => { const m = (p.monthly_revenue || {}) as Record<string,any>; const ks=Object.keys(m); if(ks.length===0) return 0; ks.sort().reverse(); try {return new Date(ks[0]).getTime();} catch{return 0;}}; valA = getLPT(a); valB = getLPT(b); break;
                  case 'latestPayStatus': const getLSO = (p: PartnerType) => { const m=(p.monthly_revenue||{}) as Record<string,any>; const ks=Object.keys(m).sort(); if(ks.length===0) return 3; const s=m[ks[ks.length-1]]?.status||'pending'; if(s==='received')return 0; if(s==='pending')return 1; return 2;}; valA = getLSO(a); valB = getLSO(b); break;
                  default: valA = (a as any)[pageSortColumn]; valB = (b as any)[pageSortColumn]; // Use RENAMED state
              }
              if (valA === null || valA === undefined) return pageSortDirection === 'asc' ? 1 : -1; // Use RENAMED state
              if (valB === null || valB === undefined) return pageSortDirection === 'asc' ? -1 : 1; // Use RENAMED state
              if (typeof valA === 'string' && typeof valB === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); const dA=new Date(valA).getTime(); const dB=new Date(valB).getTime(); if(!isNaN(dA) && !isNaN(dB) && valA.includes('-')){valA=dA; valB=dB;}}
              if (valA < valB) return pageSortDirection === 'asc' ? -1 : 1; // Use RENAMED state
              if (valA > valB) return pageSortDirection === 'asc' ? 1 : -1; // Use RENAMED state
              return 0;
          });
      }
      displayedPartners = filtered;
  } else {
      displayedPartners = [];
  }

  function exportDisplayedToExcel() {
    if (!displayedPartners || displayedPartners.length === 0) {
      displayActionMessage('No data displayed to export.', false); // Use your displayActionMessage
      return;
    }

    console.log("Exporting partners:", displayedPartners.length);

    // Adapt your original data mapping for export
    const exportData = displayedPartners.map(partner => {
      const effectiveRev = getEffectiveRevenue(partner); // You already have this helper
      
      // Recreate simplified status based on PartnerTable display
      let latestPayStatusDisplay = 'N/A';
      const monthlyData = (partner.monthly_revenue || {}) as Record<string, any>;
      const allPeriods = Object.keys(monthlyData).sort();
      if (allPeriods.length > 0) {
          const latestPeriodKeyOverall = allPeriods[allPeriods.length - 1];
          const status = monthlyData[latestPeriodKeyOverall]?.status || 'pending';
          if(status === 'received') latestPayStatusDisplay = 'Received';
          else if(status === 'not_received') latestPayStatusDisplay = 'Not Received';
          else latestPayStatusDisplay = 'Pending';
      }


      return {
        'Partner Name': partner.name || '',
        'Mobile': partner.mobile || '',
        'Email': partner.email || '',
        'Address': partner.address || '',
        'Webmoney ID': partner.webmoney || '',
        'Multi Account No': partner.multi_account_no || '',
        'Adsterra Link': partner.adstera_link || '',
        'Adsterra Email Link': partner.adstera_email_link || '',
        'Adsterra API Key': partner.adstera_api_key || '',
        'Record Added On': formatDateForExcel(partner.created_at),
        'Account Start Date': formatDateForExcel(partner.account_start),
        'Revenue Period Range': getRevenuePeriodRangeForExcel(partner.monthly_revenue),
        'Displayed Revenue Source': effectiveRev.sourceForDisplay?.replace('_', ' ').toUpperCase() || 'N/A',
        'Displayed Total (USD)': formatRevenueForExcel(effectiveRev.totalUSD),
        'Sum of Manual Entries (USD)': formatRevenueForExcel(effectiveRev.manualSumUSD),
        'Last Known API Revenue (USD)': formatRevenueForExcel(partner.api_revenue_usd),
        'Last API Check': formatDateForExcel(partner.last_api_check),
        'Latest Period Pay Status': latestPayStatusDisplay,
        'Account Status': partner.account_status ? partner.account_status.toUpperCase() : 'N/A'
      };
    });

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Optional: Define column widths (example, adjust as needed)
      ws['!cols'] = [
        { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 35 }, { wch: 18 }, 
        { wch: 18 }, { wch: 30 }, { wch: 30 }, { wch: 35 }, { wch: 20 },
        { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 22 }, { wch: 25 },
        { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 } 
      ];

      // Optional: Format specific columns as numbers/currency
      // Find indices of USD columns based on the header order in exportData mapping
      const headers = Object.keys(exportData[0] || {});
      const usdColIndices: number[] = [];
      const targetUsdHeaders = ['Displayed Total (USD)', 'Sum of Manual Entries (USD)', 'Last Known API Revenue (USD)'];
      headers.forEach((h, i) => {
          if (targetUsdHeaders.includes(h)) usdColIndices.push(i);
      });
      
      const sheetDataForFormatting = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      for (let R = 1; R < sheetDataForFormatting.length; ++R) { // Start from row 1 (data)
          usdColIndices.forEach(C => {
              const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
              if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
                  ws[cellRef].t = 'n'; // Type: Number
                  ws[cellRef].z = '$#,##0.00'; // Format: Currency USD
              }
          });
      }


      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PartnerRevenueData"); // Sheet name

      const todayStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Partner_Dashboard_Export_${todayStr}.xlsx`);

      displayActionMessage('Data exported successfully!', true);
    } catch (e: any) {
      console.error("Error exporting to Excel:", e);
      displayActionMessage(`Export failed: ${e.message}`, false);
    }
  }
</script>

<div class="space-y-8 p-4 md:p-6 lg:p-8">
  <!-- Summary Stats Section -->
  {#if data.partners }
    <SummaryStats partners={data.partners} />
  {/if}

  <hr class="my-8 border-gray-300" />

  <!-- Add Partner Form Section -->
  <div>
    <h2 class="text-xl md:text-2xl font-semibold text-gray-800 mb-4">Add New Partner / Revenue</h2>
    <PartnerForm formAction="?/addPartner" submitButtonText="Add Partner Entry" serverErrors={form?.action === '?/addPartner' ? form : null}/>
  </div>

  <hr class="my-8 border-gray-300" />

  <!-- Partner Records Section -->
  <div>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <h2 class="text-xl md:text-2xl font-semibold text-gray-800 whitespace-nowrap">Partner Records</h2>
       <div class="flex flex-wrap gap-2">
            <button type="button" on:click={openImportModal} class="btn-primary inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <svg class="-ml-0.5 sm:-ml-1 mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
                Import
            </button>
            <form method="POST" action="?/refreshAllApiRevenue" use:enhance={() => {
                isRefreshingAllApis = true;
                displayActionMessage('Starting API revenue refresh for all accounts...', true, 10000);
                return async ({ result }) => { await applyAction(result); isRefreshingAllApis = false; };
            }}>
                <button type="submit" disabled={isRefreshingAllApis} class="btn-warning inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50">
                    {#if isRefreshingAllApis} <svg class="animate-spin -ml-0.5 sm:-ml-1 mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Refreshing... {:else} <svg class="-ml-0.5 sm:-ml-1 mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.324 2.43l-1.131.283a.75.75 0 00-.64 1.008l.066.263a6.973 6.973 0 005.537 3.586A7.002 7.002 0 0018 13.002a7.005 7.005 0 00-1.767-4.667l.262.065a.75.75 0 001.008-.64l.283-1.13a5.5 5.5 0 01-2.474 4.8zM4.94 5.842A6.975 6.975 0 0110.002 2a7.002 7.002 0 016.706 9.015l-.262-.066a.75.75 0 00-1.008.64l-.283 1.131a5.502 5.502 0 013.842-7.988.75.75 0 00-.64-1.007l-1.13.282a5.5 5.5 0 00-9.326-2.43l1.13-.283a.75.75 0 01.64-1.007l-.066-.263zm12.188 1.88L17.39 8.29a.75.75 0 00-1.06-1.061l-.262.262a3.001 3.001 0 00-4.243 0L10 9.293l-1.828-1.83a3.001 3.001 0 00-4.243 0l-.262-.262A.75.75 0 002.608 8.29l.262.568A5.476 5.476 0 002 13.002a5.5 5.5 0 008.576 4.243l.262.262a.75.75 0 001.06 0l.568-.262a5.476 5.476 0 004.152-8.576z" clip-rule="evenodd" /></svg> Refresh APIs {/if}
                </button>
            </form>
            <button
    type="button"
    on:click={exportDisplayedToExcel} 
    class="btn-success inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
>
    <svg class="-ml-0.5 sm:-ml-1 mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" /> <!-- Using a generic export/download like icon for now -->
         <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-6.707l2.293-2.293a1 1 0 00-1.414-1.414L11 8.586V5a1 1 0 00-2 0v3.586L7.414 6.293a1 1 0 00-1.414 1.414l2.293 2.293a.997.997 0 001.414 0zM7 14h6a1 1 0 000-2H7a1 1 0 000 2z"/> Placeholder download icon -->
    </svg>
    Export Displayed
</button>

        </div>
    </div>

    <!-- TableControls passes data one-way and listens for events -->
    <TableControls
      searchTerm={searchTerm}
      currentFilter={activeFilter}
      on:searchChange={handleSearchUpdate}  
      on:filterChange={handleFilterUpdate}
    />

    {#if data.admin} <p class="mt-2 mb-4 text-sm text-gray-600">Managing for: <strong>{data.admin.id}</strong></p> {/if}

    {#if data.partners === undefined || data.partners === null }
      <TableSkeleton rows={5} columns={16}/> <p>Loading partners...</p>
    {:else if displayedPartners.length > 0}
      <PartnerTable
        partners={displayedPartners}
        sortColumn={pageSortColumn}   
        sortDirection={pageSortDirection} 
        on:requestSort={handleSortRequest}
        on:requestDelete={(e)=>openDeleteModal(e.detail as PartnerType)}
        on:requestEdit={(e)=>openEditModal(e.detail as PartnerType)}
        on:requestToggleStatus={(e)=>handleTogglePartnerStatus(e.detail as PartnerType)}
      />
    {:else if data.partners.length > 0 && displayedPartners.length === 0}
      <PartnerTable partners={[]} sortColumn={pageSortColumn} sortDirection={pageSortDirection} on:requestSort={handleSortRequest}/> <p>No partners match criteria.</p>
    {:else}
      <PartnerTable partners={[]} sortColumn={pageSortColumn} sortDirection={pageSortDirection} on:requestSort={handleSortRequest}/> <p>No partners added yet.</p>
    {/if}
  </div>
</div>

<!-- Modal Instances (Unchanged) -->
{#if partnerToDelete && showDeleteModal} <DeletePartnerModal bind:showModal={showDeleteModal} partnerName={partnerToDelete.name} partnerId={partnerToDelete.id} on:close={closeDeleteModal} /> {/if}
{#if partnerToEdit && showEditModal} <EditPartnerModal bind:showModal={showEditModal} {partnerToEdit} formResult={form} on:close={closeEditModal} /> {/if}
<ImportModal bind:showModal={showImportModal} on:close={closeImportModal} on:importSuccess={onImportSuccess} />