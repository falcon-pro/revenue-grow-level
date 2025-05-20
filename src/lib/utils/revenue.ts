// src/lib/utils/revenue.ts
// Assuming Partner type is defined elsewhere, e.g., via Supabase types or manually in types.ts
// For simplicity, if not fully typed, 'any' might be used temporarily inside the function
// import type { Partner, MonthlyRevenueEntry } from './types'; // If using manual types
import type { Database } from '../../types/supabase'; // If using Supabase generated types
type Partner = Database['public']['Tables']['partners']['Row'];
type MonthlyRevenueEntry = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;


export const PKR_RATE = 220; // <-- IMPORTANT: Update to your current desired rate

interface EffectiveRevenueResult {
    totalUSD: number;
    totalPKR: number;
    manualSumUSD: number;
    manualSumPKR: number;
    sourceForDisplay: 'api' | 'manual' | 'api_loading' | 'api_error' | 'N/A';
}

// src/lib/utils/revenue.ts
export function getEffectiveRevenue(partner: Partner | null | undefined): {
    totalUSD: number;
    totalPKR: number;
    manualSumUSD: number; // Might be less relevant now or renamed
    apiSumUSD: number;    // Sum of entries where entry.source === 'api'
    sourceForDisplay: string; // 'API', 'Manual', 'Mixed', 'N/A'
} {
    const result = { totalUSD: 0, totalPKR: 0, manualSumUSD: 0, apiSumUSD: 0, sourceForDisplay: 'N/A' };
    if (!partner || !partner.monthly_revenue) return result;

    let hasApiEntries = false;
    let hasManualEntries = false;
    const monthlyData = partner.monthly_revenue as Record<string, MonthlyRevenueEntry>;

    Object.values(monthlyData).forEach(entry => {
        const usd = entry?.usd ?? 0;
        if (usd > 0) {
            result.totalUSD += usd;
            result.totalPKR += (entry?.pkr ?? (usd * PKR_RATE));
            if (entry?.source === 'api') {
                result.apiSumUSD += usd;
                hasApiEntries = true;
            } else { // Assume 'manual' or undefined source as manual for this sum
                result.manualSumUSD += usd;
                hasManualEntries = true;
            }
        }
    });

    if (hasApiEntries && hasManualEntries) result.sourceForDisplay = 'Mixed';
    else if (hasApiEntries) result.sourceForDisplay = 'API';
    else if (hasManualEntries) result.sourceForDisplay = 'Manual';
    
    // If top-level revenue_source indicates API is loading/error, that might override
    if (partner.revenue_source === 'api_loading') result.sourceForDisplay = 'API Loading';
    if (partner.revenue_source === 'api_error') result.sourceForDisplay = 'API Error';

    return result;
}