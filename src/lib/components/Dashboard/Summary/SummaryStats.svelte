<!-- src/lib/components/Dashboard/Summary/SummaryStats.svelte -->
<script lang="ts">
  import type { Database } from '../../../../types/supabase'; // Adjust path
  type Partner = Database['public']['Tables']['partners']['Row'];
  type MonthlyRevenueEntry = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;

  import SummaryCard from './SummaryCard.svelte';
  import { formatCurrency } from '$lib/utils/formatters';
  import { getMonthName } from '$lib/utils/helpers';
  import { PKR_RATE } from '$lib/utils/revenue'; // Needed for revenue calcs
  import { onMount } from 'svelte';

  export let partners: Partner[] = [];

  // --- Summary State ---
  let totalAccounts = 0;
  let suspendedAccountsCount = 0;
  let totalCountedRevenueUSD = 0;
  let totalCountedRevenuePKR = 0;
  let pendingRevenueUSD = 0;
  let pendingRevenuePKR = 0;
  let receivedRevenueUSD = 0;
  let receivedRevenuePKR = 0;

  // --- For Monthly Revenue Filter ---
  let availableMonthsForFilter: string[] = [];
  let selectedMonthFilter: string = 'all'; // "YYYY-MM" or "all"
  let monthFilteredRevenueUSD = 0;
  let monthFilteredRevenuePKR = 0;
  let monthFilterDescription = '';


  // Recalculate summaries when partners data changes
  $: if (partners) {
    calculateSummaries(selectedMonthFilter);
    populateMonthFilterOptions();
  }

  // Recalculate monthly summary when filter changes
  $: if (selectedMonthFilter && partners) {
     // console.log("Selected month filter changed to:", selectedMonthFilter);
     calculateSummaries(selectedMonthFilter); // Re-run full calc for simplicity
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


  function calculateSummaries(selectedMonth: string) {
    totalAccounts = partners.length;
    suspendedAccountsCount = partners.filter(p => p.account_status === 'suspended').length;

    let newTotalCountedUSD = 0; let newTotalCountedPKR = 0;
    let newPendingUSD = 0;     let newPendingPKR = 0;
    let newReceivedUSD = 0;    let newReceivedPKR = 0;
    let newMonthFilteredUSD = 0; let newMonthFilteredPKR = 0;

    partners.forEach(p => {
        const monthlyEntries = (p.monthly_revenue || {}) as Record<string, MonthlyRevenueEntry>;
        const isPartnerActive = p.account_status === 'active';

        Object.entries(monthlyEntries).forEach(([period, entry]) => {
            const usd = entry?.usd ?? 0;
            if (usd <= 0) return; // Skip zero/negative revenue entries for sums

            const pkr = entry?.pkr ?? (usd * PKR_RATE);
            const status = entry?.status || 'pending';

            // Total Counted Revenue Rules:
            // - Active partner: count if status is 'pending' or 'received'.
            // - Suspended partner: count *only if* status is 'received'.
            let countForTotalRevenue = false;
            if (isPartnerActive && (status === 'pending' || status === 'received')) {
                countForTotalRevenue = true;
            } else if (!isPartnerActive && status === 'received') { // Suspended
                countForTotalRevenue = true;
            }

            if (countForTotalRevenue) {
                newTotalCountedUSD += usd;
                newTotalCountedPKR += pkr;
            }

            // Pending Revenue Rules: (Active Accounts, Period Pending)
            if (isPartnerActive && status === 'pending') {
                newPendingUSD += usd;
                newPendingPKR += pkr;
            }

            // Received Revenue Rules: (All Account Statuses, Period Received)
            if (status === 'received') {
                newReceivedUSD += usd;
                newReceivedPKR += pkr;
            }

            // Monthly Filtered Total (apply same "countForTotalRevenue" rules)
            if (countForTotalRevenue && (selectedMonth === 'all' || period === selectedMonth)) {
                newMonthFilteredUSD += usd;
                newMonthFilteredPKR += pkr;
            }
        });
    });

    totalCountedRevenueUSD = newTotalCountedUSD;
    totalCountedRevenuePKR = newTotalCountedPKR;
    pendingRevenueUSD = newPendingUSD;
    pendingRevenuePKR = newPendingPKR;
    receivedRevenueUSD = newReceivedUSD;
    receivedRevenuePKR = newReceivedPKR;
    monthFilteredRevenueUSD = newMonthFilteredUSD;
    monthFilteredRevenuePKR = newMonthFilteredPKR;
    monthFilterDescription = `(${getMonthName(selectedMonth)}, applying activity/payment rules)`;
  }

  onMount(() => {
    // Initial calculations
    populateMonthFilterOptions();
    calculateSummaries(selectedMonthFilter);
  });

</script>

<div>
  <h2 class="text-xl font-semibold text-gray-800 mb-4">Account Summary</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-3 sm:p-5 bg-indigo-50 rounded-lg border border-indigo-200">
    <SummaryCard label="Total Accounts" value={totalAccounts} description="(All Statuses)" valueClasses="text-indigo-700" />
    <SummaryCard label="Suspended" value={suspendedAccountsCount} description="Accounts" valueClasses="text-red-600" />
    <SummaryCard label="Total Counted Revenue" value={`${formatCurrency(totalCountedRevenueUSD)} / ${formatCurrency(totalCountedRevenuePKR, 'PKR')}`} description="(Rules applied)" valueClasses="text-green-700 !text-lg" />
    <SummaryCard label="Pending Revenue" value={`${formatCurrency(pendingRevenueUSD)} / ${formatCurrency(pendingRevenuePKR, 'PKR')}`} description="(Active, Period Pending)" valueClasses="text-yellow-700 !text-lg" />
    <SummaryCard label="Received Revenue" value={`${formatCurrency(receivedRevenueUSD)} / ${formatCurrency(receivedRevenuePKR, 'PKR')}`} description="(All, Period Received)" valueClasses="text-blue-700 !text-lg" />

    <!-- Monthly Revenue Filter Card -->
     <div class="bg-white p-4 rounded-lg shadow border border-gray-200 sm:col-span-2 lg:col-span-3 xl:col-span-full">
        <label for="monthFilterSelect" class="block text-sm font-medium text-gray-600 mb-1">Revenue for Period</label>
         <div class="flex flex-col sm:flex-row items-start sm:items-center sm:gap-x-4 gap-y-2">
            <select id="monthFilterSelect" bind:value={selectedMonthFilter}
                    class="form-select text-sm w-full sm:w-auto min-w-[150px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                <option value="all">All Time</option>
                {#each availableMonthsForFilter as monthStr}
                    <option value={monthStr}>{getMonthName(monthStr)}</option>
                {/each}
            </select>
            <div class="mt-2 sm:mt-0 flex-grow sm:text-right">
                <p class="text-lg font-semibold whitespace-nowrap text-purple-700">
                    {formatCurrency(monthFilteredRevenueUSD)} / {formatCurrency(monthFilteredRevenuePKR, 'PKR')}
                </p>
                <span class="text-xs text-gray-500 block">{monthFilterDescription}</span>
            </div>
        </div>
    </div>

  </div>
</div>