<script lang="ts">
  import { onMount, afterUpdate } from 'svelte'; // afterUpdate might be useful for prevValues
  import { fade, slide } from 'svelte/transition';
  import SummaryCard from './SummaryCard.svelte'; // Assuming SummaryCard handles new props like trend, icon, loading
  import Modal from '$lib/components/Dashboard/modal.svelte';
  import type { PageData, ActionData } from '../$types';
  import { getMonthName } from '$lib/utils/helpers';
  import { PKR_RATE } from '$lib/utils/revenue';
  
  // Type definitions
  import type { Database } from '../../../../types/supabase';
  type Partner = Database['public']['Tables']['partners']['Row'];
  type MonthlyRevenueEntry = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;
  type ActionData = any;
  
  import PartnerForm from '$lib/components/Dashboard/Forms/PartnerForm.svelte';
  import { formatCurrency } from '$lib/utils/formatters';

  export let partners: Partner[] = [];
  export let form: ActionData;

  // --- STATE ---
  let isLoading = true;
  let showModal = false;


  let stats = {
    totalRevenue: { usd: 0, pkr: 0, trend: 'neutral', change: '0%' },
    receivedRevenue: { usd: 0, pkr: 0, trend: 'neutral', change: '0%' },
    activeAccounts: { value: 0, trend: 'neutral', change: '0%' },
    suspendedAccounts: { value: 0, trend: 'neutral', change: '0%' },
  };
  
  let monthlyData: { total: number; received: number; }[] = [];
  
  let chartContainer: HTMLDivElement;
  let tooltip = { visible: false, x: 0, y: 0, month: '', total: '$0', received: '$0' };
  let selectedMonth: number | null = new Date().getMonth();
  let monthlyReport: { totalUSD: number, totalPKR: number, receivedUSD: number, receivedPKR: number, pendingUSD: number, pendingPKR: number } | null = null;
  
  let totalRevenuePath = "", receivedRevenuePath = "";
  const chartMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CHART_WIDTH = 1000, CHART_HEIGHT = 200;

  // --- CORE LOGIC ---
  $: if (partners) {
    processAllData();
  }

  function processAllData() {
    isLoading = true;
    
    const currentMonthIndex = new Date().getMonth();
    const prevMonthIndex = currentMonthIndex > 0 ? currentMonthIndex - 1 : 11;

    let currentMonthStats = calculateStatsForPeriod(partners, currentMonthIndex);
    let prevMonthStats = calculateStatsForPeriod(partners, prevMonthIndex);
    let allTimeStats = calculateStatsForPeriod(partners);

    stats.totalRevenue = {
      usd: allTimeStats.totalRevenueUSD, pkr: allTimeStats.totalRevenuePKR,
      trend: currentMonthStats.totalRevenueUSD > prevMonthStats.totalRevenueUSD ? 'up' : 'down',
      change: getPercentageChange(currentMonthStats.totalRevenueUSD, prevMonthStats.totalRevenueUSD)
    };
    stats.receivedRevenue = {
      usd: allTimeStats.receivedRevenueUSD, pkr: allTimeStats.receivedRevenuePKR,
      trend: currentMonthStats.receivedRevenueUSD > prevMonthStats.receivedRevenueUSD ? 'up' : 'down',
      change: getPercentageChange(currentMonthStats.receivedRevenueUSD, prevMonthStats.receivedRevenueUSD)
    };
    stats.activeAccounts = {
      value: allTimeStats.activeAccounts,
      trend: allTimeStats.activeAccounts > prevMonthStats.activeAccounts ? 'up' : 'down',
      change: getPercentageChange(allTimeStats.activeAccounts, prevMonthStats.activeAccounts, false)
    };
    stats.suspendedAccounts = {
      value: allTimeStats.suspendedAccounts,
      trend: allTimeStats.suspendedAccounts > prevMonthStats.suspendedAccounts ? 'up' : 'down',
      change: getPercentageChange(allTimeStats.suspendedAccounts, prevMonthStats.suspendedAccounts, false)
    };
    
    monthlyData = Array(12).fill(0).map((_, i) => {
      const monthStats = calculateStatsForPeriod(partners, i);
      return { total: monthStats.totalRevenueUSD, received: monthStats.receivedRevenueUSD };
    });

    const allValues = monthlyData.flatMap(d => [d.total, d.received]);
    const maxValue = Math.max(...allValues, 1);
    totalRevenuePath = generateSvgPath(monthlyData.map(d => d.total), maxValue);
    receivedRevenuePath = generateSvgPath(monthlyData.map(d => d.received), maxValue);

    if (selectedMonth !== null) calculateMonthlyReport(selectedMonth);
    isLoading = false;
  }

  /**
   * RESTORED ORIGINAL LOGIC: This function now uses the user's exact, complex business rules.
   * It calculates stats for a given period (or all time if monthIndex is null).
   */
  function calculateStatsForPeriod(partnerData: Partner[], monthIndex: number | null = null) {
      let totalRevenueUSD = 0, totalRevenuePKR = 0;
      let receivedRevenueUSD = 0, receivedRevenuePKR = 0;
      let activeAccounts = 0, suspendedAccounts = 0;

      partnerData.forEach(p => {
        const isPartnerActive = p.account_status === 'active';
        if (monthIndex === null) { // Only count accounts for all-time stats
          if(isPartnerActive) activeAccounts++;
          else if(p.account_status === 'suspended') suspendedAccounts++;
        }

        // API Revenue (only contributes to all-time totals)
        if (monthIndex === null && p.revenue_source === 'api' && p.api_revenue_usd != null && p.api_revenue_usd > 0) {
            totalRevenueUSD += p.api_revenue_usd;
            totalRevenuePKR += (p.api_revenue_pkr || (p.api_revenue_usd * PKR_RATE));
            receivedRevenueUSD += p.api_revenue_usd;
            receivedRevenuePKR += (p.api_revenue_pkr || (p.api_revenue_usd * PKR_RATE));
        }

        // Monthly Revenue Entries
        const monthlyEntries = (p.monthly_revenue || {}) as Record<string, MonthlyRevenueEntry>;
        Object.entries(monthlyEntries).forEach(([period, entry]) => {
            const entryMonth = parseInt(period.split('-')[1], 10) - 1;
            // Filter by month if monthIndex is provided
            if (monthIndex === null || monthIndex === entryMonth) {
                const usd = entry?.usd ?? 0;
                if (usd <= 0) return;
                const pkr = entry?.pkr ?? (usd * PKR_RATE);
                const status = entry?.status || 'pending';

                // Rule: Count revenue from active partners (pending/received) and suspended partners (only received)
                if ((isPartnerActive && (status === 'pending' || status === 'received')) || (!isPartnerActive && status === 'received')) {
                    totalRevenueUSD += usd;
                    totalRevenuePKR += pkr;
                }
                
                // Rule: Received revenue is counted if status is 'received'
                if (status === 'received') {
                    receivedRevenueUSD += usd;
                    receivedRevenuePKR += pkr;
                }
            }
        });
      });
      return { totalRevenueUSD, totalRevenuePKR, receivedRevenueUSD, receivedRevenuePKR, activeAccounts, suspendedAccounts };
  }
  
  // --- UI HELPERS ---
  const getTrendClasses = (trend: string, isPositiveUp: boolean = true) => (trend === 'up' && isPositiveUp) || (trend === 'down' && !isPositiveUp) ? 'up' : (trend === 'down' && isPositiveUp) || (trend === 'up' && !isPositiveUp) ? 'down' : '';
  const getPercentageChange = (current: number, previous: number, showPlus = true) => {
      if (previous === 0) return current > 0 ? (showPlus ? '+100%' : 'New') : '0%';
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 && showPlus ? '+' : ''}${change.toFixed(1)}%`;
  };
  function generateSvgPath(data: number[], maxValue: number): string {
    const points = data.map((d, i) => [(i / 11) * CHART_WIDTH, CHART_HEIGHT - (d / maxValue) * (CHART_HEIGHT - 20) + 10]);
    if (points.length === 0 || points.every(p => isNaN(p[0]) || isNaN(p[1]))) return "M 0 200";
    let path = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
        const x_mid = (points[i][0] + points[i + 1][0]) / 2;
        path += ` Q ${points[i][0]}, ${points[i][1]}, ${x_mid}, ${(points[i][1] + points[i + 1][1]) / 2}`;
    }
    path += ` L ${points[points.length - 1][0]}, ${points[points.length - 1][1]}`;
    return path;
  }
  
  // --- EVENT HANDLERS ---
  const handleMonthClick = (idx: number) => {
    selectedMonth = selectedMonth === idx ? null : idx;
    if (selectedMonth !== null) calculateMonthlyReport(selectedMonth);
  };
  function calculateMonthlyReport(idx: number) {
      const data = calculateStatsForPeriod(partners, idx);
      monthlyReport = {
          totalUSD: data.totalRevenueUSD, totalPKR: data.totalRevenuePKR,
          receivedUSD: data.receivedRevenueUSD, receivedPKR: data.receivedRevenuePKR,
          pendingUSD: data.totalRevenueUSD - data.receivedRevenueUSD,
          pendingPKR: data.totalRevenuePKR - data.receivedRevenuePKR
      };
  };
  const handleMouseMove = (e: MouseEvent) => {
    if (!chartContainer || !monthlyData.length) return;
    const rect = chartContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / rect.width) * 11);
    if (idx >= 0 && idx < 12) {
      const data = monthlyData[idx];
      tooltip = { visible: true, x: (idx / 11) * rect.width, y: e.clientY - rect.top, month: chartMonths[idx], total: formatCurrency(data.total), received: formatCurrency(data.received) };
    }
  };
  const handleMouseLeave = () => { tooltip.visible = false; };

  $: year = new Date().getFullYear();
  $: monthStr = selectedMonth !== null ? `${year}-${String(selectedMonth + 1).padStart(2, '0')}` : null;
</script>

<div class="dashboard-container">
  <div class="dashboard-content">
    <!-- Header -->
    <header class="dashboard-header">
        <div>
      <h2 class="text-2xl font-bold text-gray-800">Account & Revenue Summary</h2>
      <p class="text-sm text-gray-500">Overview of key financial metrics and account statuses.</p>
    </div>
      <button on:click={() => showModal = true} class="add-partner-button mt-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="button-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" /></svg>
        <span>Add Partner</span>
      </button>
    </header>

<!-- Premium Stat Cards with Tailwind CSS -->
<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pb-4">
  <!-- Total Revenue Card -->
  <div class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-50 hover:border-gray-100 overflow-hidden group relative">
    <!-- Accent bar -->
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <div class="p-5">
      <div class="flex justify-between items-start mb-6">
        <div class="p-3 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/></svg>
        </div>
        <span class="{getTrendClasses(stats.totalRevenue.trend)} text-xs font-semibold px-2 py-1 rounded-md bg-white bg-opacity-60 backdrop-blur border border-green-100 text-green-600">
           {stats.totalRevenue.change}
        </span>
      </div>
      
      <div>
        <p class="text-sm font-medium text-gray-500 tracking-wider">TOTAL REVENUE</p>
        <p class="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.totalRevenue.usd)}</p>
        <p class="text-xs text-gray-400 mt-1">{formatCurrency(stats.totalRevenue.pkr, 'PKR')}</p>
      </div>
    </div>
  </div>

  <!-- Received Revenue Card -->
  <div class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-50 hover:border-gray-100 overflow-hidden group relative">
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <div class="p-5">
      <div class="flex justify-between items-start mb-6">
        <div class="p-3 rounded-lg bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
            <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-.53 14.03a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06l-1.72 1.72V8.25a.75.75 0 00-1.5 0v5.69l-1.72-1.72a.75.75 0 00-1.06 1.06l3 3z" clip-rule="evenodd" />
          </svg>
        </div>
        <span class="{getTrendClasses(stats.receivedRevenue.trend)} text-xs font-semibold px-2 py-1 rounded-md bg-white bg-opacity-60 backdrop-blur border border-green-100 text-green-600">
           {stats.receivedRevenue.change}
        </span>
      </div>
      
      <div>
        <p class="text-sm font-medium text-gray-500 tracking-wider">AMOUNT RECEIVED</p>
        <p class="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.receivedRevenue.usd)}</p>
        <p class="text-xs text-gray-400 mt-1">{formatCurrency(stats.receivedRevenue.pkr, 'PKR')}</p>
      </div>
    </div>
  </div>

  <!-- Active Accounts Card -->
  <div class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-50 hover:border-gray-100 overflow-hidden group relative">
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <div class="p-5">
      <div class="flex justify-between items-start mb-6">
        <div class="p-3 rounded-lg bg-sky-50 text-sky-600 group-hover:scale-110 transition-transform duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
            <path fill-rule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" clip-rule="evenodd" />
          </svg>
        </div>
        <span class="{getTrendClasses(stats.activeAccounts.trend)} text-xs font-semibold px-2 py-1 rounded-md bg-white bg-opacity-60 backdrop-blur border border-green-100 text-green-600">
           {stats.activeAccounts.change}
        </span>
      </div>
      
      <div>
        <p class="text-sm font-medium text-gray-500 tracking-wider">ACTIVE ACCOUNTS</p>
        <p class="text-2xl font-bold text-gray-800 mt-1">{stats.activeAccounts.value.toLocaleString()}</p>
        <p class="text-xs text-gray-400 mt-1">Total active partners</p>
      </div>
    </div>
  </div>

  <!-- Suspended Accounts Card -->
  <div class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-50 hover:border-gray-100 overflow-hidden group relative">
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <div class="p-5">
      <div class="flex justify-between items-start mb-6">
        <div class="p-3 rounded-lg bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
            <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clip-rule="evenodd" />
          </svg>
        </div>
        <span class=" {getTrendClasses(stats.suspendedAccounts.trend, false)} text-xs font-semibold px-2 py-1 rounded-md bg-white bg-opacity-60 backdrop-blur border border-red-100 text-red-600">
          {stats.suspendedAccounts.change}
        </span>
      </div>
      
      <div>
        <p class="text-sm font-medium text-gray-500 tracking-wider">SUSPENDED ACCOUNTS</p>
        <p class="text-2xl font-bold text-gray-800 mt-1">{stats.suspendedAccounts.value.toLocaleString()}</p>
        <p class="text-xs text-gray-400 mt-1">Require attention</p>
      </div>
    </div>
  </div>
</section>

    <!-- Interactive Graph & Report Section -->
    <section class="chart-section-wrapper">
      <div class="chart-header">
        <div>
          <h2 class="section-title">Monthly Performance</h2>
          <p class="section-subtitle">Hover for details, click a month to toggle the report.</p>
        </div>
        <div class="chart-legend">
          <div class="legend-item"><span class="legend-dot bg-sky-500"></span> Total Revenue</div>
          <div class="legend-item"><span class="legend-dot bg-teal-500"></span> Received</div>
        </div>
      </div>

      <div class="chart-container" bind:this={chartContainer} on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave}>
        <svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" class="chart-svg" preserveAspectRatio="none">
          <path d={receivedRevenuePath} class="chart-line stroke-teal-500"/>
          <path d={totalRevenuePath} class="chart-line stroke-sky-500"/>
        </svg>
        {#if tooltip.visible}
          <div class="chart-tooltip-line" style="transform: translateX({tooltip.x}px);"></div>
          <div class="tooltip" style="top: {tooltip.y}px; left: {tooltip.x}px;">
            <p class="tooltip-title">{tooltip.month}</p>
            <div class="tooltip-body">
              <div class="tooltip-row"><span>Total:</span> <span class="font-semibold text-sky-600">{tooltip.total}</span></div>
              <div class="tooltip-row"><span>Received:</span> <span class="font-semibold text-teal-600">{tooltip.received}</span></div>
            </div>
          </div>
        {/if}
      </div>
      
      <div class="month-selector-grid">
        {#each chartMonths as month, i}
          <button on:click={() => handleMonthClick(i)} class="month-button" class:active={selectedMonth === i}>{month}</button>
        {/each}
      </div>

      <!-- Collapsible Monthly Report -->
      {#if selectedMonth !== null && monthlyReport}
        <div class="report-wrapper" transition:slide={{duration: 250}}>
          <div class="report-content">
            <div class="report-header">
            <h3 class="report-title">
              Summary for 
              <span class="text-sky-600">
                {monthStr ? getMonthName(monthStr) : 'Select a month'}
              </span>
            </h3>
                <button on:click={() => selectedMonth = null} class="report-close-button" aria-label="Clear selection">×</button>
            </div>
            <div class="report-grid">
              <div class="report-card">
                <p class="report-label">Total Revenue</p>
                <p class="report-value">{formatCurrency(monthlyReport.totalUSD)}</p>
                <p class="report-subvalue">{formatCurrency(monthlyReport.totalPKR, 'PKR')}</p>
              </div>
              <div class="report-card">
                <p class="report-label">Received</p>
                <p class="report-value text-teal-600">{formatCurrency(monthlyReport.receivedUSD)}</p>
                 <p class="report-subvalue">{formatCurrency(monthlyReport.receivedPKR, 'PKR')}</p>
              </div>
              <div class="report-card">
                <p class="report-label">Pending</p>
                <p class="report-value text-amber-600">{formatCurrency(monthlyReport.pendingUSD)}</p>
                 <p class="report-subvalue">{formatCurrency(monthlyReport.pendingPKR, 'PKR')}</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>

{#if showModal}
  <Modal open={showModal} onClose={() => showModal = false}>
    <PartnerForm 
      formAction="?/addPartner"
      submitButtonText="Add Partner Entry"
      serverErrors={form?.action === '?/addPartner' ? form : null}
    />
  </Modal>
{/if} 


<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  /* Base & Layout */
  .dashboard-container {
    font-family: 'Inter', sans-serif;
    /* background-color: #f1f5f9;  */
    min-height: 100vh;
    padding: 1rem;
    padding-top: 0px !important;
    color: #1e293b; /* slate-800 */
  }
  @media (min-width: 640px) { .dashboard-container { padding: 1.25rem; } }
  @media (min-width: 1024px) { .dashboard-container { padding: 0rem; } }

  .dashboard-content {
    max-width: 80rem; /* max-w-7xl */
    margin-left: auto;
    margin-right: auto;
  }

  /* Header */
  .dashboard-header {
    display: flex;
    flex-direction: column;
    margin-bottom: 1rem;
  }
  @media (min-width: 640px) {
    .dashboard-header {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }
  }
  .header-title {
    font-size: 1.875rem; /* text-3xl */
    font-weight: 700;
    color: #0f172a; /* slate-900 */
  }
  .header-subtitle {
    font-size: 1rem; /* text-md */
    color: #64748b; /* slate-500 */
    margin-top: 0.25rem;
  }
  .add-partner-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    background-color: #4f46e5; /* indigo-600 */
    border-radius: 0.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    transition: all 0.2s;
  }
  .add-partner-button:hover { background-color: #4338ca; /* indigo-700 */ }
  .add-partner-button .button-icon { height: 1.25rem; width: 1.25rem; }

  /* Stat Cards */
  .stat-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }
  @media (min-width: 640px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .stat-grid { grid-template-columns: repeat(4, 1fr); } }

  .stat-card {
    background-color: white;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0; /* slate-200/80 */
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    transition: all 0.3s ease-in-out;
  }
  .stat-card:hover {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    transform: translateY(-4px);
  }
  .stat-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .card-icon { height: 2.5rem; width: 2.5rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; }
  .stat-trend { font-size: 0.75rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 9999px; }
  .stat-trend.up { background-color: #d1fae5; color: #065f46; }
  .stat-trend.down { background-color: #fee2e2; color: #991b1b; }
  .stat-card-body { margin-top: 0.5rem; }
  .stat-label { font-size: 0.875rem; font-weight: 500; color: #64748b; }
  .stat-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
  .stat-subvalue { font-size: 0.75rem; color: #94a3b8; }

  /* Chart Section */
  .chart-section-wrapper {
    background-color: white;
    padding: 1.25rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    border: 1px solid #e2e8f0;
  }
  .chart-header { display: flex; flex-direction: column; margin-bottom: 1rem; }
   @media (min-width: 1024px) { .chart-header { flex-direction: row; justify-content: space-between; align-items: center; } }
  .section-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; }
  .section-subtitle { font-size: 0.875rem; color: #64748b; }
  .chart-legend { display: flex; align-items: center; gap: 1rem; font-size: 0.75rem; margin-top: 0.75rem; }
   @media (min-width: 1024px) { .chart-legend { margin-top: 0; } }
  .legend-item { display: flex; align-items: center; gap: 0.5rem; }
  .legend-dot { width: 0.75rem; height: 0.25rem; border-radius: 9999px; }
  .bg-sky-500 { background-color: #0ea5e9; }
  .bg-teal-500 { background-color: #14b8a6; }

.chart-container {
  position: relative;
  width: 100%;
  height: 16rem;
}

@media (max-width: 640px) {
  .chart-container {
    height: auto; /* height hata di mobile pe */
  }
}
  .chart-svg { width: 100%; height: 100%; }
  .chart-line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.5px; }
  .stroke-teal-500 { stroke: #14b8a6; }
  .stroke-sky-500 { stroke: #0ea5e9; }

  .chart-tooltip-line { position: absolute; top: 0; height: 100%; width: 1px; background-color: #cbd5e1; pointer-events: none; }
  .tooltip {
    position: absolute;
    background-color: white;
    padding: 0.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    border: 1px solid #e2e8f0;
    pointer-events: none;
    transition: transform 0.1s ease-out;
    transform: translate(-50%, -120%);
    min-width: 130px;
  }
  .tooltip-title { font-weight: 700; text-align: center; margin-bottom: 0.25rem; font-size: 0.875rem; }
  .tooltip-body { font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.125rem; }
  .tooltip-row { display: flex; justify-content: space-between; align-items: center; }
  .text-sky-600 { color: #0284c7; }
  .text-teal-600 { color: #0d9488; }
  .text-amber-600 { color: #d97706; }

  .month-selector-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.25rem; margin-top: 0.5rem; }
  @media (min-width: 768px) { .month-selector-grid { grid-template-columns: repeat(12, 1fr); } }
  .month-button {
    font-size: 0.75rem; text-align: center; padding: 0.375rem; border-radius: 0.375rem;
    transition: all 0.2s ease-in-out;
    color: #64748b;
    font-weight: 500;
    border: none;
    background: none;
    cursor: pointer;
  }
  .month-button:hover { background-color: #e2e8f0; }
  .month-button.active { background-color: #1e293b; color: white; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); }
  
  /* Report Section */
  .report-wrapper { margin-top: 1rem; }
  .report-content { background-color: #f8fafc; padding: 1rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; }
  .report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .report-title { font-size: 1.125rem; font-weight: 700; }
  .report-close-button {
      color: #94a3b8; width: 1.5rem; height: 1.5rem; border-radius: 9999px;
      display: flex; align-items: center; justify-content: center;
      background-color: #e2e8f0;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
      font-size: 1.25rem;
      line-height: 1;
  }
  .report-close-button:hover { background-color: #cbd5e1; color: #475569; }
  .report-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; text-align: center; }
  @media (min-width: 768px) { .report-grid { grid-template-columns: repeat(3, 1fr); } }
  .report-card { background-color: white; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;}
  .report-label { font-size: 0.75rem; color: #64748b; }
  .report-value { font-weight: 700; font-size: 1.125rem; }
  .report-subvalue { font-size: 0.75rem; color: #94a3b8; }


  :root {
    --card-radius: 12px;
    --card-padding: 1.5rem;
    --icon-size: 2.75rem;
    --transition-speed: 0.25s;
  }
  
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.25rem;
    padding: 0.5rem;
  }
  
  .stat-card {
    background: white;
    border-radius: var(--card-radius);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    padding: var(--card-padding);
    transition: all var(--transition-speed) ease;
    border: 1px solid rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
  }
  
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #4f46e5, #7c3aed);
    opacity: 0;
    transition: opacity var(--transition-speed) ease;
  }
  
  .stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1), 0 6px 6px rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.03);
  }
  
  .stat-card:hover::before {
    opacity: 1;
  }
  
  .card-icon-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-size);
    height: var(--icon-size);
    border-radius: 10px;
    transition: transform var(--transition-speed) ease;
  }
  
  .stat-card:hover .card-icon {
    transform: scale(1.1);
  }
  
  .card-icon svg {
    width: 1.4rem;
    height: 1.4rem;
  }
  
  .stat-trend {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.3rem 0.6rem;
    border-radius: 8px;
    backdrop-filter: blur(4px);
    background-color: rgba(255, 255, 255, 0.6);
  }
  
  .stat-trend.positive {
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  
  .stat-trend.negative {
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
  
  .stat-trend.neutral {
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  
  .stat-label {
    color: #6b7280;
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    letter-spacing: 0.02em;
  }
  
  .stat-value {
    color: #111827;
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
    letter-spacing: -0.01em;
  }
  
  .stat-subvalue {
    color: #9ca3af;
    font-size: 0.85rem;
    font-weight: 400;
  }
  
  /* Smooth color transitions */
  .stat-card,
  .card-icon,
  .stat-trend {
    transition-property: color, background-color, border-color, transform, box-shadow;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: var(--transition-speed);
  }
</style>