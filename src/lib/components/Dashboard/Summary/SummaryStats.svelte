<!-- src/lib/components/Dashboard/Summary/SummaryStats.svelte (Updated) -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import SummaryCard from './SummaryCard.svelte'; // Assuming SummaryCard handles new props like trend, icon, loading
  import Modal from '$lib/components/Dashboard/modal.svelte';
  import type { Database } from '../../../../types/supabase'; // Adjust path if needed
  import type { PageData, ActionData } from '../$types';
  type Partner = Database['public']['Tables']['partners']['Row'];
  type MonthlyRevenueEntry = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import { formatCurrency } from '$lib/utils/formatters';
  import { getMonthName } from '$lib/utils/helpers';
  import { PKR_RATE } from '$lib/utils/revenue';
  import { onMount, afterUpdate } from 'svelte'; // afterUpdate might be useful for prevValues

  export let partners: Partner[] = [];
  export let form: ActionData;


  // Summary State
  let isLoading = true; // Starts true, set to false after first calculation
  let totalAccounts = 0;
  let suspendedAccountsCount = 0;
  let totalCountedRevenueUSD = 0;
  let totalCountedRevenuePKR = 0;
  let pendingRevenueUSD = 0;
  let pendingRevenuePKR = 0;
  let receivedRevenueUSD = 0;
  let receivedRevenuePKR = 0;

  // Monthly Filter
  let availableMonthsForFilter: string[] = [];
  let selectedMonthFilter: string = 'all';
  let monthFilteredRevenueUSD = 0;
  let monthFilteredRevenuePKR = 0;
  let monthFilterDescription = 'All time period';

  // Previous values for trend comparison
  let prevValues = {
    totalAccounts: 0,
    suspendedAccountsCount: 0,
    totalCountedRevenueUSD: 0,
    totalCountedRevenuePKR: 0,
    pendingRevenueUSD: 0,
    pendingRevenuePKR: 0,
    receivedRevenueUSD: 0,
    receivedRevenuePKR: 0
  };

  // Calculate trend direction
  function getTrend(current: number, previous: number): 'up' | 'down' | 'neutral' {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  }

  function populateMonthFilterOptions() {
    const months = new Set<string>();
    partners.forEach(p => {
      if (p.monthly_revenue && typeof p.monthly_revenue === 'object') {
        Object.keys(p.monthly_revenue).forEach(period => {
          if (period && /^\d{4}-\d{2}$/.test(period)) {
            months.add(period);
          }
        });
      }
    });
    availableMonthsForFilter = Array.from(months).sort().reverse(); // Newest first
  }

  // Main calculation function
  function calculateSummaries(selectedMonth: string) {
    console.log(`[SummaryStats] Calculating summaries. Selected month: ${selectedMonth}, Partners: ${partners.length}`);
    // Store previous values before updating current ones
    prevValues = {
      totalAccounts, suspendedAccountsCount, totalCountedRevenueUSD, totalCountedRevenuePKR,
      pendingRevenueUSD, pendingRevenuePKR, receivedRevenueUSD, receivedRevenuePKR
    };

    // Reset current aggregate counters
    let newTotalCountedUSD = 0; let newTotalCountedPKR = 0;
    let newPendingUSD = 0;    let newPendingPKR = 0;
    let newReceivedUSD = 0;   let newReceivedPKR = 0;
    let newMonthFilteredUSD = 0;let newMonthFilteredPKR = 0;

    totalAccounts = partners.length;
    suspendedAccountsCount = partners.filter(p => p.account_status === 'suspended').length;

    partners.forEach(p => {
      const isPartnerActive = p.account_status === 'active';
      let partnerHasContributedToTotalFromApi = false;

      // --- Step 1: Process API Revenue if it's the source ---
      if (p.revenue_source === 'api' && p.api_revenue_usd != null && p.api_revenue_usd > 0) {
        newTotalCountedUSD += p.api_revenue_usd;
        newTotalCountedPKR += (p.api_revenue_pkr || (p.api_revenue_usd * PKR_RATE));
        
        // API revenue is considered "received"
        newReceivedUSD += p.api_revenue_usd;
        newReceivedPKR += (p.api_revenue_pkr || (p.api_revenue_usd * PKR_RATE));
        
        partnerHasContributedToTotalFromApi = true;

        // If "All Time" filter is selected, API revenue contributes to this month's filtered total
        if (selectedMonth === 'all') {
          newMonthFilteredUSD += p.api_revenue_usd;
          newMonthFilteredPKR += (p.api_revenue_pkr || (p.api_revenue_usd * PKR_RATE));
        }
      }

      // --- Step 2: Process Manual Monthly Revenue entries ---
      const monthlyEntries = (p.monthly_revenue || {}) as Record<string, MonthlyRevenueEntry>;
      Object.entries(monthlyEntries).forEach(([period, entry]) => {
        const usd = entry?.usd ?? 0;
        if (usd <= 0) return; // Skip zero or negative revenue entries

        const pkr = entry?.pkr ?? (usd * PKR_RATE);
        const status = entry?.status || 'pending';

        // Determine if this *manual* entry counts for the "Total Counted Revenue"
        let countThisManualEntryForOverallTotal = false;
        if (isPartnerActive && (status === 'pending' || status === 'received')) {
          countThisManualEntryForOverallTotal = true;
        } else if (!isPartnerActive && status === 'received') { // Suspended partner
          countThisManualEntryForOverallTotal = true;
        }

        // Add to Total Counted Revenue IF:
        // 1. This manual entry is eligible based on its status/partner activity, AND
        // 2. EITHER the partner's primary revenue wasn't from API OR the partner source is specifically manual/api_error
        // This tries to avoid double-counting for the grand total if API already provided the main figure.
        if (countThisManualEntryForOverallTotal) {
            if (!partnerHasContributedToTotalFromApi || p.revenue_source === 'manual' || p.revenue_source === 'api_error' || p.revenue_source === 'api_loading') {
                 newTotalCountedUSD += usd;
                 newTotalCountedPKR += pkr;
            }
        }
        
        // Pending Revenue: From active partners with 'pending' manual entries
        if (isPartnerActive && status === 'pending') {
          newPendingUSD += usd;
          newPendingPKR += pkr;
        }

        // Received Revenue: From any partner with 'received' manual entries
        // If partner is API-sourced, its API revenue already counted towards Received.
        // Add manual 'received' only if source is not 'api' or if API revenue was 0 (so manual is primary for received).
        if (status === 'received') {
            if (p.revenue_source !== 'api' || (p.revenue_source === 'api' && (p.api_revenue_usd == null || p.api_revenue_usd === 0))) {
                newReceivedUSD += usd;
                newReceivedPKR += pkr;
            }
        }

        // Monthly Filtered Total:
        if (countThisManualEntryForOverallTotal && (selectedMonth === 'all' || period === selectedMonth)) {
          // If showing a specific month, always include its manual entries.
          // If showing "All Time", only include manual entries if partner source isn't API (to avoid double count with API sum).
          if (selectedMonth !== 'all' || (p.revenue_source !== 'api')) {
            newMonthFilteredUSD += usd;
            newMonthFilteredPKR += pkr;
          }
        }
      });
    });

    // Update component state variables which are bound to the template
    totalCountedRevenueUSD = newTotalCountedUSD;
    totalCountedRevenuePKR = newTotalCountedPKR;
    pendingRevenueUSD = newPendingUSD;
    pendingRevenuePKR = newPendingPKR;
    receivedRevenueUSD = newReceivedUSD;
    receivedRevenuePKR = newReceivedPKR;
    monthFilteredRevenueUSD = newMonthFilteredUSD;
    monthFilteredRevenuePKR = newMonthFilteredPKR;
    monthFilterDescription = selectedMonth === 'all' 
      ? 'All time period (summary rules applied)' 
      : `For ${getMonthName(selectedMonth)} (summary rules applied)`;

    isLoading = false; // Data has been calculated
    console.log(`[SummaryStats] Updated totals - Total Counted USD: ${totalCountedRevenueUSD}`);
  }

  // React to data changes
  let initialLoadDone = false;
  onMount(() => {
      if (partners && partners.length >= 0) { // check >=0 to run even if partners is empty array initially
        populateMonthFilterOptions();
        calculateSummaries(selectedMonthFilter);
        initialLoadDone = true;
      }
  });

  // Use afterUpdate to react if `partners` prop changes *after* initial mount
  // This ensures calculations run if parent page re-fetches and passes new `partners` array.
  let prevPartnersLength = partners?.length || 0;
  let prevPartnersRef = partners; // Store reference
  
  afterUpdate(() => {
      if (!initialLoadDone && partners && partners.length >= 0) {
          // This might catch cases where onMount didn't have partners yet due to parent load timing
          populateMonthFilterOptions();
          calculateSummaries(selectedMonthFilter);
          initialLoadDone = true;
          prevPartnersLength = partners.length;
          prevPartnersRef = partners;
      } else if (initialLoadDone && partners !== prevPartnersRef) { // Check if array reference changed
          console.log("[SummaryStats] `partners` prop reference changed, recalculating.");
          populateMonthFilterOptions();
          calculateSummaries(selectedMonthFilter);
          prevPartnersLength = partners.length;
          prevPartnersRef = partners;
      }
      // Also consider if content of partners array changed but not reference.
      // However, SvelteKit typically passes new array reference from `load` function.
  });


  // React to filter changes by user
  $: if (selectedMonthFilter && partners) {
    isLoading = true;
    setTimeout(() => calculateSummaries(selectedMonthFilter), 300); // Small delay for smooth UX
  }

    let showModal = false;

  function openModal() {
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }


</script>

<div class="dashboard-summary" transition:fade|local={{ duration: 200 }}>
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
    <div>
      <h2 class="text-2xl font-bold text-gray-800">Account & Revenue Summary</h2>
      <p class="text-sm text-gray-500">Overview of key financial metrics and account statuses.</p>
    </div>
    
    <div class="relative w-full md:w-auto md:min-w-[200px] flex items-center">
        <!-- Add Partner Button -->
  <div class="flex whitespace-nowrap mr-5">
  <button
    on:click={openModal}
    class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:ring-2 focus:ring-blue-400 focus:outline-none text-white font-semibold text-sm md:text-base px-5 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 ease-in-out cursor-pointer"
  >
    <!-- Heroicons Plus Icon -->
    <svg
  xmlns="http://www.w3.org/2000/svg"
  class="w-5 h-5 text-white"
  fill="currentColor"
  viewBox="0 0 20 20"
  aria-hidden="true"
>
  <path
    fill-rule="evenodd"
    d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
    clip-rule="evenodd"
  />
</svg>

    <span>Add Partner</span>
  </button>
</div>

  <!-- Modal with Form -->
  <Modal open={showModal} onClose={closeModal}>
    <PartnerForm
      formAction="?/addPartner"
      submitButtonText="Add Partner Entry"
      serverErrors={form?.action === '?/addPartner' ? form : null}
    />
  </Modal>


      <select
        bind:value={selectedMonthFilter}
        class="w-full pl-4 pr-10 py-2 text-sm bg-white border border-gray-200 rounded-lg shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
        aria-label="Select period for revenue summary"
      >
        <option value="all">All Time Periods</option>
        {#each availableMonthsForFilter as monthStr (monthStr)}
          <option value={monthStr}>{getMonthName(monthStr)}</option>
        {/each}
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
    <SummaryCard
      label="Total Accounts"
      value={totalAccounts}
      trend={getTrend(totalAccounts, prevValues.totalAccounts)}
      description="Active + Suspended"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 12.094A5.973 5.973 0 004 15v1H1v-1a3 3 0 013.75-2.906z"/></svg>`}
      loading={isLoading}
    />
    <SummaryCard
      label="Suspended Accounts"
      value={suspendedAccountsCount}
      trend={getTrend(suspendedAccountsCount, prevValues.suspendedAccountsCount)}
      description="Currently inactive"
      valueClasses="text-red-600"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`}
      loading={isLoading}
    />
    <SummaryCard
      label="Total Counted Revenue"
      value={formatCurrency(totalCountedRevenueUSD)}
      trend={getTrend(totalCountedRevenueUSD, prevValues.totalCountedRevenueUSD)}
      description={formatCurrency(totalCountedRevenuePKR, 'PKR')}
      valueClasses="text-green-600"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/></svg>`}
      loading={isLoading}
    />
    <SummaryCard
      label="Received Revenue"
      value={formatCurrency(receivedRevenueUSD)}
      trend={getTrend(receivedRevenueUSD, prevValues.receivedRevenueUSD)}
      description={formatCurrency(receivedRevenuePKR, 'PKR')}
      valueClasses="text-blue-600"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`}
      loading={isLoading}
    />
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <div class="bg-yellow-50 p-5 rounded-xl border border-yellow-100">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-medium text-yellow-800">Pending Revenue</h3>
        <div class="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        </div>
      </div>
      <p class="text-2xl font-bold text-yellow-700 mb-1">{isLoading && !initialLoadDone ? '--' : formatCurrency(pendingRevenueUSD)}</p>
      <p class="text-sm text-yellow-600">{isLoading && !initialLoadDone ? 'Loading...' : formatCurrency(pendingRevenuePKR, 'PKR')}</p>
      <p class="text-xs text-yellow-500 mt-2">From active accounts with pending payment status</p>
    </div>

    <div class="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100 lg:col-span-2">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 class="font-medium text-indigo-800">Revenue for Selected Period</h3>
          <p class="text-sm text-indigo-600 mt-1">{monthFilterDescription}</p>
        </div>
        <div class="text-right md:min-w-[200px]"> 
          <p class="text-3xl font-bold text-indigo-700">{isLoading && !initialLoadDone ? '--' : formatCurrency(monthFilteredRevenueUSD)}</p>
          <p class="text-lg text-blue-600">{isLoading && !initialLoadDone ? '--' : formatCurrency(monthFilteredRevenuePKR, 'PKR')}</p>
        </div>
      </div>
      {#if !isLoading || initialLoadDone}
        <div class="mt-4">
          <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Contribution to total</span>
            <span>{Math.round((monthFilteredRevenueUSD / (totalCountedRevenueUSD || 1)) * 100)}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div class="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={`width: ${Math.max(0, Math.min(100, (monthFilteredRevenueUSD / (totalCountedRevenueUSD || 1)) * 100))}%`}></div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dashboard-summary {
    /* animation: fadeIn 0.3s ease-out; */ /* Can re-enable if desired, but reactive updates might be better */
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); }}
  .shadow-xs { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
</style>