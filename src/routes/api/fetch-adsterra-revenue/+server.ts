// src/routes/api/fetch-adsterra-revenue/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';
import type { Database } from '../../../types/supabase';
import { PKR_RATE } from '$lib/utils/revenue';
import { format, subDays, parseISO, getMonth, getYear, addDays, subYears } from 'date-fns';

type PartnerRow = Database['public']['Tables']['partners']['Row'];
type MonthlyRevenueObject = Database['public']['Tables']['partners']['Row']['monthly_revenue'];
type MonthlyRevenuePeriodEntry = { // Define structure for clarity
    usd: number;
    pkr: number;
    status: 'pending' | 'received' | 'not_received';
    source_type: 'manual' | 'api_daily_sum';
    // last_api_update?: string; // Optional: timestamp of when this API data was pulled for this month
};

interface AdsterraDailyItem {
    date: string; // "YYYY-MM-DD"
    revenue: number;
    impression: number;
    clicks: number;
    ctr: number; // Or string, needs parsing if so
}

async function aggregateDailyApiDataToMonthly(
    dailyItems: AdsterraDailyItem[]
): Promise<Record<string, { usd: number }>> {
    const monthlyAggregates: Record<string, { usd: number }> = {};

    for (const item of dailyItems) {
        try {
            const itemDate = parseISO(item.date); // Handles "YYYY-MM-DD"
            const monthKey = `${getYear(itemDate)}-${String(getMonth(itemDate) + 1).padStart(2, '0')}`; // "YYYY-MM"

            if (typeof item.revenue === 'number') {
                if (!monthlyAggregates[monthKey]) {
                    monthlyAggregates[monthKey] = { usd: 0 };
                }
                monthlyAggregates[monthKey].usd += item.revenue;
            }
        } catch (e) {
            console.error(`[API Fetch Util] Error parsing date or revenue for item: ${item.date}`, e);
        }
    }
    return monthlyAggregates;
}


async function getAdsterraDataAndAggregate(apiKey: string): Promise<{
    success: boolean;
    monthlyApiRevenue?: Record<string, MonthlyRevenuePeriodEntry>; // Keys are "YYYY-MM"
    errorMessage?: string;
}> {
    const today = new Date();
      const finishDate = format(subDays(today,1), 'yyyy-MM-dd'); // Fetch up to YESTERDAY
    const startDate = format(subDays(today, 366), 'yyyy-MM-dd'); // Approx last 365 days of data up to yesterday

        console.log(`Fetching data from ${startDate} to ${finishDate}`);

    const apiUrl = `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=date`;
    console.log(`[Adsterra API Call] Fetching: ${apiUrl} for key prefix: ${apiKey.substring(0,5)}`);

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
        });

        if (!response.ok) {
            let errorDetail = `HTTP status ${response.status}`;
            try { const errorJson = await response.json(); errorDetail = errorJson.message || JSON.stringify(errorJson); } catch (e) {/*ignore*/}
            return { success: false, errorMessage: `Adsterra API Error: ${errorDetail}` };
        }

        const rawData = await response.json();

        if (!rawData.items || !Array.isArray(rawData.items)) {
            return { success: true, monthlyApiRevenue: {}, errorMessage: rawData.message || "No revenue items in API response." };
        }

        const dailyItems = rawData.items as AdsterraDailyItem[];
        const aggregatedApiMonths = await aggregateDailyApiDataToMonthly(dailyItems);

        const finalMonthlyRevenue: Record<string, MonthlyRevenuePeriodEntry> = {};
        for (const monthKey in aggregatedApiMonths) {
            const monthlySumUsd = aggregatedApiMonths[monthKey].usd;
            finalMonthlyRevenue[monthKey] = {
                usd: parseFloat(monthlySumUsd.toFixed(2)), // Ensure 2 decimal places for currency
                pkr: parseFloat((monthlySumUsd * PKR_RATE).toFixed(2)),
                status: 'pending', // Default status for newly fetched API data
                source_type: 'api_daily_sum',
                // last_api_update: new Date().toISOString() // Add if you want to track this per month
            };
        }
        return { success: true, monthlyApiRevenue: finalMonthlyRevenue };

    } catch (e: any) {
        return { success: false, errorMessage: `Network/fetch error: ${e.message}` };
    }
}

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.admin || !locals.admin.id) {
        return json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    }
    const adminId = locals.admin.id;

    let partnerId: string;
    try {
        const body = await request.json(); partnerId = body.partnerId;
        if (!partnerId) throw new Error('partnerId missing.');
    } catch (e: any) { return json({ success: false, message: `Invalid request: ${e.message}` }, { status: 400 }); }

    console.log(`[/api/fetch-adsterra-revenue] For admin '${adminId}', processing partnerId: '${partnerId}'`);

    const { data: partner, error: fetchPartnerError } = await supabase
        .from('partners')
        .select('id, name, adstera_api_key, monthly_revenue, revenue_source') // Fetch existing monthly_revenue
        .eq('id', partnerId).eq('admin_id', adminId).single();

    if (fetchPartnerError || !partner) {
        return json({ success: false, message: 'Partner not found or access denied.' }, { status: fetchPartnerError ? 500 : 404 });
    }

    if (!partner.adstera_api_key) {
        await supabase.from('partners').update({
            revenue_source: (partner.monthly_revenue && Object.keys(partner.monthly_revenue).length > 0) ? 'manual' : null,
            last_api_check: new Date().toISOString(),
            api_error_message: 'No API key configured for fetch attempt.'
        }).eq('id', partnerId);
        return json({ success: true, message: 'No API key configured.', partnerName: partner.name });
    }

    const apiResult = await getAdsterraDataAndAggregate(partner.adstera_api_key);

    let newDbRevenueSource = partner.revenue_source; // Start with existing
    let newApiErrorMessage = null;

    if (!apiResult.success) {
        newDbRevenueSource = 'api_error';
        newApiErrorMessage = apiResult.errorMessage || 'Unknown error fetching from Adsterra.';
    } else if (apiResult.monthlyApiRevenue && Object.keys(apiResult.monthlyApiRevenue).length > 0) {
        newDbRevenueSource = 'api_synced'; // Or just 'api' if you prefer
        newApiErrorMessage = apiResult.errorMessage; // Store info message like "no items" if present
    } else if (apiResult.errorMessage) { // Success true, but e.g. "no items"
        newDbRevenueSource = 'api'; // Still, an API check happened.
        newApiErrorMessage = apiResult.errorMessage;
    }


    // Merge API data with existing manual data
    // API data for a given month OVERWRITES any existing data for that month if it comes from API
    // Manual entries for OTHER months are preserved.
    let finalMonthlyRevenueData: MonthlyRevenueObject = partner.monthly_revenue ? JSON.parse(JSON.stringify(partner.monthly_revenue)) : {};
    if (finalMonthlyRevenueData === null) finalMonthlyRevenueData = {}; // Ensure it's an object

    if (apiResult.success && apiResult.monthlyApiRevenue) {
        for (const monthKey in apiResult.monthlyApiRevenue) {
            // If an entry for this month already exists AND it's manual, you might want to keep it or have merging rule.
            // Current logic: API data for a month overwrites.
            finalMonthlyRevenueData[monthKey] = apiResult.monthlyApiRevenue[monthKey];
        }
    }

    const updatePayload: Partial<PartnerRow> = {
        monthly_revenue: finalMonthlyRevenueData,
        last_api_check: new Date().toISOString(),
        revenue_source: newDbRevenueSource,
        api_error_message: newApiErrorMessage,
        // We NO LONGER update api_revenue_usd / pkr directly at the top partner level here.
        // Those fields could be removed or re-purposed later.
        api_revenue_usd: null, // Nullify old aggregate field
        api_revenue_pkr: null  // Nullify old aggregate field
    };

    const { error: updateDbError } = await supabase
        .from('partners').update(updatePayload).eq('id', partnerId);

    if (updateDbError) {
        return json({ success: false, message: `DB update failed: ${updateDbError.message}` }, { status: 500 });
    }

    return json({
        success: true, // Overall success of THIS endpoint's operation
        apiCallSuccess: apiResult.success,
        message: newApiErrorMessage || (apiResult.success ? 'Adsterra data synced to monthly entries.' : `Adsterra fetch failed: ${apiResult.errorMessage}`),
        partnerName: partner.name
    });
};