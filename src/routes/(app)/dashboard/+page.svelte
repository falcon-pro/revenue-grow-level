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
  let formCacheKey: string | null = null;

  // --- State for Table Controls & Sorting ---
  let searchTerm: string = ''; // Parent's source of truth
  let activeFilter: 'all' | 'recent' | 'active' | 'suspended' = 'all'; // Parent's source of truth
  let pageSortColumn: SortableColumnKey = 'created_at'; // Renamed from currentSortColumn
  let pageSortDirection: 'asc' | 'desc' = 'desc';      // Renamed from currentSortDirection

  // --- Modal Control & Action Handlers (Toast integration) ---
  function openImportModal() { showImportModal = true; }
  async function closeImportModal() { showImportModal = false; if (form?.action === '?/importPartners' && form?.success && browser) { if (browser) await invalidateAll(); } }
  async function onImportSuccess(event: CustomEvent<{message?: string, count?: number}>) { toast.success(event.detail.message || `Import successful, ${event.detail.count || 'some'} records.`, 7000); if (browser) await invalidateAll(); }
  function openDeleteModal(partner: PartnerType) { partnerToDelete = partner; showDeleteModal = true; }
async function closeDeleteModal() {
    const wasSuccess = form?.action === '?/deletePartner' && form?.success === true;
    const wasFailureWithMsg = form?.action === '?/deletePartner' && form?.success === false && form?.message;
    const msg = form?.message;

    showDeleteModal = false;
    partnerToDelete = null;

    if (wasSuccess) {
        toast.success(msg || 'Partner deleted successfully.'); // Using toast
        if (browser) await invalidateAll();
    } else if (wasFailureWithMsg) { // Explicitly check if success is false AND there's a message
        toast.error(msg || 'Failed to delete partner.'); // Using toast
    } else if (form?.action === '?/deletePartner' && !form?.success) {
        // Fallback if success is not explicitly false but not true either (e.g. only error object from fail)
        toast.error(msg || 'An error occurred while deleting the partner.');
    }
    // Note: if form.action wasn't '?/deletePartner', no toast is shown here by this function,
    // which is correct as this function is only about closing the *delete* modal.
    // The generic $: {form...} block handles messages for actions that don't have modals (like Add).
}

  function openEditModal(partner: PartnerType) { partnerToEdit = { ...partner }; showEditModal = true; }
  async function closeEditModal() { const wasSuccess = form?.action?.startsWith('?/editPartner') && form?.success === true; const msg = form?.message; showEditModal = false; partnerToEdit = null; if (wasSuccess) { toast.success(msg || 'Partner updated.'); if (browser) await invalidateAll(); } else if (form?.action?.startsWith('?/editPartner') && !form?.success) { toast.error(msg || 'Failed to update.'); }}
  async function handleTogglePartnerStatus(partnerToToggle: PartnerType) { if (!partnerToToggle || !partnerToToggle.id) return; const partnerIndex = data.partners.findIndex(p => p.id === partnerToToggle.id); if (partnerIndex === -1) { toast.error("Error: Partner not found."); return; } const originalStatus = data.partners[partnerIndex].account_status; const newStatus = originalStatus === 'active' ? 'suspended' : 'active'; data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: newStatus } : p); const formData = new FormData(); formData.append('partnerId', partnerToToggle.id); formData.append('currentStatus', originalStatus || 'active'); try { const response = await fetch('?/toggleAccountStatus', { method: 'POST', body: formData }); const result = deserialize(await response.text()); if (result.type === 'success' && result.data?.data?.success === true) { toast.success(result.data.data.message || 'Status updated!'); if (browser) await invalidateAll(); } else { throw new Error(result.data?.data?.message || result.data?.message || result.error?.message || 'Failed to update status.');} } catch (err: any) { toast.error(err.message || 'Error updating status.'); data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: originalStatus } : p);}}

  // --- Reactive Handling for `form` prop updates (from Add/Edit/RefreshAll forms) ---
  $: { const currentFormStateSignature = form ? `${form.action}-${form.message}-${form.success}-${JSON.stringify(form.errors)}` : null; if (browser && form && form.message && currentFormStateSignature !== formCacheKey) { if (form.action === '?/addPartner' || form.action?.startsWith('?/editPartner') || form.action === '?/refreshAllApiRevenue') { if (form.success === true) { toast.success(form.message); if (form.action === '?/addPartner' || form.action === '?/refreshAllApiRevenue') { if (browser) invalidateAll(); }} else if (form.success === false) { toast.error(form.message || 'Action failed.'); }} formCacheKey = currentFormStateSignature; } else if (browser && form === undefined && formCacheKey !== null) { formCacheKey = null; }}

  // --- Event Handlers for TableControls ---
  function handleSearchUpdate(event: CustomEvent<string>) {
    searchTerm = event.detail; // Update parent's state based on child's event
  }
  function handleFilterUpdate(event: CustomEvent<typeof activeFilter>) {
    activeFilter = event.detail; // Update parent's state based on child's event
  }
  function handleSortRequest(event: CustomEvent<SortableColumnKey>) {
    const columnKey = event.detail;
    if (pageSortColumn === columnKey) {
        pageSortDirection = pageSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        pageSortColumn = columnKey;
        pageSortDirection = (columnKey === 'name' || columnKey === 'email') ? 'asc' : 'desc';
    }
  }

  // --- Derived `displayedPartners` array (Using renamed sort state) ---
  let displayedPartners: PartnerType[] = [];
  $: if (data.partners) { let filtered = [...data.partners]; if (searchTerm.trim() !== '') { const lowerSearchTerm = searchTerm.toLowerCase().trim(); filtered = filtered.filter(partner => Object.values(partner).some(value => value !== null && String(value).toLowerCase().includes(lowerSearchTerm))); } if (activeFilter === 'active' || activeFilter === 'suspended') { filtered = filtered.filter(p => p.account_status === activeFilter); } if (pageSortColumn) { filtered.sort((a, b) => { let valA: any; let valB: any; switch (pageSortColumn) { case 'effectiveRevenue': valA = getEffectiveRevenue(a).totalUSD; valB = getEffectiveRevenue(b).totalUSD; break; case 'revenuePeriodRange': const getLPT = (p: PartnerType) => { const m = (p.monthly_revenue || {}) as Record<string,any>; const ks=Object.keys(m); if(ks.length===0) return 0; ks.sort().reverse(); try {return new Date(ks[0]).getTime();} catch{return 0;}}; valA = getLPT(a); valB = getLPT(b); break; case 'latestPayStatus': const getLSO = (p: PartnerType) => { const m=(p.monthly_revenue||{}) as Record<string,any>; const ks=Object.keys(m).sort(); if(ks.length===0) return 3; const s=m[ks[ks.length-1]]?.status||'pending'; if(s==='received')return 0; if(s==='pending')return 1; return 2;}; valA = getLSO(a); valB = getLSO(b); break; default: valA = (a as any)[pageSortColumn]; valB = (b as any)[pageSortColumn]; } if (valA === null || valA === undefined) return pageSortDirection === 'asc' ? 1 : -1; if (valB === null || valB === undefined) return pageSortDirection === 'asc' ? -1 : 1; if (typeof valA === 'string' && typeof valB === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); const dA=new Date(valA).getTime(); const dB=new Date(valB).getTime(); if(!isNaN(dA) && !isNaN(dB) && valA.includes('-')){valA=dA; valB=dB;}} if (valA < valB) return pageSortDirection === 'asc' ? -1 : 1; if (valA > valB) return pageSortDirection === 'asc' ? 1 : -1; return 0; }); } displayedPartners = filtered; } else { displayedPartners = []; }

  function exportDisplayedToExcel() {
    if (!displayedPartners || displayedPartners.length === 0) {
        toast.warning('No data displayed to export.'); // Using toast.warning
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

        toast.success('Data exported successfully!'); // <<< --- CORRECTED TO USE TOAST ---
    } catch (e: any) {
      console.error("Error exporting to Excel:", e);
        toast.error(`Export failed: ${e.message}`); // <<< --- CORRECTED TO USE TOAST ---
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
    <PartnerForm formAction="?/addPartner" submitButtonText="Add Partner Entry" serverErrors={form?.action === '?/addPartner' ? form : null}/>
  </div>
  <hr class="my-8 border-gray-300" />

  <!-- Partner Records Section -->
<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <!-- Header Section -->
  <div class="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div class="flex items-center">
        <svg class="h-6 w-6 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-800">Partner Records</h2>
      </div>
      
      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-3">
        <!-- Import Button -->
        <button 
          type="button" 
          on:click={openImportModal}
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150"
        >
          <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
          Import
        </button>

        <!-- Refresh API Button -->
        <form method="POST" action="?/refreshAllApiRevenue" use:enhance={() => {
            isRefreshingAllApis = true;
            toast.info('Starting API revenue refresh for all accounts. This may take a few moments.', 7000);
            return async ({ result }) => { await applyAction(result); isRefreshingAllApis = false; };
        }}>
          <button 
            type="submit" 
            disabled={isRefreshingAllApis}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-75 transition-all duration-150"
          >
            {#if isRefreshingAllApis}
              <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            {:else}
              <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.324 2.43l-1.131.283a.75.75 0 00-.64 1.008l.066.263a6.973 6.973 0 005.537 3.586A7.002 7.002 0 0018 13.002a7.005 7.005 0 00-1.767-4.667l.262.065a.75.75 0 001.008-.64l.283-1.13a5.5 5.5 0 01-2.474 4.8zM4.94 5.842A6.975 6.975 0 0110.002 2a7.002 7.002 0 016.706 9.015l-.262-.066a.75.75 0 00-1.008.64l-.283 1.131a5.502 5.502 0 013.842-7.988.75.75 0 00-.64-1.007l-1.13.282a5.5 5.5 0 00-9.326-2.43l1.13-.283a.75.75 0 01.64-1.007l-.066-.263zm12.188 1.88L17.39 8.29a.75.75 0 00-1.06-1.061l-.262.262a3.001 3.001 0 00-4.243 0L10 9.293l-1.828-1.83a3.001 3.001 0 00-4.243 0l-.262-.262A.75.75 0 002.608 8.29l.262.568A5.476 5.476 0 002 13.002a5.5 5.5 0 008.576 4.243l.262.262a.75.75 0 001.06 0l.568-.262a5.476 5.476 0 004.152-8.576z" clip-rule="evenodd" />
              </svg>
              Refresh APIs
            {/if}
          </button>
        </form>

        <!-- Export Button -->
        <button
          type="button"
          on:click={exportDisplayedToExcel} 
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-150"
        >
          <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          Export
        </button>
      </div>
    </div>

    <!-- {#if data.admin}
      <div class="mt-3 px-2 py-1.5 bg-blue-50 text-blue-800 text-sm rounded-md inline-flex items-center">
        <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Managing for: <strong class="ml-1">{data.admin.id}</strong>
      </div>
    {/if} -->
  </div>

  <!-- Controls Section -->
  <div class="px-6 py-4 bg-gray-50 border-b border-gray-100">
    <TableControls
      searchTerm={searchTerm}
      currentFilter={activeFilter}
      on:searchChange={handleSearchUpdate} 
      on:filterChange={handleFilterUpdate}
    />
  </div>

  <!-- Content Section -->
  <div class="px-6 py-4">
    {#if data.partners === undefined || data.partners === null}
      <div class="space-y-4">
        <TableSkeleton rows={5} columns={16}/>
        <div class="text-center py-4">
          <div class="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-full">
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading partner records...
          </div>
        </div>
      </div>
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
      <div class="text-center py-10">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-2 text-lg font-medium text-gray-900">No matching partners</h3>
        <p class="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
      </div>
    {:else}
      <div class="text-center py-10">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <h3 class="mt-2 text-lg font-medium text-gray-900">No partners yet</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by adding your first partner.</p>
      
      </div>
    {/if}
  </div>
</div>
</div>

<!-- Modal Instances (Unchanged) -->
{#if partnerToDelete && showDeleteModal} <DeletePartnerModal bind:showModal={showDeleteModal} partnerName={partnerToDelete.name} partnerId={partnerToDelete.id} on:close={closeDeleteModal} /> {/if}
{#if partnerToEdit && showEditModal} <EditPartnerModal bind:showModal={showEditModal} {partnerToEdit} formResult={form} on:close={closeEditModal} /> {/if}
<ImportModal bind:showModal={showImportModal} on:close={closeImportModal} on:importSuccess={onImportSuccess} />