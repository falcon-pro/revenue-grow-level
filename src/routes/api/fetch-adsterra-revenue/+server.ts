// src/routes/api/fetch-adsterra-revenue/+server.ts
console.log('--- ✅✅✅ API FETCH REVENUE (+COUNTRY) SERVER ENDPOINT PROCESSING ---');

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';
import type { Database } from '../../../types/supabase'; // Ensure path is correct after type generation
import { PKR_RATE } from '$lib/utils/revenue';
import { format, subDays, parseISO, getMonth, getYear } from 'date-fns';

// --- TYPE DEFINITIONS ---
type PartnerRow = Database['public']['Tables']['partners']['Row']; // Uses generated type
type MonthlyRevenueObject = PartnerRow['monthly_revenue'];
type MonthlyEntry = { // Structure for entries within MonthlyRevenueObject
    usd: number;
    pkr: number;
    status: 'pending' | 'received' | 'not_received';
    source: 'manual' | 'api'; // Clarified 'source' as 'api' (from Adsterra) or 'manual'
    impressions?: number; // Optional: store impressions per month
};

interface AdsterraDailyItem {
    date: string;
    revenue: number;
    impression: number;
    clicks: number;
    ctr: number | string;
}

interface AdsterraCountryItem {
    country: string; // This is usually the 2-letter country code like "US", "IN"
    name?: string;    // Full country name if provided by API (often not)
    revenue: number;
    impression: number;
    clicks: number;
    ctr: number | string;
}
// Structure for storing processed country stats in DB
export interface ProcessedCountryStat { // Export for use in PartnerTableRow if needed
    countryCode: string;
    // countryName?: string; // Could add a lookup if needed
    impressions: number;
    revenue: number;
}


// --- HELPER: Aggregate Daily API Data to Monthly ---
async function aggregateDailyToMonthly(dailyItems: AdsterraDailyItem[]): Promise<Record<string, { usd: number; impressions: number }>> {
    const monthlyAggregates: Record<string, { usd: number; impressions: number }> = {};
    for (const item of dailyItems) {
        try {
            const itemDate = parseISO(item.date);
            const monthKey = `${getYear(itemDate)}-${String(getMonth(itemDate) + 1).padStart(2, '0')}`;
            const itemRevenue = typeof item.revenue === 'number' ? item.revenue : 0;
            const itemImpressions = typeof item.impression === 'number' ? item.impression : 0;
            if (!monthlyAggregates[monthKey]) monthlyAggregates[monthKey] = { usd: 0, impressions: 0 };
            monthlyAggregates[monthKey].usd += itemRevenue;
            monthlyAggregates[monthKey].impressions += itemImpressions;
        } catch (e) { console.warn(`Error processing Adsterra daily item for date ${item.date}:`, e); }
    }
    return monthlyAggregates;
}

// --- HELPER: Get Adsterra Daily/Monthly Stats (Existing one modified slightly) ---
async function getAdsterraTimeSeriesStats(apiKey: string): Promise<{
    success: boolean;
    monthlyAggregatedData?: Record<string, MonthlyEntry>; // Prepared for DB structure
    totalImpressionsForPeriod?: number;
    errorMessage?: string;
}> {
    const today = new Date();
    const finishDate = format(today, 'yyyy-MM-dd'); // Fetch up to 'today'
    const startDate = format(subDays(today, 365), 'yyyy-MM-dd'); // Last 365 days up to today

    const apiUrl = `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=date`;
    console.log(`[Adsterra Date Stats] Fetching: ${apiUrl} for key: ${apiKey.substring(0,5)}...`);

    try {
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }});
        if (!response.ok) { let ed=''; try{const ej=await response.json(); ed=ej.message||ej.error||JSON.stringify(ej);}catch(e){} return {success:false, errorMessage:`Adsterra API (Date) Error: ${response.status} ${ed}`};}
        const rawData = await response.json();
        if (!rawData.items || !Array.isArray(rawData.items)) return { success: true, monthlyAggregatedData: {}, totalImpressionsForPeriod: 0, errorMessage: rawData.message || "No daily items." };
        
        const dailyItems = rawData.items as AdsterraDailyItem[];
        const aggregatedApiMonths = await aggregateDailyToMonthly(dailyItems);
        let overallImpressions = 0;

        const finalDbMonthlyRevenue: Record<string, MonthlyEntry> = {};
        for (const monthKey in aggregatedApiMonths) {
            const data = aggregatedApiMonths[monthKey];
            overallImpressions += data.impressions;
            finalDbMonthlyRevenue[monthKey] = {
                usd: parseFloat(data.usd.toFixed(2)),
                pkr: parseFloat((data.usd * PKR_RATE).toFixed(2)),
                status: 'pending',
                source: 'api', // Using 'api' now instead of 'api_daily_sum' for simplicity
                impressions: data.impressions
            };
        }
        return { success: true, monthlyAggregatedData: finalDbMonthlyRevenue, totalImpressionsForPeriod: overallImpressions, errorMessage: rawData.message };
    } catch (e: any) { return { success: false, errorMessage: `Network error (Date Stats): ${e.message}` }; }
}

// --- NEW HELPER: Get Adsterra Country Stats ---
async function getAdsterraCountryBreakdown(apiKey: string): Promise<{
    success: boolean;
    processedCountryStats?: ProcessedCountryStat[]; // Array of top countries
    errorMessage?: string;
}> {
    const today = new Date();
    const finishDate = format(today, 'yyyy-MM-dd');
    const startDate = format(subDays(today, 365), 'yyyy-MM-dd');
    const countryApiUrl = `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=country`;
    console.log(`[Adsterra Country Stats] Fetching: ${countryApiUrl} for key: ${apiKey.substring(0,5)}...`);

    try {
        const response = await fetch(countryApiUrl, { method: 'GET', headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }});
        if (!response.ok) { let ed=''; try{const ej=await response.json(); ed=ej.message||ej.error||JSON.stringify(ej);}catch(e){} return {success:false, errorMessage:`Adsterra API (Country) Error: ${response.status} ${ed}`};}
        const rawData = await response.json();

        if (!rawData.items || !Array.isArray(rawData.items)) {
            return { success: true, processedCountryStats: [], errorMessage: rawData.message || "No country items." };
        }
        const countryItems = rawData.items as AdsterraCountryItem[];
        
        // Process: sort by impressions (desc), take top 5
        const sortedCountries = countryItems
            .filter(item => item.impression > 0) // Only consider countries with impressions
            .sort((a, b) => b.impression - a.impression)
            .slice(0, 5) // Take top 5
            .map(item => ({
                countryCode: item.country, // Assuming Adsterra returns code like "US", "IN"
                // countryName: lookupCountryName(item.country), // You might need a lookup for full names
                impressions: typeof item.impression === 'number' ? item.impression : 0,
                revenue: typeof item.revenue === 'number' ? item.revenue : 0,
            }));
        
        return { success: true, processedCountryStats: sortedCountries, errorMessage: rawData.message };
    } catch (e: any) { return { success: false, errorMessage: `Network error (Country Stats): ${e.message}` }; }
}


// --- MAIN POST HANDLER ---
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.admin?.id) return json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    const adminId = locals.admin.id;
    let partnerId: string;
    try { const body = await request.json(); partnerId = body.partnerId; if (!partnerId) throw new Error('partnerId missing.'); }
    catch (e: any) { return json({ success: false, message: `Invalid request: ${e.message}` }, { status: 400 }); }

    console.log(`[/api/fetch-adsterra-revenue] For admin '${adminId}', processing partnerId: '${partnerId}'`);
    const { data: partner, error: fetchPartnerError } = await supabase
        .from('partners')
        .select('id, adstera_api_key, name, monthly_revenue, revenue_source')
        .eq('id', partnerId).eq('admin_id', adminId).single();

    if (fetchPartnerError || !partner) return json({ success: false, message: 'Partner not found.' }, { status: 404 });
    if (!partner.adstera_api_key) { /* ... (handle no API key) ... */ await supabase.from('partners').update({ revenue_source: null, last_api_check: new Date().toISOString(), api_error_message: 'No API key for fetch.' }).eq('id', partnerId); return json({ success: true, message: 'No API key configured.', partnerName: partner.name });}

    const apiKey = partner.adstera_api_key;

    // Perform both fetches (could be parallel with Promise.all for slight perf gain)
    const timeSeriesResult = await getAdsterraTimeSeriesStats(apiKey);
    const countryBreakdownResult = await getAdsterraCountryBreakdown(apiKey);

const updatePayload: Partial<PartnerRow> = {
    last_api_check: new Date().toISOString(),
    api_total_impressions: null, // TEMPORARILY COMMENT OUT
    api_revenue_usd: null,
    api_revenue_pkr: null,
    api_country_breakdown: null // TEMPORARILY COMMENT OUT
};
    let overallStatusMessage = "";

    // Process Time Series Data (Monthly Revenue)
    if (timeSeriesResult.success && timeSeriesResult.monthlyAggregatedData) {
        let mergedMonthlyRevenue = (partner.monthly_revenue || {}) as Record<string, MonthlyEntry>;
        if (mergedMonthlyRevenue === null) mergedMonthlyRevenue = {};

        for (const monthKey in timeSeriesResult.monthlyAggregatedData) {
            const apiMonthEntry = timeSeriesResult.monthlyAggregatedData[monthKey];
             if (mergedMonthlyRevenue[monthKey] && mergedMonthlyRevenue[monthKey].source === 'api') {
                // Update existing API entry, preserve its status
                mergedMonthlyRevenue[monthKey].usd = apiMonthEntry.usd;
                mergedMonthlyRevenue[monthKey].pkr = apiMonthEntry.pkr;
                mergedMonthlyRevenue[monthKey].impressions = apiMonthEntry.impressions;
            } else { // New API month, or overwrite non-API entry
                mergedMonthlyRevenue[monthKey] = apiMonthEntry; // Includes status: 'pending', source: 'api'
            }
        }
        updatePayload.monthly_revenue = mergedMonthlyRevenue;
        updatePayload.api_total_impressions = timeSeriesResult.totalImpressionsForPeriod; // Store total impressions from daily sum
        
        // Deprecated top-level fields: update with sum from THIS fetch of API daily data
        let sumUsdFromThisFetch = 0;
        Object.values(timeSeriesResult.monthlyAggregatedData).forEach(m => sumUsdFromThisFetch += (m.usd || 0));
        updatePayload.api_revenue_usd = sumUsdFromThisFetch;
        updatePayload.api_revenue_pkr = sumUsdFromThisFetch * PKR_RATE;

        updatePayload.revenue_source = 'api'; // Indicate API sync occurred
        updatePayload.api_error_message = timeSeriesResult.errorMessage || null; // Clear if successful, store warning if any
        overallStatusMessage += timeSeriesResult.errorMessage || "Monthly stats synced. ";
    } else {
        updatePayload.revenue_source = 'api_error';
        updatePayload.api_error_message = timeSeriesResult.errorMessage || 'Unknown API error (Time Series).';
        overallStatusMessage += `Monthly Stats Error: ${updatePayload.api_error_message} `;
    }

    // Process Country Breakdown Data
    if (countryBreakdownResult.success && countryBreakdownResult.processedCountryStats) {
        updatePayload.api_country_breakdown = countryBreakdownResult.processedCountryStats as any; // Store array of top countries
        overallStatusMessage += countryBreakdownResult.errorMessage || "Country stats synced.";
    } else {
        // If time series was successful but country failed, don't mark source as api_error necessarily.
        // Append to error message or store in a separate field if needed.
        updatePayload.api_error_message = (updatePayload.api_error_message || "") + ` CountryStats Error: ${countryBreakdownResult.errorMessage || 'Unknown'}`;
        overallStatusMessage += `Country Stats Error: ${countryBreakdownResult.errorMessage || 'Unknown'}`;
    }

    const { error: updateDbError } = await supabase.from('partners').update(updatePayload).eq('id', partnerId);
    if (updateDbError) return json({ success: false, message: `DB update error: ${updateDbError.message}`}, {status: 500});

    return json({
        success: timeSeriesResult.success, // Primary success based on main revenue fetch
        message: overallStatusMessage.trim(),
        partnerName: partner.name
    });
};