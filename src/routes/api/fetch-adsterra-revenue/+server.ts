// src/routes/api/fetch-adsterra-revenue/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';
import type { Database } from '../../../types/supabase'; // Adjust path as needed
import { PKR_RATE } from '$lib/utils/revenue';
import { format, subDays } from 'date-fns'; // For date calculations

type PartnerRow = Database['public']['Tables']['partners']['Row'];

// Function to call the actual Adsterra API for the last 365 days
async function getAdsterraRevenueForLastYear(apiKey: string): Promise<{
    success: boolean;
    totalRevenueUSD?: number;
    errorMessage?: string;
    rawApiResponse?: any; // Optional: to store the full response for debugging
}> {
    const today = new Date();
    // Adsterra API might want dates not in the future. Using "yesterday" as finish_date is safest.
    const finishDate = format(today, 'yyyy-MM-dd'); // Or format(subDays(today, 1), 'yyyy-MM-dd') for "yesterday"
    const startDate = format(subDays(today, 365), 'yyyy-MM-dd'); // 365 days ago

    const apiUrl = `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${finishDate}&group_by=date`;
    console.log(`[Adsterra API Call] Fetching from: ${apiUrl} for key: ${apiKey.substring(0,5)}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'X-API-Key': apiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            let errorDetail = `HTTP status ${response.status}`;
            try {
                const errorJson = await response.json();
                errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson);
            } catch (e) { /* Ignore if response wasn't JSON */ }
            console.error(`[Adsterra API Call] Error: ${response.status}, Detail: ${errorDetail}`);
            return { success: false, errorMessage: `Adsterra API Error: ${errorDetail}` };
        }

        const data = await response.json();
        // console.log('[Adsterra API Call] Raw API Response:', JSON.stringify(data, null, 2)); // For debugging response structure

        if (!data.items || !Array.isArray(data.items)) {
            // This can happen if the date range has no data or if the API key is invalid/no sites active etc.
            console.warn('[Adsterra API Call] No "items" array in response or not an array. Data:', data);
            return { success: true, totalRevenueUSD: 0, rawApiResponse: data, errorMessage: data.message || "No revenue data items returned for the period." };
        }

        // Sum up the revenue from all items
        let totalRevenue = 0;
        for (const item of data.items) {
            if (item && typeof item.revenue === 'number') {
                totalRevenue += item.revenue;
            }
        }
        
        console.log(`[Adsterra API Call] Successfully fetched. Total items: ${data.items.length}, Calculated total revenue: ${totalRevenue}`);
        return { success: true, totalRevenueUSD: totalRevenue, rawApiResponse: data };

    } catch (e: any) {
        console.error('[Adsterra API Call] Network or other error:', e);
        return { success: false, errorMessage: `Network error or issue calling Adsterra: ${e.message}` };
    }
}


export const POST: RequestHandler = async ({ request, locals }) => {
    console.log('[/api/fetch-adsterra-revenue] Received POST request.');

    if (!locals.admin || !locals.admin.id) {
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

    console.log(`[/api/fetch-adsterra-revenue] For admin '${adminId}', processing partnerId: '${partnerId}'`);

    const { data: partner, error: fetchPartnerError } = await supabase
        .from('partners')
        .select('id, adstera_api_key, name, revenue_source') // Fetch revenue_source too
        .eq('id', partnerId)
        .eq('admin_id', adminId)
        .single();

    if (fetchPartnerError || !partner) {
        return json({ success: false, message: 'Partner not found or access denied.' }, { status: fetchPartnerError ? 500 : 404 });
    }

    if (!partner.adstera_api_key) {
        console.log(`[/api/fetch-adsterra-revenue] No API key for partner: ${partner.name}`);
        // Update status if it was 'api_loading'
        if (partner.revenue_source === 'api_loading') {
             await supabase.from('partners').update({
                revenue_source: null, // Or determine based on monthly_revenue
                last_api_check: new Date().toISOString(),
                api_error_message: 'No API key configured.'
            }).eq('id', partnerId);
        }
        return json({ success: true, message: 'No API key configured.', revenue: null, partnerName: partner.name });
    }

    const apiKey = partner.adstera_api_key;
    const apiResult = await getAdsterraRevenueForLastYear(apiKey);

    let dbUpdatePayload: Partial<PartnerRow> = {
        last_api_check: new Date().toISOString(),
    };

    if (apiResult.success && apiResult.totalRevenueUSD !== undefined) {
        dbUpdatePayload.api_revenue_usd = apiResult.totalRevenueUSD;
        dbUpdatePayload.api_revenue_pkr = apiResult.totalRevenueUSD * PKR_RATE;
        dbUpdatePayload.revenue_source = 'api';
        dbUpdatePayload.api_error_message = apiResult.errorMessage || null; // Clear error on success, or store info message if present
    } else {
        dbUpdatePayload.revenue_source = 'api_error';
        dbUpdatePayload.api_error_message = apiResult.errorMessage || 'Unknown API error from Adsterra.';
        // Keep existing api_revenue_usd/pkr on error, or nullify them?
        // Nullifying makes it clear the last fetch failed to get a value.
        dbUpdatePayload.api_revenue_usd = null;
        dbUpdatePayload.api_revenue_pkr = null;
    }

    const { error: updateDbError } = await supabase
        .from('partners')
        .update(dbUpdatePayload)
        .eq('id', partnerId);

    if (updateDbError) {
        console.error('[/api/fetch-adsterra-revenue] Supabase error updating partner after API call:', updateDbError);
        return json({ success: false, message: `Failed to update partner in DB: ${updateDbError.message}` }, { status: 500 });
    }
    
    // Response to client
    const clientResponse = {
        success: apiResult.success,
        message: apiResult.errorMessage ? `API Fetch: ${apiResult.errorMessage}` : 'Adsterra revenue updated successfully.',
        partnerName: partner.name,
        fetchedRevenueUSD: apiResult.totalRevenueUSD,
        updatedSource: dbUpdatePayload.revenue_source
    };
    console.log('[/api/fetch-adsterra-revenue] Sending response to client:', clientResponse);
    return json(clientResponse);
};