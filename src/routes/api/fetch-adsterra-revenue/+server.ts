// src/routes/api/fetch-adsterra-revenue/+server.ts
console.log('--- ✅✅✅ API FETCH REVENUE (+COUNTRY, IMPRESSIONS) SERVER ENDPOINT PROCESSING ---');

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';
import type { Database } from '../../../types/supabase'; // Ensure path is correct
import { PKR_RATE } from '$lib/utils/revenue';
import { format, subDays, parseISO, getMonth, getYear } from 'date-fns';

// --- TYPE DEFINITIONS ---
type PartnerRow = Database['public']['Tables']['partners']['Row'];
type MonthlyRevenueObject = PartnerRow['monthly_revenue']; // Should be Record<string, MonthlyRevenuePeriodEntry>

// Defines the structure for each entry within the monthly_revenue JSONB object
type MonthlyRevenuePeriodEntry = {
    usd: number;
    pkr: number;
    status: 'pending' | 'received' | 'not_received';
    source_type: 'manual' | 'api'; // 'api' indicates data came from Adsterra API
    impressions?: number; // Store impressions per month
    // last_api_update?: string; // Optional: timestamp of when this API data was pulled for this month
};

interface AdsterraDailyItem {
    date: string; // "YYYY-MM-DD"
    revenue: number;
    impression: number;
    clicks: number;
    ctr: number | string;
}

interface AdsterraCountryItem {
    country: string; // Typically 2-letter code e.g., "US", "IN"
    name?: string;    // Full country name (often not provided by API)
    revenue: number;
    impression: number;
    clicks: number;
    ctr: number | string;
}

// Structure for storing processed country stats in DB
export interface ProcessedCountryStat {
    countryCode: string;
    impressions: number;
    revenue: number;
}

// --- HELPER: Aggregate Daily API Data to Monthly (Includes Impressions) ---
async function aggregateDailyToMonthly(
    dailyItems: AdsterraDailyItem[]
): Promise<Record<string, { usd: number; impressions: number }>> {
    const monthlyAggregates: Record<string, { usd: number; impressions: number }> = {};
    for (const item of dailyItems) {
        try {
            const itemDate = parseISO(item.date); // Handles "YYYY-MM-DD"
            const monthKey = `${getYear(itemDate)}-${String(getMonth(itemDate) + 1).padStart(2, '0')}`; // "YYYY-MM"
            
            const itemRevenue = typeof item.revenue === 'number' ? item.revenue : 0;
            const itemImpressions = typeof item.impression === 'number' ? item.impression : 0;

            if (!monthlyAggregates[monthKey]) {
                monthlyAggregates[monthKey] = { usd: 0, impressions: 0 };
            }
            monthlyAggregates[monthKey].usd += itemRevenue;
            monthlyAggregates[monthKey].impressions += itemImpressions;
        } catch (e) {
            console.warn(`[API Aggregation] Error processing Adsterra daily item for date ${item.date}:`, e);
        }
    }
    return monthlyAggregates;
}

// --- HELPER: Get Adsterra Daily/Monthly Stats ---
async function getAdsterraTimeSeriesStats(apiKey: string): Promise<{
    success: boolean;
    // Returns data formatted ready for DB, matching MonthlyRevenuePeriodEntry structure
    monthlyApiData?: Record<string, MonthlyRevenuePeriodEntry>;
    totalImpressionsForPeriod?: number;
    errorMessage?: string;
}> {
    const today = new Date();
    const finishDate = format(today, 'yyyy-MM-dd');
    // Fetch last 365 days of data INCLUDING today
    const startDate = format(subDays(today, 364), 'yyyy-MM-dd');

    const apiUrl = `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=date`;
    console.log(`[Adsterra Date Stats] Fetching: ${apiUrl} for key: ${apiKey.substring(0,5)}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
        });

        if (!response.ok) {
            let errorDetail = `HTTP status ${response.status}`;
            try { const errorJson = await response.json(); errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson); } catch (e) {/*ignore*/}
            return { success: false, errorMessage: `Adsterra API (Date) Error: ${errorDetail}` };
        }

        const rawData = await response.json();
        if (!rawData.items || !Array.isArray(rawData.items) || rawData.items.length === 0) {
            return { success: true, monthlyApiData: {}, totalImpressionsForPeriod: 0, errorMessage: rawData.message || "No daily revenue items in API response." };
        }
        
        const dailyItems = rawData.items as AdsterraDailyItem[];
        const aggregatedApiMonths = await aggregateDailyToMonthly(dailyItems);
        let overallImpressionsForPeriod = 0;

        const finalMonthlyRevenueFromApi: Record<string, MonthlyRevenuePeriodEntry> = {};
        for (const monthKey in aggregatedApiMonths) {
            const data = aggregatedApiMonths[monthKey];
            overallImpressionsForPeriod += data.impressions;
            finalMonthlyRevenueFromApi[monthKey] = {
                usd: parseFloat(data.usd.toFixed(2)),
                pkr: parseFloat((data.usd * PKR_RATE).toFixed(2)),
                status: 'pending', // Default status for new API data
                source_type: 'api', // Data is from API
                impressions: data.impressions,
            };
        }
        return { 
            success: true, 
            monthlyApiData: finalMonthlyRevenueFromApi, 
            totalImpressionsForPeriod: overallImpressionsForPeriod,
            errorMessage: rawData.message // Store any informational message from API
        };
    } catch (e: any) {
        return { success: false, errorMessage: `Network error (Date Stats): ${e.message}` };
    }
}

// --- HELPER: Get Adsterra Country Stats ---
async function getAdsterraCountryBreakdown(apiKey: string): Promise<{
    success: boolean;
    processedCountryStats?: ProcessedCountryStat[];
    errorMessage?: string;
}> {
    const today = new Date();
    const finishDate = format(today, 'yyyy-MM-dd');
    const startDate = format(subDays(today, 364), 'yyyy-MM-dd'); // Consistent date range
    
    const countryApiUrl = `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=country`;
    console.log(`[Adsterra Country Stats] Fetching: ${countryApiUrl} for key: ${apiKey.substring(0,5)}...`);

    try {
        const response = await fetch(countryApiUrl, {
            method: 'GET',
            headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
        });
        if (!response.ok) {
            let errorDetail = `HTTP status ${response.status}`;
            try { const errorJson = await response.json(); errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson); } catch (e) {/*ignore*/}
            return { success: false, errorMessage: `Adsterra API (Country) Error: ${errorDetail}` };
        }
        const rawData = await response.json();

        if (!rawData.items || !Array.isArray(rawData.items) || rawData.items.length === 0) {
            return { success: true, processedCountryStats: [], errorMessage: rawData.message || "No country items in API response." };
        }
        const countryItems = rawData.items as AdsterraCountryItem[];
        
        const sortedCountries = countryItems
            .filter(item => typeof item.impression === 'number' && item.impression > 0)
            .sort((a, b) => b.impression - a.impression)
            .slice(0, 5) // Top 5 countries by impression
            .map(item => ({
                countryCode: item.country,
                impressions: typeof item.impression === 'number' ? item.impression : 0,
                revenue: typeof item.revenue === 'number' ? item.revenue : 0,
            }));
        
        return { success: true, processedCountryStats: sortedCountries, errorMessage: rawData.message };
    } catch (e: any) {
        return { success: false, errorMessage: `Network error (Country Stats): ${e.message}` };
    }
}

// --- MAIN POST HANDLER ---
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.admin?.id) {
        return json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    }
    const adminId = locals.admin.id;

    let partnerId: string;
    try {
        const body = await request.json();
        partnerId = body.partnerId;
        if (!partnerId) throw new Error('partnerId missing.');
    } catch (e: any) {
        return json({ success: false, message: `Invalid request: ${e.message}` }, { status: 400 });
    }

    console.log(`[/api/fetch-adsterra-revenue] Admin '${adminId}' processing partnerId: '${partnerId}'`);

    const { data: partner, error: fetchPartnerError } = await supabase
        .from('partners')
        .select('id, name, adstera_api_key, monthly_revenue, revenue_source')
        .eq('id', partnerId)
        .eq('admin_id', adminId)
        .single();

    if (fetchPartnerError || !partner) {
        return json({ success: false, message: 'Partner not found or access denied.' }, { status: fetchPartnerError ? 500 : 404 });
    }

    if (!partner.adstera_api_key) {
        await supabase.from('partners').update({
            revenue_source: (partner.monthly_revenue && Object.keys(partner.monthly_revenue).length > 0) ? 'manual' : null,
            last_api_check: new Date().toISOString(),
            api_error_message: 'No API key configured for fetch attempt.'
        }).eq('id', partnerId);
        return json({ success: true, message: 'No API key configured. Revenue source updated based on existing data.', partnerName: partner.name });
    }

    const apiKey = partner.adstera_api_key;

    // Perform API calls
    const [timeSeriesResult, countryBreakdownResult] = await Promise.all([
        getAdsterraTimeSeriesStats(apiKey),
        getAdsterraCountryBreakdown(apiKey)
    ]);

    // Initialize DB update payload
    const updatePayload: Partial<PartnerRow> = {
        last_api_check: new Date().toISOString(),
        api_total_impressions: null,
        api_country_breakdown: null,
        // Nullify old top-level aggregate fields, monthly_revenue is the source of truth
        api_revenue_usd: null,
        api_revenue_pkr: null,
    };
    
    let overallApiMessage = "";
    let dbRevenueSource = partner.revenue_source; // Default to existing

    // Process Time Series Data (Monthly Revenue)
    if (timeSeriesResult.success) {
        if (timeSeriesResult.monthlyApiData && Object.keys(timeSeriesResult.monthlyApiData).length > 0) {
            dbRevenueSource = 'api_synced'; // Data fetched and available
            overallApiMessage += timeSeriesResult.errorMessage || "Monthly stats synced from API. ";
        } else {
            dbRevenueSource = 'api'; // API call successful, but no data items (e.g., new account)
            overallApiMessage += timeSeriesResult.errorMessage || "Monthly stats API call successful, no revenue items returned. ";
        }
        updatePayload.api_total_impressions = timeSeriesResult.totalImpressionsForPeriod ?? null;

        // --- Critical Merge Logic ---
        let finalMonthlyRevenueData: MonthlyRevenueObject = partner.monthly_revenue ? JSON.parse(JSON.stringify(partner.monthly_revenue)) : {};
        if (finalMonthlyRevenueData === null || typeof finalMonthlyRevenueData !== 'object') {
            finalMonthlyRevenueData = {}; // Ensure it's a valid object
        }

        if (timeSeriesResult.monthlyApiData) {
            for (const monthKey in timeSeriesResult.monthlyApiData) {
                const apiDataForMonth = timeSeriesResult.monthlyApiData[monthKey]; // This is a full MonthlyRevenuePeriodEntry
                const existingEntry = finalMonthlyRevenueData[monthKey];

                if (existingEntry && existingEntry.status === 'received') {
                    // Preserve financials and status for 'received' entries. Update impressions and source.
                    finalMonthlyRevenueData[monthKey] = {
                        ...existingEntry, // Keeps existing usd, pkr, status
                        impressions: apiDataForMonth.impressions,
                        source_type: 'api', // Mark as API-checked
                    };
                } else {
                    // New month, or existing is not 'received' (e.g. 'pending', 'not_received', or manual not yet paid)
                    // Overwrite with fresh API data.
                    finalMonthlyRevenueData[monthKey] = apiDataForMonth;
                }
            }
        }
        updatePayload.monthly_revenue = finalMonthlyRevenueData;
        updatePayload.api_error_message = timeSeriesResult.errorMessage || null; // Clear previous error if successful

    } else { // Time series fetch failed
        dbRevenueSource = 'api_error';
        updatePayload.api_error_message = timeSeriesResult.errorMessage || 'Unknown error fetching Adsterra revenue data.';
        overallApiMessage += `Monthly Stats Error: ${updatePayload.api_error_message} `;
    }
    updatePayload.revenue_source = dbRevenueSource;

    // Process Country Breakdown Data
    if (countryBreakdownResult.success) {
        updatePayload.api_country_breakdown = (countryBreakdownResult.processedCountryStats as any) || null;
        if (countryBreakdownResult.errorMessage && countryBreakdownResult.errorMessage !== "No country items in API response.") { // Append warning if any, but not the "no items" one if revenue already said that.
            overallApiMessage += `Country Stats: ${countryBreakdownResult.errorMessage} `;
            if (updatePayload.api_error_message && timeSeriesResult.success) { // if timeSeries was ok, but country had issue
                 updatePayload.api_error_message = (updatePayload.api_error_message || "") + ` Country API: ${countryBreakdownResult.errorMessage}`;
            } else if (!timeSeriesResult.success) { // if timeSeries failed, append country message to existing error
                 updatePayload.api_error_message += ` | Country API: ${countryBreakdownResult.errorMessage || 'Unknown error'}`;
            }
        } else if (countryBreakdownResult.processedCountryStats && countryBreakdownResult.processedCountryStats.length > 0) {
            overallApiMessage += "Country stats synced. ";
        } else {
             overallApiMessage += "Country stats API call successful, no country items returned. ";
        }
    } else { // Country breakdown fetch failed
        overallApiMessage += `Country Stats Error: ${countryBreakdownResult.errorMessage || 'Unknown error'}. `;
        // Append country error message. If timeSeries was successful, revenue_source remains 'api_synced' or 'api'.
        updatePayload.api_error_message = (updatePayload.api_error_message || "") + 
            `${updatePayload.api_error_message ? ' | ' : ''}Country API Error: ${countryBreakdownResult.errorMessage || 'Unknown error'}`;
    }

    const { error: updateDbError } = await supabase
        .from('partners')
        .update(updatePayload)
        .eq('id', partnerId);

    if (updateDbError) {
        console.error(`DB Update Error for partner ${partnerId}:`, updateDbError);
        return json({ success: false, message: `Database update failed: ${updateDbError.message}` }, { status: 500 });
    }

    return json({
        success: timeSeriesResult.success, // Overall endpoint success hinges on revenue data fetch
        message: overallApiMessage.trim() || (timeSeriesResult.success ? 'Adsterra data processed.' : 'Failed to process Adsterra data.'),
        partnerName: partner.name,
        // You could also return some of the fetched data for immediate UI update if needed
        // monthlyRevenue: updatePayload.monthly_revenue,
        // countryBreakdown: updatePayload.api_country_breakdown
    });
};