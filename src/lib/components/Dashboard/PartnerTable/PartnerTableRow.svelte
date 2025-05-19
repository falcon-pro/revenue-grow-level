<!-- src/lib/components/Dashboard/PartnerTable/PartnerTableRow.svelte -->
<script lang="ts">
  // Assuming you've defined Partner type using Supabase types or manually
  import type { Database } from '../../../../types/supabase'; // Adjust path as needed
  type Partner = Database['public']['Tables']['partners']['Row'];

  import { formatDate, formatCurrency } from '$lib/utils/formatters';
  import { getMonthName } from '$lib/utils/helpers';
  import { getEffectiveRevenue } from '$lib/utils/revenue';
  import { createEventDispatcher } from 'svelte'; // Import createEventDispatcher

  export let partner: Partner;

  const dispatch = createEventDispatcher(); // Create dispatcher instance

  const isSuspended = partner.account_status === 'suspended';
  const rowClass = isSuspended ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50';

  // --- Logic from original renderPartnerRow, adapted ---
  const monthlyData = partner.monthly_revenue || {};
  const periodsWithPositiveRevenue = Object.keys(monthlyData).filter(period => {
      const entry = (monthlyData as Record<string, any>)[period];
      return entry && typeof entry.usd === 'number' && entry.usd > 0;
  }).sort();

  let revenuePeriodStr = '-';
  if (periodsWithPositiveRevenue.length === 1) {
      revenuePeriodStr = getMonthName(periodsWithPositiveRevenue[0]);
  } else if (periodsWithPositiveRevenue.length > 1) {
      revenuePeriodStr = `${getMonthName(periodsWithPositiveRevenue[0])} - ${getMonthName(periodsWithPositiveRevenue[periodsWithPositiveRevenue.length - 1])}`;
  }

  const allPeriods = Object.keys(monthlyData).sort();
  let latestStatusText = 'N/A';
  let latestStatusClass = 'text-gray-700 bg-gray-100 border-gray-200';

  if (allPeriods.length > 0) {
      const latestPeriodKeyOverall = allPeriods[allPeriods.length - 1];
      const latestStatus = (monthlyData as Record<string, any>)[latestPeriodKeyOverall]?.status || 'pending';
      switch (latestStatus) {
          case 'received': latestStatusText = 'Received'; latestStatusClass = 'text-green-700 bg-green-100 border-green-200'; break;
          case 'not_received': latestStatusText = 'Not Received'; latestStatusClass = 'text-red-700 bg-red-100 border-red-200'; break;
          case 'pending': default: latestStatusText = 'Pending'; latestStatusClass = 'text-yellow-700 bg-yellow-100 border-yellow-200'; break;
      }
  }

  const effectiveRevenueData = getEffectiveRevenue(partner);
  let displayRevenueUSD = effectiveRevenueData.totalUSD;
  let displayRevenuePKR = effectiveRevenueData.totalPKR;
  let displayRevenueSource = effectiveRevenueData.sourceForDisplay;

  const createdDateStr = formatDate(partner.created_at);
  const accountStartStr = formatDate(partner.account_start);
  const lastApiCheckStr = formatDate(partner.last_api_check) || '-';

  let revenueStatusHTML = '';
  let revenueTooltip = '';
  const errorMsg = partner.api_error_message || 'Fetch failed.';

  switch (displayRevenueSource) {
      case 'api_loading':
          revenueStatusHTML = `<span class="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" title="API Check Pending"></span>`;
          revenueTooltip = `Checking Adsterra API... Last attempt: ${lastApiCheckStr}. Displaying 0.`;
          displayRevenueUSD = 0; displayRevenuePKR = 0;
          break;
      case 'api_error':
          displayRevenueUSD = effectiveRevenueData.manualSumUSD;
          displayRevenuePKR = effectiveRevenueData.manualSumPKR;
          revenueStatusHTML = `<span title="API Error" class="text-red-500">⚠️</span>`;
          revenueTooltip = `API Error (${lastApiCheckStr}). Error: ${errorMsg}.`;
          if (displayRevenueUSD > 0) revenueTooltip += ` Showing SUM of Manual entries.`;
          else revenueTooltip += ` No Manual entries found.`;
          break;
      case 'api':
          revenueStatusHTML = `<span title="API Sourced" class="text-blue-500">⚙️</span>`;
          revenueTooltip = `Displaying total from Adsterra API (Checked: ${lastApiCheckStr})`;
          break;
      case 'manual':
      default:
          if (effectiveRevenueData.manualSumUSD > 0) {
              revenueStatusHTML = `<span title="Manual Sourced" class="text-gray-500">📝</span>`;
              revenueTooltip = "Displaying SUM of manually entered revenue periods.";
          } else {
              revenueStatusHTML = '';
              revenueTooltip = "No revenue data.";
          }
          break;
  }

  const revenueUSDStr = displayRevenueUSD != null ? formatCurrency(displayRevenueUSD, 'USD') : '-';
  const revenuePKRStr = displayRevenueUSD != null && displayRevenueUSD > 0 && displayRevenuePKR != null ? `(${formatCurrency(displayRevenuePKR, 'PKR')})` : '';

  const toggleButtonTooltip = isSuspended ? 'Activate Account' : 'Suspend Account';
  const toggleIconClasses = isSuspended ? 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 focus:ring-yellow-500';
  const toggleIconSymbol = isSuspended ? '▶️' : '⏸️';

  // Dispatch events instead of console.log
  const requestToggleStatus = () => dispatch('requestToggleStatus', partner);
  const requestEdit = () => dispatch('requestEdit', partner);
  const requestDelete = () => dispatch('requestDelete', partner); // This one is new/modified

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
    <div class="flex items-center space-x-1" title={revenueTooltip}>
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
    <button on:click={requestToggleStatus} title={toggleButtonTooltip}
            class="p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 {toggleIconClasses}">
            {@html toggleIconSymbol}
    </button>
      <button on:click={() => dispatch('requestEdit', partner)} title="Edit Partner"
            class="p-1.5 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors">
            ✏️
    </button>
    <button on:click={requestDelete} title="Delete Partner" 
            class="p-1.5 rounded-md text-red-600 hover:bg-red-100 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition-colors">
            🗑️
    </button>
  </td>
</tr>