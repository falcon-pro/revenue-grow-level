// src/lib/utils/revenue.ts
// Assuming Partner type is defined elsewhere, e.g., via Supabase types or manually in types.ts
// For simplicity, if not fully typed, 'any' might be used temporarily inside the function
// import type { Partner, MonthlyRevenueEntry } from './types'; // If using manual types
import type { Database } from '../../types/supabase'; // If using Supabase generated types
type Partner = Database['public']['Tables']['partners']['Row'];
type MonthlyRevenueEntry = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;


export const PKR_RATE = 280; // <-- IMPORTANT: Update to your current desired rate

interface EffectiveRevenueResult {
    totalUSD: number;
    totalPKR: number;
    manualSumUSD: number;
    manualSumPKR: number;
    sourceForDisplay: 'api' | 'manual' | 'api_loading' | 'api_error' | 'N/A';
}

export function getEffectiveRevenue(partner: Partner | null | undefined): EffectiveRevenueResult {
    const defaultResult: EffectiveRevenueResult = {
        totalUSD: 0, totalPKR: 0,
        manualSumUSD: 0, manualSumPKR: 0,
        sourceForDisplay: 'N/A'
    };

    if (!partner) return defaultResult;

    let manualSumUSD = 0;
    let manualSumPKR = 0;
    const monthlyRevenueMap = partner.monthly_revenue as Record<string, MonthlyRevenueEntry> | null;

    if (monthlyRevenueMap && typeof monthlyRevenueMap === 'object') {
        Object.values(monthlyRevenueMap).forEach(entry => {
            const usd = entry?.usd ?? 0;
            manualSumUSD += usd;
            // Ensure pkr is calculated if not present or uses current PKR_RATE for consistency in sum
            manualSumPKR += entry?.pkr ?? (usd * PKR_RATE);
        });
    }
    defaultResult.manualSumUSD = manualSumUSD;
    defaultResult.manualSumPKR = manualSumPKR;


    const partnerRevenueSource = partner.revenue_source as EffectiveRevenueResult['sourceForDisplay'] | null;

    // Determine final displayed values based on partner.revenue_source
    switch (partnerRevenueSource) {
        case 'api':
            if (partner.api_revenue_usd != null) {
                defaultResult.totalUSD = partner.api_revenue_usd;
                defaultResult.totalPKR = partner.api_revenue_pkr ?? (partner.api_revenue_usd * PKR_RATE);
                defaultResult.sourceForDisplay = 'api';
            } else { // API source but no data, fallback to manual or N/A
                defaultResult.totalUSD = manualSumUSD;
                defaultResult.totalPKR = manualSumPKR;
                defaultResult.sourceForDisplay = manualSumUSD > 0 ? 'manual' : 'N/A';
            }
            break;
        case 'api_error':
            defaultResult.totalUSD = manualSumUSD; // Show manual sum on API error
            defaultResult.totalPKR = manualSumPKR;
            defaultResult.sourceForDisplay = 'api_error';
            break;
        case 'manual':
            defaultResult.totalUSD = manualSumUSD;
            defaultResult.totalPKR = manualSumPKR;
            defaultResult.sourceForDisplay = 'manual';
            break;
        case 'api_loading':
            defaultResult.totalUSD = 0; // Show 0 while API is loading
            defaultResult.totalPKR = 0;
            defaultResult.sourceForDisplay = 'api_loading';
            break;
        default: // Includes null or other unforeseen statuses
            defaultResult.totalUSD = manualSumUSD;
            defaultResult.totalPKR = manualSumPKR;
            defaultResult.sourceForDisplay = manualSumUSD > 0 ? 'manual' : 'N/A';
            break;
    }
    return defaultResult;
}