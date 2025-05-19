<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData; // From server load function (contains partners, admin from layout)
  export let form: ActionData; // From server actions

  // UI Components
  import SummaryStats from '$lib/components/Dashboard/Summary/SummaryStats.svelte';
  import PartnerTable from '$lib/components/Dashboard/PartnerTable/PartnerTable.svelte';
  import TableSkeleton from '$lib/components/Dashboard/PartnerTable/TableSkeleton.svelte';
  import TableControls from '$lib/components/Dashboard/PartnerTable/TableControls.svelte'; // NEW
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import DeletePartnerModal from '$lib/components/Modals/DeletePartnerModal.svelte';
  import EditPartnerModal from '$lib/components/Modals/EditPartnerModal.svelte';
  import ImportModal from '$lib/components/Modals/ImportModal/ImportModal.svelte';

  // Types
  import type { Database } from '../../../types/supabase'; // Adjust path if needed
  type PartnerType = Database['public']['Tables']['partners']['Row'];
  // For special sort keys - update this based on columns defined in PartnerTable.svelte
  type SortableColumnKey = keyof PartnerType | 'effectiveRevenue' | 'revenuePeriodRange' | 'latestPayStatus' ;


  // SvelteKit Utilities
  import { deserialize, enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { getEffectiveRevenue } from '$lib/utils/revenue'; // For sorting
  import { getMonthName } from '$lib/utils/helpers'; // For revenue period range helper if used in sort

  // --- Component State ---
  let showDeleteModal = false;
  let partnerToDelete: PartnerType | null = null;
  let showEditModal = false;
  let partnerToEdit: PartnerType | null = null;
  let showImportModal = false;
  let actionMessage: string | null = null;
  let actionSuccess: boolean = false;
  let formCacheKey: string | null = null;
  let isRefreshingAllApis = false;

  // --- State for Table Controls & Sorting ---
  let searchTerm: string = '';
  let activeFilter: 'all' | 'recent' | 'active' | 'suspended' = 'all'; // Initial filter
  let currentSortColumn: SortableColumnKey = 'created_at'; // Default sort
  let currentSortDirection: 'asc' | 'desc' = 'desc';

  // --- Helper Functions ---
  function displayActionMessage(message: string, success: boolean, duration: number = 5000) { /* ... same ... */ actionMessage = message; actionSuccess = success; setTimeout(() => { actionMessage = null; }, duration); }
  function openImportModal() { showImportModal = true; }
  async function closeImportModal() { /* ... same ... */ showImportModal = false; }
  async function onImportSuccess(event: CustomEvent<{message?: string, count?: number}>) { /* ... same ... */ displayActionMessage(event.detail.message || `Import successful, ${event.detail.count || 'some'} records processed.`, true, 7000); if (browser) await invalidateAll(); }
  function openDeleteModal(partner: PartnerType) { partnerToDelete = partner; showDeleteModal = true; }
  async function closeDeleteModal() { /* ... same with browser guard for invalidateAll ... */ const wasSuccess = form?.action === '?/deletePartner' && form?.success === true; const msg = form?.message; showDeleteModal = false; partnerToDelete = null; if (wasSuccess) { displayActionMessage(msg || 'Partner deleted.', true); if (browser) await invalidateAll(); }}
  function openEditModal(partner: PartnerType) { partnerToEdit = { ...partner }; showEditModal = true; }
  async function closeEditModal() { /* ... same with browser guard for invalidateAll ... */ const wasSuccess = form?.action?.startsWith('?/editPartner') && form?.success === true; const msg = form?.message; showEditModal = false; partnerToEdit = null; if (wasSuccess) { displayActionMessage(msg || 'Partner updated.', true); if (browser) await invalidateAll(); }}
  async function handleTogglePartnerStatus(partnerToToggle: PartnerType) { /* ... same optimistic update and fetch ... */ if (!partnerToToggle || !partnerToToggle.id) return; const partnerIndex = data.partners.findIndex(p => p.id === partnerToToggle.id); if (partnerIndex === -1) { displayActionMessage("Error: Could not find partner locally.", false); return; } const originalStatus = data.partners[partnerIndex].account_status; const newStatus = originalStatus === 'active' ? 'suspended' : 'active'; data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: newStatus } : p); const formData = new FormData(); formData.append('partnerId', partnerToToggle.id); formData.append('currentStatus', originalStatus || 'active'); try { const response = await fetch('?/toggleAccountStatus', { method: 'POST', body: formData }); const result = deserialize(await response.text()); if (result.type === 'success' && result.data?.data?.success === true) { displayActionMessage(result.data.data.message || 'Status updated!', true); if (browser) await invalidateAll(); } else { throw new Error(result.data?.data?.message || result.data?.message || result.error?.message || 'Failed to update status.');} } catch (err: any) { displayActionMessage(err.message || 'Error updating status.', false); data.partners = data.partners.map((p, i) => i === partnerIndex ? { ...p, account_status: originalStatus } : p);}}

  // --- Reactive Handling for `form` prop updates ---
  // src/routes/(app)/dashboard/+page.svelte (relevant reactive block)
$: {
    const currentFormKey = `${form?.action}-${form?.message}-${form?.success}-${Object.keys(form?.errors || {}).join(',')}`;
    // VITAL: `browser` check here prevents server-side execution of client-only APIs
    if (browser && form && form.message && currentFormKey !== formCacheKey) {
        // Only process if running in the browser AND the form object has a message AND it's a "new" form result
        if (form.action === '?/addPartner' || form.action?.startsWith('?/editPartner') || form.action === '?/refreshAllApiRevenue') {
            displayActionMessage(form.message, form.success === true);
            if (form.success === true) {
                // For Add & Refresh API, invalidate immediately after the action to update the list.
                // For Edit & Delete, invalidation is typically handled in their respective `closeXModal`
                // functions, which are called *after* the user closes the success/error modal.
                // This ensures the user sees the modal feedback before the list refreshes.
                if (form.action === '?/addPartner' || form.action === '?/refreshAllApiRevenue') {
                    console.log(`Client (form reaction): Action ${form.action} successful, calling invalidateAll()`);
                    invalidateAll();
                }
            }
        }
        formCacheKey = currentFormKey; // Update cache after processing
    } else if (browser && form === undefined && formCacheKey) { // If form becomes undefined (e.g. page reload, nav away)
        // This is to reset cache if form is cleared, so next actual form result processes.
        formCacheKey = null;
    }
}

  // --- Event Handlers for TableControls ---
  function handleSearchUpdate(event: CustomEvent<string>) {
    searchTerm = event.detail;
  }
  function handleFilterUpdate(event: CustomEvent<typeof activeFilter>) {
    activeFilter = event.detail;
    // Optionally reset sort when filter changes for simpler UX, or maintain sort
    // currentSortColumn = 'created_at'; currentSortDirection = 'desc';
  }
  function handleSortRequest(event: CustomEvent<SortableColumnKey>) {
    const columnKey = event.detail;
    if (currentSortColumn === columnKey) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = columnKey;
        // Sensible default sort directions
        currentSortDirection = (columnKey === 'name' || columnKey === 'email') ? 'asc' : 'desc';
    }
  }

  // --- Derived `displayedPartners` array ---
  let displayedPartners: PartnerType[] = [];
  $: if (data.partners) {
      let filtered = [...data.partners];

      // 1. Search Filter
      if (searchTerm.trim() !== '') {
          const lowerSearchTerm = searchTerm.toLowerCase().trim();
          filtered = filtered.filter(partner =>
              Object.values(partner).some(value =>
                  value !== null && String(value).toLowerCase().includes(lowerSearchTerm)
              )
          );
      }

      // 2. Status Filter
      if (activeFilter === 'active' || activeFilter === 'suspended') {
          filtered = filtered.filter(p => p.account_status === activeFilter);
      }
      // Note: 'recent' filter not implemented here, would require date logic

      // 3. Sorting Logic
      if (currentSortColumn) {
          filtered.sort((a, b) => {
              let valA: any;
              let valB: any;

              switch (currentSortColumn) {
                  case 'effectiveRevenue':
                      valA = getEffectiveRevenue(a).totalUSD;
                      valB = getEffectiveRevenue(b).totalUSD;
                      break;
                  case 'revenuePeriodRange':
                      // Simple sort: by latest known revenue period. More complex could be latest date.
                      const getLatestPeriodTimestamp = (p: PartnerType) => {
                          const monthly = (p.monthly_revenue || {}) as Record<string, any>;
                          const periods = Object.keys(monthly);
                          if (periods.length === 0) return 0; // No periods, sort last
                          periods.sort().reverse(); // Sort to get latest (e.g. '2023-11' > '2023-10')
                          try { return new Date(periods[0]).getTime(); } catch { return 0; }
                      };
                      valA = getLatestPeriodTimestamp(a);
                      valB = getLatestPeriodTimestamp(b);
                      break;
                  case 'latestPayStatus':
                        const getLatestStatusOrder = (p: PartnerType) => {
                            const monthly = (p.monthly_revenue || {}) as Record<string, any>;
                            const periods = Object.keys(monthly).sort();
                            if (periods.length === 0) return 3; // N/A last
                            const status = monthly[periods[periods.length-1]]?.status || 'pending';
                            if (status === 'received') return 0;
                            if (status === 'pending') return 1;
                            if (status === 'not_received') return 2;
                            return 3;
                        };
                        valA = getLatestStatusOrder(a);
                        valB = getLatestStatusOrder(b);
                        break;
                  default:
                      valA = (a as any)[currentSortColumn];
                      valB = (b as any)[currentSortColumn];
              }

              // Type-aware comparison logic (simplified)
              if (typeof valA === 'string' && typeof valB === 'string') {
                  valA = valA.toLowerCase();
                  valB = valB.toLowerCase();
              } else if (typeof valA === 'number' && typeof valB === 'number') {
                  // standard numeric sort
              } else if (valA && typeof valA === 'string' && valB && typeof valB === 'string') {
                  // Attempt to compare as dates if they look like ISO strings
                  const dateA = new Date(valA).getTime();
                  const dateB = new Date(valB).getTime();
                  if (!isNaN(dateA) && !isNaN(dateB)) {
                      valA = dateA; valB = dateB;
                  }
              }

              if (valA === null || valA === undefined) return currentSortDirection === 'asc' ? 1 : -1;
              if (valB === null || valB === undefined) return currentSortDirection === 'asc' ? -1 : 1;

              if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
              if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
              return 0;
          });
      }
      displayedPartners = filtered;
  } else {
      displayedPartners = [];
  }
</script>

<div class="space-y-8 p-4 md:p-6 lg:p-8">
  <!-- Global Action Message Display -->
  {#if actionMessage}
    <div class="p-4 mb-6 rounded-md text-sm border {actionSuccess ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-300'}" role="alert">
      <p class="font-medium">{actionSuccess ? 'Success!' : (actionMessage.toLowerCase().includes('error') || !actionSuccess ? 'Error!' : 'Info:')}</p>
      <p>{actionMessage}</p>
    </div>
  {/if}

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
             <!-- Placeholder for Export Button -->
            <button type="button" class="btn-secondary inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border text-xs sm:text-sm rounded-md disabled:opacity-50" disabled title="Export to be implemented">
                Export Data
            </button>
        </div>
    </div>

    <!-- NEW: Table Controls Component -->
    <TableControls
      bind:searchTerm={searchTerm}
      bind:currentFilter={activeFilter}
      on:search={handleSearchUpdate}
      on:filterChange={handleFilterUpdate}
    />

    {#if data.admin} <p class="mt-2 mb-4 text-sm text-gray-600">Managing for: <strong>{data.admin.id}</strong></p> {/if}

    {#if data.partners === undefined || data.partners === null } <!-- Initial check if partners array itself isn't ready -->
      <TableSkeleton rows={5} columns={16}/>
      <p class="text-center text-gray-500 mt-4">Loading partners data...</p>
    {:else if displayedPartners.length > 0}
      <PartnerTable
        partners={displayedPartners}
        sortColumn={currentSortColumn}
        sortDirection={currentSortDirection}
        on:requestSort={(e) => handleSortRequest(e.detail as SortableColumnKey)}
        on:requestDelete={(e)=>openDeleteModal(e.detail as PartnerType)}
        on:requestEdit={(e)=>openEditModal(e.detail as PartnerType)}
        on:requestToggleStatus={(e)=>handleTogglePartnerStatus(e.detail as PartnerType)}
      />
    {:else if data.partners.length > 0 && displayedPartners.length === 0}
      <!-- No results from search/filter, but there IS original data -->
      <PartnerTable partners={[]} />
       <p class="text-center text-gray-500 py-8 italic">
            No partners match the current filter or search criteria.
        </p>
    {:else}
      <!-- No partners at all for this admin from server -->
      <PartnerTable partners={[]} />
       <p class="text-center text-gray-500 py-8 italic">
            No partners have been added for this account yet. Use the form above to add one.
        </p>
    {/if}
  </div>
</div>

<!-- Modal Instances -->
{#if partnerToDelete && showDeleteModal} <DeletePartnerModal bind:showModal={showDeleteModal} partnerName={partnerToDelete.name} partnerId={partnerToDelete.id} on:close={closeDeleteModal} /> {/if}
{#if partnerToEdit && showEditModal} <EditPartnerModal bind:showModal={showEditModal} {partnerToEdit} formResult={form} on:close={closeEditModal} /> {/if}
<ImportModal bind:showModal={showImportModal} on:close={closeImportModal} on:importSuccess={onImportSuccess} />