<!-- src/lib/components/Dashboard/PartnerTable/PartnerTableRow.svelte -->
<script lang="ts">
  import type { Database } from '../../../../types/supabase';
  // Updated Partner type to include new optional fields
  type Partner = Database['public']['Tables']['partners']['Row'] & {
      api_total_impressions?: number | null;
      api_country_breakdown?: Array<{ countryCode: string, impressions: number, revenue: number }> | null;
  };
  type MonthlyRevenueEntryType = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;

  import { formatDate, formatCurrency } from '$lib/utils/formatters';
  import { getMonthName } from '$lib/utils/helpers';
  import { getEffectiveRevenue } from '$lib/utils/revenue';
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly } from 'svelte/transition';

  export let partner: Partner;
  const dispatch = createEventDispatcher();
  
  let mounted = false;
  onMount(() => mounted = true);

  // Reactive Derived State
  $: isSuspended = partner.account_status === 'suspended';

  $: monthlyData = (partner.monthly_revenue || {}) as Record<string, MonthlyRevenueEntryType>;

  $: periodsWithPositiveRevenue = Object.keys(monthlyData).filter(period => {
      const entry = monthlyData[period];
      return entry && typeof entry.usd === 'number' && entry.usd > 0;
  }).sort();

  $: revenuePeriodStr = (() => {
      if (periodsWithPositiveRevenue.length === 1) return getMonthName(periodsWithPositiveRevenue[0]);
      if (periodsWithPositiveRevenue.length > 1) return `${getMonthName(periodsWithPositiveRevenue[0])} - ${getMonthName(periodsWithPositiveRevenue[periodsWithPositiveRevenue.length - 1])}`;
      return 'N/A';
  })();

  $: ({ latestStatusText, latestStatusClass } = (() => {
      const allPeriodsSorted = Object.keys(monthlyData).sort();
      let text = 'N/A';
      let cssClass = 'text-slate-600 bg-slate-100 border-slate-300'; // Default, less prominent
      if (allPeriodsSorted.length > 0) {
          const latestPeriodKeyOverall = allPeriodsSorted[allPeriodsSorted.length - 1];
          const status = monthlyData[latestPeriodKeyOverall]?.status || 'pending';
          switch (status) {
              case 'received': text = 'Received'; cssClass = 'text-green-700 bg-green-100 border-green-300'; break;
              case 'not_received': text = 'Not Rcvd'; cssClass = 'text-red-700 bg-red-100 border-red-300'; break;
              default: text = 'Pending'; cssClass = 'text-yellow-700 bg-yellow-100 border-yellow-300'; break;
          }
      }
      return { latestStatusText: text, latestStatusClass: `${cssClass} px-2.5 py-1 text-xs font-semibold rounded-full border` };
  })());

  $: effectiveRevenueData = getEffectiveRevenue(partner);
  $: finalDisplayUSD = effectiveRevenueData.totalUSD;
  $: finalDisplayPKR = effectiveRevenueData.totalPKR;
  $: displayRevenueSource = effectiveRevenueData.sourceForDisplay;

  const createdDateStr = formatDate(partner.created_at, { month: 'short', day: 'numeric', year: 'numeric' });
  const accountStartStr = formatDate(partner.account_start, { month: 'short', day: 'numeric', year: 'numeric' });
  const lastApiCheckStr = formatDate(partner.last_api_check) || 'N/A';
  const apiErrorMsg = partner.api_error_message || 'Fetch failed.';

  // This block calculates revenueStatusHTML and revenueTooltip based on reactive values
  $: ({ revenueStatusHTML, revenueTooltipForRender } = (() => {
    let html = '';
    let tooltip = '';
    // Use reactive displayRevenueSource and other derived values here
    switch (displayRevenueSource) {
        case 'api_loading':
            html = `<span class="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" title="API Check Pending"></span>`;
            tooltip = `Checking Adsterra API... Last attempt: ${lastApiCheckStr}. Displaying 0.`;
            break;
        case 'api_error':
            html = `<span title="API Error" class="text-red-500">⚠️</span>`;
            tooltip = `API Error (${lastApiCheckStr}). Error: ${apiErrorMsg}.`;
            if (effectiveRevenueData.manualSumUSD > 0) tooltip += ` Showing SUM of Manual entries.`; // Use manualSum from effectiveRevenueData
            else tooltip += ` No Manual entries found.`;
            break;
        case 'api':
            html = `<span title="API Sourced" class="text-blue-500">⚙️</span>`;
            tooltip = `Displaying total from Adsterra API (Checked: ${lastApiCheckStr})`;
            break;
        case 'manual':
        default:
            if (effectiveRevenueData.manualSumUSD > 0) {
                html = `<span title="Manual Sourced" class="text-gray-500">📝</span>`;
                tooltip = "Displaying SUM of manually entered revenue periods.";
            } else {
                tooltip = "No revenue data.";
            }
            break;
    }
    return { revenueStatusHTML: html, revenueTooltipForRender: tooltip };
  })());

  $: revenueUSDStr = finalDisplayUSD != null ? formatCurrency(finalDisplayUSD, 'USD') : 'N/A';
  $: revenuePKRStr = finalDisplayUSD != null && finalDisplayUSD > 0 && finalDisplayPKR != null ? `(${formatCurrency(finalDisplayPKR, 'PKR')})` : '';

  $: toggleButtonTooltipText = isSuspended ? 'Activate Account' : 'Suspend Account';

  // NEW: Reactive variables for new partner fields
  $: totalApiImpressionsForDisplay = (partner.api_total_impressions != null && partner.api_total_impressions > 0)
    ? partner.api_total_impressions.toLocaleString()
    : '-';
  
  $: topCountriesDisplay = (() => {
    if (partner.api_country_breakdown && Array.isArray(partner.api_country_breakdown) && partner.api_country_breakdown.length > 0) {
      return partner.api_country_breakdown.slice(0, 3).map(
        c => `${c.countryCode}: ${c.impressions.toLocaleString()} imp / $${c.revenue.toFixed(2)}`
      ).join('; ');
    }
    return 'N/A';
  })();
  
  const requestToggleStatus = () => dispatch('requestToggleStatus', partner);
  const requestEdit = () => dispatch('requestEdit', partner);
  const requestDelete = () => dispatch('requestDelete', partner);

  interface DataItem {
    label: string;
    value: string | undefined | null;
    icon?: string; // Heroicon path
    truncate?: boolean;
    isLink?: boolean;
    linkHref?: string | undefined | null;
    title?: string;
    customClass?: string;
  }
  
  // Re-organized as per request
  let primaryInfo: DataItem[] = [
    { label: "Email", value: partner.email, truncate: true, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />' },
    { label: "Mobile", value: partner.mobile, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 2.25h9a1.5 1.5 0 0 1 1.5 1.5v16.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5V3.75a1.5 1.5 0 0 1 1.5-1.5zM12 18.75h.008v.008H12v-.008z" />' },
    { label: "Webmoney", value: partner.webmoney,   icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6zM12 9.75v4.5M8.25 9.75h7.5" />'},
   { label: "Apify Accounts", value: partner.apify_accounts != null ? String(partner.apify_accounts) : null, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V5.25A2.25 2.25 0 0 0 18 3H6A2.25 2.25 0 0 0 3.75 3Zm0 0H6M3.75 3v3.75M3.75 14.25v3.75M6 16.5h12M18 16.5v3.75M18 3v3.75m-12-3.75h12M9.75 7.5h4.5M9.75 10.5h4.5M9.75 13.5h4.5Z" />' },

    ];

  let adsterraInfo: DataItem[] = [
    { label: "Address", value: partner.address, truncate: true, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />' },
    { label: "Multi Acc No.", value: partner.multi_account_no, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />' },
    { label: "Ad Link", value: partner.adstera_link, isLink: true, truncate: true, linkHref: partner.adstera_link, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />' },
    { label: "Ad Email", value: partner.adstera_email_link, isLink: true, truncate: true, linkHref: partner.adstera_email_link, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5-16.5a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 6.75v4.5a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 19.5 11.25V9Z" />' },
    { label: "API Key", value: partner.adstera_api_key, truncate: true, title: partner.adstera_api_key || 'No API Key', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />' },
  ];

const valueDisplay = (val: string | undefined | null): string => val ?? 'N/A';
  const truncateText = (text: string | undefined | null, length: number = 25) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

</script>

<div 
  class="bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden transition-all duration-300 ease-in-out hover:shadow-xl flex flex-col"
  class:border-red-300={isSuspended}
  class:shadow-red-100={isSuspended}
>
  <!-- Card Header: Name and Status -->
  <div class="p-5 border-b border-slate-200 {isSuspended ? 'bg-red-50' : 'bg-slate-50'}">
    <div class="flex justify-between items-start">
      <h3 class="text-lg font-semibold text-slate-800 leading-tight truncate pr-2" title={partner.name}>
        {partner.name || 'Unnamed Partner'}
      </h3>
      <span class="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full border whitespace-nowrap {isSuspended ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'}">
        <svg class="-ml-0.5 mr-1.5 h-2 w-2 {isSuspended ? 'text-red-500' : 'text-green-500'}" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
        {partner.account_status === 'active' ? 'Active' : 'Suspended'}
      </span>
    </div>
    <p class="text-xs text-slate-500 mt-1">
      Added: {createdDateStr} • Started: {accountStartStr || 'N/A'}
    </p>
  </div>

  <!-- Card Body: Main Info -->
  <div class="p-5 space-y-4 flex-grow">
    <!-- Revenue Section -->
    <div class="mb-3" title={revenueTooltipForRender}>
      <div class="flex items-center justify-between mb-1">
          <p class="text-sm font-medium text-slate-500">Display Revenue</p>
          <div class="flex items-center space-x-1.5">
            {#if displayRevenueSource === 'api_loading'}
              <span class="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" title="API Check Pending"></span>
            {:else if displayRevenueSource === 'api_error'}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-red-500" title="API Error"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" /></svg>
            {:else if displayRevenueSource === 'api'}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-sky-500" title="API Sourced"><path d="M10.75 3.917c.433-.095.88-.167 1.341-.225a22.38 22.38 0 004.257-.597V2.75A.75.75 0 0015.6 2H4.4A.75.75 0 003.65 2.75v.345c1.474.223 2.87.518 4.257.854.46.104.908.181 1.341.233A24.896 24.896 0 0110 4c.69 0 1.372-.03 2.036-.088.3-.026.595-.06.887-.1-.018-.002-.037-.003-.055-.005A.75.75 0 0013.25 3h-1.5A.75.75 0 0011 2.25H9A.75.75 0 008.25 3H6.75a.75.75 0 00-.418.132c-.019.01-.038.02-.056.03C7.14 3.102 7.828 3.03 8.5 3c.69 0 1.372.03 2.036.088.083.007.166.015.249.022.02.002.04.003.059.005.086.009.171.018.257.027l.076.008.08.007.146.012c.03.002.06.005.089.007.074.006.148.01.222.013.06.003.119.005.179.006a24.896 24.896 0 011.076 0Z"/><path fill-rule="evenodd" d="M3 5.578A21.905 21.905 0 0010 6.25c2.815 0 5.526-.262 8.08-.752v9.004c0 .885-.386 1.705-1.033 2.288-.701.633-1.606.962-2.56.962H5.513c-.954 0-1.859-.329-2.56-.962C2.386 16.287 2 15.467 2 14.582V4.827c.376.06.755.123 1.138.187.211.035.424.068.642.097.234.032.47.06.708.083.252.024.505.044.759.06C6.177 5.253 6.43 5.27 6.68 5.285c.292.018.583.03.874.038.273.008.547.012.82.012.302 0 .604-.005.906-.014.28-.008.558-.02.835-.034.256-.013.513-.03.768-.051.21-.017.419-.038.627-.061l-.001.002zM10 14a1 1 0 001-1V9a1 1 0 10-2 0v4a1 1 0 001 1Z" clip-rule="evenodd"/></svg>
            {:else if displayRevenueSource === 'manual' && effectiveRevenueData.manualSumUSD > 0}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-slate-500" title="Manual Entry"><path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm2.25 3h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5zM6.75 9a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clip-rule="evenodd" /></svg>
            {/if}
          </div>
      </div>
      <div class="flex gap-2 justify-between items-center">
      <p class="text-2xl font-bold text-slate-700">{revenueUSDStr}
        {#if revenuePKRStr}
        <span class="text-sm font-medium text-slate-500 ml-1">{revenuePKRStr}</span>
        {/if}
      </p>
      <span class="{latestStatusClass} !py-0.5 !px-1.5">{latestStatusText}</span>
      </div>
      <div class="flex justify-between text-xs mt-1">
        <div class="flex flex-col gap-2">
        <span class="text-slate-500">Rev. Period: {revenuePeriodStr}</span>
        <span class="text-slate-500">Total Impressions:  {totalApiImpressionsForDisplay}</span>
        </div>
      </div>
    </div>
    <hr class="border-slate-100">

    <!-- Primary Info -->
    <dl class="grid grid-cols-1 gap-x-3 gap-y-3 text-sm">
      {#each primaryInfo as item (item.label)}
      <div class="flex items-start group">
          {#if item.icon && mounted}
             <span in:fly={{ y:5, duration: 200, delay: 100 }} class="flex-shrink-0 w-5 h-5 text-sky-600 mr-2.5 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    {@html item.icon}
                </svg>
            </span>
          {/if}
          <div class="flex-grow">
              <dt class="font-medium text-slate-500">{item.label}</dt>
              <dd class="text-slate-700 {item.truncate ? 'truncate' : ''}" title={item.value || ''}>
                  {@html valueDisplay(item.truncate ? truncateText(item.value, 20) : item.value)}
              </dd>
          </div>
      </div>
      {/each}
       <!-- NEW: Top Countries -->
           <div class="flex items-start group/item sm:col-span-2">
             <span class="flex-shrink-0 w-5 h-5 text-sky-600 mr-2.5 mt-0.5">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A11.978 11.978 0 0 1 12 16.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 0 21 12c0-.778.099 1.533-.284-2.253M18.75 14.25a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z" /></svg>
             </span>
             <div class="flex-grow min-w-0">
                <dt class="font-medium text-slate-500">Countries / Impressions :</dt>
                <dd class="text-slate-700 whitespace-pre-wrap text-xs">
                    {topCountriesDisplay}
                </dd>
            </div>
           </div>
      <!-- NEW: Total API Impressions -->
      <!-- <div class="flex items-start group">
        <span class="flex-shrink-0 w-5 h-5 text-sky-600 mr-2.5 mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
        </span>
        <div class="flex-grow min-w-0">
            <dt class="font-medium text-slate-500">API Impressions (365d)</dt>
            <dd class="text-slate-700">
                {totalApiImpressionsForDisplay}
            </dd>
        </div>
      </div> -->
    </dl>
    
    <hr class="border-slate-100">
    <!-- Adsterra/Technical Info -->
    <details class="group">
        <summary class="text-sm font-medium text-slate-600 hover:text-sky-700 cursor-pointer list-none flex justify-between items-center">
            <span>Adsterra & Technical Details</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 transition-transform duration-200 group-open:rotate-180 text-slate-400 group-hover:text-sky-600">
              <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
        </summary>
        <dl class="mt-3 grid grid-cols-1 gap-x-3 gap-y-3 text-sm">
           {#each adsterraInfo as item (item.label)}
            <div class="flex items-start group/item">
                 {#if item.icon && mounted}
                 <span in:fly={{ y:5, duration: 200, delay: 100 }} class="flex-shrink-0 w-5 h-5 text-sky-600 mr-2.5 mt-0.5">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                         {@html item.icon}
                     </svg>
                 </span>
                 {/if}
                <div class="flex-grow">
                    <dt class="font-medium text-slate-500">{item.label}</dt>
                    {#if item.isLink && item.value}
                        <dd class="text-sky-600 hover:text-sky-700 hover:underline {item.truncate ? 'truncate' : ''}" title={item.value}>
                            <a href={item.linkHref || '#'} target="_blank" rel="noopener noreferrer">
                                {truncateText(item.value, 30)}
                            </a>
                        </dd>
                    {:else}
                        <dd class="text-slate-700 {item.truncate ? 'truncate' : ''}" title={item.title || item.value || ''}>
                            {@html valueDisplay(item.truncate ? truncateText(item.value) : item.value)}
                        </dd>
                    {/if}
                </div>
            </div>
            {/each}
            
        </dl>
    </details>

  </div>

  <!-- Card Footer: Actions -->
  <div class="p-4 bg-slate-50 border-t border-slate-200/80 mt-auto">
    <div class="flex items-center justify-end space-x-2">
      <button 
        on:click={requestToggleStatus} 
        title={toggleButtonTooltipText} 
        class="p-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 text-sm font-medium
               {isSuspended 
                ? 'bg-green-100 text-green-700 hover:bg-green-200 focus-visible:ring-green-500' 
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 focus-visible:ring-yellow-500'}">
        {#if isSuspended}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" /></svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
        {/if}
      </button>

      <button 
        on:click={requestEdit} 
        title="Edit Partner"
        class="p-2.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sky-500 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
      </button>

      <button 
        on:click={requestDelete} 
        title="Delete Partner"
        class="p-2.5 rounded-lg text-red-600 bg-red-100 hover:bg-red-200 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12.56 0c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
      </button>
    </div>
  </div>
</div>