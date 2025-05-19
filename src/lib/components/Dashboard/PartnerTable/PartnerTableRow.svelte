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
      {@html revenueStatusHTML}
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
    <button on:click={requestToggleStatus} title={toggleButtonTooltipText} class={toggleButtonClasses}>
      {@html toggleIconSymbolContent}
    </button>
    <button on:click={requestEdit} title="Edit Partner"
            class="p-1.5 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors">
            ✏️
    </button>
    <button on:click={requestDelete} title="Delete Partner"
            class="p-1.5 rounded-md text-red-600 hover:bg-red-100 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition-colors">
            🗑️
    </button>
  </td>
</tr>