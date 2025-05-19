<!-- src/lib/components/Dashboard/PartnerTable/PartnerTableRow.svelte -->
<script lang="ts">
  import type { Database } from '../../../../types/supabase'; // Adjust path as needed
  type Partner = Database['public']['Tables']['partners']['Row'];
  type MonthlyRevenueEntryType = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;


  import { formatDate, formatCurrency } from '$lib/utils/formatters';
  import { getMonthName } from '$lib/utils/helpers';
  import { getEffectiveRevenue, PKR_RATE } from '$lib/utils/revenue'; // PKR_RATE might not be needed directly here
  import { createEventDispatcher } from 'svelte';

  export let partner: Partner;
  const dispatch = createEventDispatcher();

  // --- Reactive Derived State using $: ---
  // These will recompute if `partner` or its relevant properties change.
  $: isSuspended = partner.account_status === 'suspended';
  $: rowClass = isSuspended ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50';

  $: monthlyData = (partner.monthly_revenue || {}) as Record<string, MonthlyRevenueEntryType>;

  $: periodsWithPositiveRevenue = Object.keys(monthlyData).filter(period => {
      const entry = monthlyData[period];
      return entry && typeof entry.usd === 'number' && entry.usd > 0;
  }).sort();

  $: revenuePeriodStr = (() => {
      if (periodsWithPositiveRevenue.length === 1) {
          return getMonthName(periodsWithPositiveRevenue[0]);
      } else if (periodsWithPositiveRevenue.length > 1) {
          return `${getMonthName(periodsWithPositiveRevenue[0])} - ${getMonthName(periodsWithPositiveRevenue[periodsWithPositiveRevenue.length - 1])}`;
      }
      return '-';
  })();

  $: ({ latestStatusText, latestStatusClass } = (() => {
      const allPeriodsSorted = Object.keys(monthlyData).sort();
      let text = 'N/A';
      let cssClass = 'text-gray-700 bg-gray-100 border-gray-200';
      if (allPeriodsSorted.length > 0) {
          const latestPeriodKeyOverall = allPeriodsSorted[allPeriodsSorted.length - 1];
          const status = monthlyData[latestPeriodKeyOverall]?.status || 'pending';
          switch (status) {
              case 'received': text = 'Received'; cssClass = 'text-green-700 bg-green-100 border-green-200'; break;
              case 'not_received': text = 'Not Received'; cssClass = 'text-red-700 bg-red-100 border-red-200'; break;
              default: text = 'Pending'; cssClass = 'text-yellow-700 bg-yellow-100 border-yellow-200'; break;
          }
      }
      return { latestStatusText: text, latestStatusClass: cssClass };
  })());

  $: effectiveRevenueData = getEffectiveRevenue(partner);

  // Using values directly from effectiveRevenueData, making them reactive to its change.
  // The "finalDisplayUSD / PKR" names are for clarity if transformation occurs within this component,
  // but here they mostly map directly from effectiveRevenueData.
  $: finalDisplayUSD = effectiveRevenueData.totalUSD;
  $: finalDisplayPKR = effectiveRevenueData.totalPKR;
  $: displayRevenueSource = effectiveRevenueData.sourceForDisplay;

  // Constants that only depend on initially passed `partner` props that don't change via status toggle
  const createdDateStr = formatDate(partner.created_at);
  const accountStartStr = formatDate(partner.account_start);
  const lastApiCheckStr = formatDate(partner.last_api_check) || '-'; // Could be reactive if last_api_check can change during optimistic update
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

  $: revenueUSDStr = finalDisplayUSD != null ? formatCurrency(finalDisplayUSD, 'USD') : '-';
  $: revenuePKRStr = finalDisplayUSD != null && finalDisplayUSD > 0 && finalDisplayPKR != null ? `(${formatCurrency(finalDisplayPKR, 'PKR')})` : '';

  $: toggleButtonTooltipText = isSuspended ? 'Activate Account' : 'Suspend Account';
  $: toggleIconSymbolContent = isSuspended ? '▶️' : '⏸️';
  $: toggleButtonClasses = `p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${isSuspended ? 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 focus:ring-yellow-500'}`;


  // Dispatch event functions
  const requestToggleStatus = () => dispatch('requestToggleStatus', partner);
  const requestEdit = () => dispatch('requestEdit', partner);
  const requestDelete = () => dispatch('requestDelete', partner);

</script>

<tr class="transition-colors duration-150 ease-in-out {rowClass}">
  <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-[150px]" title={partner.name || ''}>{partner.name || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{partner.mobile || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[180px]" title={partner.email || ''}>{partner.email || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[180px]" title={partner.address || ''}>{partner.address || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{partner.webmoney || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{partner.multi_account_no || '-'}</td>
  <td class="px-4 py-3 text-left whitespace-nowrap text-sm">
    <a href={partner.adstera_link || '#'} target="_blank" rel="noopener noreferrer"
        class="truncate max-w-[120px] block {partner.adstera_link ? 'text-blue-600 hover:text-blue-800 hover:underline' : 'text-gray-400 cursor-default'}"
        title={partner.adstera_link || ''}>
      {partner.adstera_link ? (partner.adstera_link.length > 20 ? partner.adstera_link.substring(0,20) + '...' : partner.adstera_link) : '-'}
    </a>
  </td>
  <td class="px-4 py-3 text-left whitespace-nowrap text-sm">
      <a href={partner.adstera_email_link || '#'} target="_blank" rel="noopener noreferrer"
        class="truncate max-w-[120px] block {partner.adstera_email_link ? 'text-blue-600 hover:text-blue-800 hover:underline' : 'text-gray-400 cursor-default'}"
        title={partner.adstera_email_link || ''}>
      {partner.adstera_email_link ? (partner.adstera_email_link.length > 20 ? partner.adstera_email_link.substring(0,20) + '...' : partner.adstera_email_link) : '-'}
    </a>
  </td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[120px]" title={partner.adstera_api_key || 'No API Key'}>
    {partner.adstera_api_key ? (partner.adstera_api_key.length > 10 ? partner.adstera_api_key.substring(0,7) + '...' : partner.adstera_api_key) : '-'}
  </td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{createdDateStr}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{accountStartStr}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{revenuePeriodStr}</td>
<td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-800">
  <div class="flex items-center space-x-1" title={revenueTooltipForRender}>
    <div>
      <span class="block">{revenueUSDStr}</span>
      {#if revenuePKRStr}
        <span class="text-xs font-normal text-gray-500 block">{revenuePKRStr}</span>
      {/if}
    </div>
    <!-- NEW SVG ICONS for Revenue Source -->
    {#if displayRevenueSource === 'api_loading'}
      <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" title="API Check Pending"></span>
    {:else if displayRevenueSource === 'api_error'}
      <!-- Heroicon: x-circle -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-red-500" title="API Error">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16ZM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
      </svg>
    {:else if displayRevenueSource === 'api'}
      <!-- Heroicon: cpu-chip -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-blue-500" title="API Sourced">
        <path d="M7.75 2.75A.75.75 0 006 3.5v13A.75.75 0 006.75 18h6.5A.75.75 0 0014 17.25v-13A.75.75 0 0013.25 3h-1.5A.75.75 0 0011 2.25h-2A.75.75 0 008.25 3h-1.5A.75.75 0 006 3.5v-1A.75.75 0 007.75 2.75z" />
        <path d="M6.75 4H11v2.5H6.75V4zM6.75 7.5H11V10H6.75V7.5zM6.75 11H11v2.5H6.75V11zM11.75 4H13V2h-1.25v2zM11.75 6H13V4h-1.25v2zM11.75 8H13V6h-1.25v2zM11.75 10H13V8h-1.25v2zM11.75 12H13v-2h-1.25v2zM11.75 14H13v-2h-1.25v2zM11.75 16H13v-2h-1.25v2zM11.75 18H13v-2h-1.25v2zM5.25 4H6V2H5.25v2zM5.25 6H6V4H5.25v2zM5.25 8H6V6H5.25v2zM5.25 10H6V8H5.25v2zM5.25 12H6v-2H5.25v2zM5.25 14H6v-2H5.25v2zM5.25 16H6v-2H5.25v2zM5.25 18H6v-2H5.25v2z" />
        <path d="M2 5.75A.75.75 0 012.75 5h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 5.75zM2.75 15A.75.75 0 002 14.25v-8.5A.75.75 0 002.75 7H3V5H2.75A2.25 2.25 0 00.5 7.25v8.5A2.25 2.25 0 002.75 18H3v-2h-.25A.75.75 0 002.75 15z" />
        <path d="M17.25 15a.75.75 0 01-.75.75H17v2h.25a2.25 2.25 0 002.25-2.25v-8.5A2.25 2.25 0 0017.25 5H17v2h.25a.75.75 0 01.75.75v8.5z" />
      </svg>
    {:else if displayRevenueSource === 'manual' && effectiveRevenueData.manualSumUSD > 0}
      <!-- Heroicon: document-text -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-gray-500" title="Manual Entry">
        <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm2.25 3h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5zM6.75 9a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clip-rule="evenodd" />
      </svg>
    {/if}
  </div>
</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
    <span class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border {latestStatusClass}">
      {latestStatusText}
    </span>
  </td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {isSuspended ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}">
      <svg class="-ml-0.5 mr-1.5 h-2 w-2 {isSuspended ? 'text-red-400' : 'text-green-400'}" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
      {partner.account_status === 'active' ? 'Active' : 'Suspended'}
    </span>
  </td>

<td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-1">
  <!-- Status Toggle Button -->
  <button on:click={requestToggleStatus} title={toggleButtonTooltipText} class="p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 {toggleButtonClasses}">
    {#if isSuspended}
      <!-- Heroicon: play-circle (outline) for Activate -->
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
      </svg>
    {:else}
      <!-- Heroicon: pause-circle (outline) for Suspend -->
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    {/if}
  </button>

  <!-- Edit Button -->
  <button on:click={requestEdit} title="Edit Partner"
          class="p-1.5 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors">
    <!-- Heroicon: pencil-square (outline) -->
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
      <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  </button>

  <!-- Delete Button -->
  <button on:click={requestDelete} title="Delete Partner"
          class="p-1.5 rounded-md text-red-600 hover:bg-red-100 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition-colors">
    <!-- Heroicon: trash (outline) -->
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12.56 0c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  </button>
</td>
</tr>