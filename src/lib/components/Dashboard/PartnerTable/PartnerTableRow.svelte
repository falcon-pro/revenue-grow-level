<!-- src/lib/components/Dashboard/PartnerTable/PartnerTableRow.svelte -->
<script lang="ts">
  // type Partner = any; // Or your proper Partner type
  // import type { Database } from '../../../types/supabase';
  // type Partner = Database['public']['Tables']['partners']['Row'];
  type Partner = any; // Using 'any' for now for simplicity

  import { formatDate, formatCurrency } from '$lib/utils/formatters'; // We'll create these

  export let partner: Partner;

  // Placeholder for effective revenue - we'll build this logic out properly later
  function getDisplayedRevenue(p: Partner) {
    if (p.revenue_source === 'api' && p.api_revenue_usd != null) {
      return { usd: p.api_revenue_usd, source: 'API' };
    }
    // Basic sum from monthly_revenue (very simplified for now)
    let manualUsd = 0;
    if (p.monthly_revenue && typeof p.monthly_revenue === 'object') {
        for (const periodKey in p.monthly_revenue) {
            manualUsd += p.monthly_revenue[periodKey]?.usd || 0;
        }
    }
    if (manualUsd > 0) return { usd: manualUsd, source: 'Manual' };
    return { usd: 0, source: 'N/A' };
  }
  const displayedRevenue = getDisplayedRevenue(partner);

  const isSuspended = partner.account_status === 'suspended';
  const rowClass = isSuspended ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50';
</script>

<tr class="transition-colors duration-150 ease-in-out {rowClass}">
  <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{partner.name || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{partner.mobile || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[180px]" title={partner.email || ''}>{partner.email || '-'}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(partner.created_at)}</td>
  <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
    <span
      class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border
             {isSuspended
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-green-100 text-green-700 border-green-200'}"
    >
      {partner.account_status || 'active'}
    </span>
  </td>
  <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-800">
    {formatCurrency(displayedRevenue.usd)} ({displayedRevenue.source})
  </td>
  <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-1">
    <button title="Edit (placeholder)" class="p-1.5 rounded-md text-blue-600 hover:bg-blue-100">✏️</button>
    <button title="Delete (placeholder)" class="p-1.5 rounded-md text-red-600 hover:bg-red-100">🗑️</button>
  </td>
</tr>