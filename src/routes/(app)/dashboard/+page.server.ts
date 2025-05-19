// src/routes/(app)/dashboard/+page.server.ts
console.log('--- ✅✅✅ DASHBOARD +page.server.ts IS BEING PROCESSED (Attempt FINAL EDIT FIX) ✅✅✅ ---');

import { supabase } from '$lib/supabaseClient';
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions, ActionResult } from './$types';
import type { Database } from '../../../types/supabase';
import { PKR_RATE } from '$lib/utils/revenue';

// --- TYPE DEFINITIONS ---
type PartnerRow = Database['public']['Tables']['partners']['Row'];
type PartnerInsert = Database['public']['Tables']['partners']['Insert'];
type PartnerUpdate = Database['public']['Tables']['partners']['Update'];
type MonthlyRevenuePeriodEntry = { usd?: number | null; pkr?: number | null; status?: string | null; };

// --- LOAD FUNCTION ---
export const load: PageServerLoad = async ({ locals, parent }) => {
    console.log('[/dashboard/+page.server.ts] Load function running...');
    const { admin } = await parent();
    if (!admin || !admin.id) {
        console.error('[/dashboard/+page.server.ts] Unauthorized: Admin context not found during load.');
        throw error(401, 'Unauthorized: Admin context not found for dashboard.');
    }
    console.log('[/dashboard/+page.server.ts] Fetching partners for admin ID:', admin.id);
    const { data: partners, error: dbError } = await supabase
        .from('partners')
        .select('*')
        .eq('admin_id', admin.id)
        .order('created_at', { ascending: false });

    if (dbError) {
        console.error('[/dashboard/+page.server.ts] Supabase error fetching partners:', dbError);
        throw error(500, `Database error fetching partners: ${dbError.message}`);
    }
    console.log('[/dashboard/+page.server.ts] Fetched partners count:', partners?.length ?? 0);
    return {
        partners: partners || []
    };
};

// --- HELPER: Process NEW Partner Form Data ---
function processNewPartnerFormData(formData: FormData, adminId: string): { data: PartnerInsert, errors: Record<string, string> } {
    console.log("--- SERVER: processNewPartnerFormData ---");
    const errors: Record<string, string> = {};
    const data: Partial<PartnerInsert> = { admin_id: adminId };

    data.name = (formData.get('name') as string)?.trim() || '';
    if (!data.name) errors.name = 'Name is required.';

    data.mobile = (formData.get('mobile') as string)?.trim() || '';
    if (!data.mobile) errors.mobile = 'Mobile is required.';

    data.email = (formData.get('email') as string)?.trim() || '';
    if (!data.email) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email format.';

    data.address = (formData.get('address') as string)?.trim() || null;
    data.webmoney = (formData.get('webmoney') as string)?.trim() || null;
    data.multi_account_no = (formData.get('multi_account_no') as string)?.trim() || null;
    data.adstera_link = (formData.get('adstera_link') as string)?.trim() || null;
    data.adstera_email_link = (formData.get('adstera_email_link') as string)?.trim() || null;
    data.adstera_api_key = (formData.get('adstera_api_key') as string)?.trim() || null;

    const accountCreationStr = formData.get('account_creation') as string;
    if (accountCreationStr && accountCreationStr.trim() !== '') {
        try { data.account_creation = new Date(accountCreationStr).toISOString(); }
        catch (e) { errors.account_creation = "Invalid creation date."; }
    } else { data.account_creation = null; }

    const accountStartStr = formData.get('account_start') as string;
    if (accountStartStr && accountStartStr.trim() !== '') {
        try { data.account_start = new Date(accountStartStr).toISOString(); }
        catch (e) { errors.account_start = "Invalid start date."; }
    } else { data.account_start = null; }

    data.account_status = 'active';

    const revenuePeriod = (formData.get('revenuePeriod') as string | null)?.trim();
    const revenueRateUSDStr = (formData.get('revenueRateUSD') as string | null);
    const paymentStatus = (formData.get('paymentStatus') as string | null) || 'pending';
    let revenueRateUSD: number | null = null;

    if (revenueRateUSDStr !== null && revenueRateUSDStr.trim() !== '') {
        const parsedRate = parseFloat(revenueRateUSDStr);
        if (isNaN(parsedRate) || parsedRate < 0) { errors.revenueRateUSD = 'Revenue (USD) must be valid & non-negative.'; }
        else { revenueRateUSD = parsedRate; }
    }

    // If a rate was entered/attempted, period must be valid
    if (revenueRateUSD !== null && (!revenuePeriod || !/^\d{4}-\d{2}$/.test(revenuePeriod))) {
        errors.revenuePeriod = 'Period (YYYY-MM) format is required if revenue amount is entered.';
    }

    if (revenuePeriod && revenueRateUSD !== null && !errors.revenueRateUSD && !errors.revenuePeriod) {
        const monthlyEntry: MonthlyRevenuePeriodEntry = { usd: revenueRateUSD, pkr: revenueRateUSD * PKR_RATE, status: paymentStatus };
        data.monthly_revenue = { [revenuePeriod]: monthlyEntry } as any;
    } else {
        data.monthly_revenue = {} as any;
    }

    if (data.adstera_api_key) {
        data.revenue_source = 'api_loading'; data.api_revenue_usd = null; data.api_revenue_pkr = null; data.last_api_check = null;
    } else if (data.monthly_revenue && Object.keys(data.monthly_revenue).length > 0) {
        data.revenue_source = 'manual';
    } else {
        data.revenue_source = null;
    }
    return { data: data as PartnerInsert, errors };
}

// --- HELPER: Process EDIT Partner Form Data (REFINED) ---
function processEditPartnerFormData(formData: FormData, existingPartnerData: PartnerRow): { data: PartnerUpdate, errors: Record<string, string> } {
    console.log("--- SERVER: processEditPartnerFormData ---");
    formData.forEach((value, key) => console.log(`EDIT FORM DATA RECEIVED: ${key} = "${value}" (type: ${typeof value})`));
    console.log("Existing Partner Data for Edit (before processing form):", JSON.stringify(existingPartnerData, null, 2));


    const errors: Record<string, string> = {};
    const dataToUpdate: PartnerUpdate = {}; // Only include fields that are changing

    // Helper to check if a value from form is different from existing, and is not undefined
    const isValueChanged = (newValue: any, oldValue: any) => newValue !== undefined && newValue !== oldValue;

    // Name
    const nameVal = (formData.get('name') as string)?.trim();
    if (!nameVal) errors.name = 'Name is required.';
    else if (isValueChanged(nameVal, existingPartnerData.name)) dataToUpdate.name = nameVal;

    // Mobile
    const mobileVal = (formData.get('mobile') as string)?.trim();
    if (!mobileVal) errors.mobile = 'Mobile is required.';
    else if (isValueChanged(mobileVal, existingPartnerData.mobile)) dataToUpdate.mobile = mobileVal;

    // Email
    const emailVal = (formData.get('email') as string)?.trim();
    if (!emailVal) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) errors.email = 'Invalid email format.';
    else if (isValueChanged(emailVal, existingPartnerData.email)) dataToUpdate.email = emailVal;


    // Optional fields - only add to dataToUpdate if they actually changed from existing
    const addressVal = (formData.get('address') as string)?.trim() || null;
    if (isValueChanged(addressVal, existingPartnerData.address)) dataToUpdate.address = addressVal;

    const webmoneyVal = (formData.get('webmoney') as string)?.trim() || null;
    if (isValueChanged(webmoneyVal, existingPartnerData.webmoney)) dataToUpdate.webmoney = webmoneyVal;

    const multiAccNoVal = (formData.get('multi_account_no') as string)?.trim() || null;
    if (isValueChanged(multiAccNoVal, existingPartnerData.multi_account_no)) dataToUpdate.multi_account_no = multiAccNoVal;

    const adsteraLinkVal = (formData.get('adstera_link') as string)?.trim() || null;
    if (isValueChanged(adsteraLinkVal, existingPartnerData.adstera_link)) dataToUpdate.adstera_link = adsteraLinkVal;

    const adsteraEmailLinkVal = (formData.get('adstera_email_link') as string)?.trim() || null;
    if (isValueChanged(adsteraEmailLinkVal, existingPartnerData.adstera_email_link)) dataToUpdate.adstera_email_link = adsteraEmailLinkVal;

    const newApiKey = (formData.get('adstera_api_key') as string)?.trim(); // Allows empty string
    if (newApiKey !== undefined && newApiKey !== (existingPartnerData.adstera_api_key || '')) { // Compare with existing, treat null and "" as same for "no key"
        dataToUpdate.adstera_api_key = newApiKey || null; // Store empty string as null
        dataToUpdate.api_revenue_usd = null; dataToUpdate.api_revenue_pkr = null; dataToUpdate.last_api_check = null;
    }

    const accountCreationStr = formData.get('account_creation') as string;
    if (accountCreationStr !== undefined ) { // If field was present in form
        if (accountCreationStr.trim() !== '') {
             try {
                const newDate = new Date(accountCreationStr).toISOString();
                if (newDate !== existingPartnerData.account_creation) dataToUpdate.account_creation = newDate;
            } catch (e) { errors.account_creation = "Invalid creation date."; }
        } else if (existingPartnerData.account_creation !== null) { // Field was cleared
            dataToUpdate.account_creation = null;
        }
    }

    const accountStartStr = formData.get('account_start') as string;
    if (accountStartStr !== undefined) {
        if (accountStartStr.trim() !== '') {
            try {
                const newDate = new Date(accountStartStr).toISOString();
                if (newDate !== existingPartnerData.account_start) dataToUpdate.account_start = newDate;
            } catch (e) { errors.account_start = "Invalid start date."; }
        } else if (existingPartnerData.account_start !== null) { // Field was cleared
            dataToUpdate.account_start = null;
        }
    }


    // --- Process Monthly Revenue (More careful conditional logic) ---
    let revenueDataChanged = false;
    const updatedMonthlyRevenue: Record<string, MonthlyRevenuePeriodEntry> =
        JSON.parse(JSON.stringify(existingPartnerData.monthly_revenue || {}));

    const formRevenuePeriod = (formData.get('revenuePeriod') as string | null)?.trim(); // Value from <input name="revenuePeriod" type="month">
    const formRevenueRateUSDStr = formData.get('revenueRateUSD') as string | null; // Value from <input name="revenueRateUSD" type="number">
    const formPaymentStatus = (formData.get('paymentStatus') as string | null) || 'pending';

    // Only attempt to process revenue section IF the period input has a value from the form
    if (formRevenuePeriod) {
        if (!/^\d{4}-\d{2}$/.test(formRevenuePeriod)) {
            errors.revenuePeriod = 'Revenue Period must be in YYYY-MM format if provided.';
        } else {
            // Period is validly formatted. Now check rate.
            let formRevenueRateUSD: number | null = null; // Assume null if not a valid number or cleared

            if (formRevenueRateUSDStr !== null && formRevenueRateUSDStr.trim() !== '') {
                const parsedRate = parseFloat(formRevenueRateUSDStr);
                if (isNaN(parsedRate) || parsedRate < 0) {
                    errors.revenueRateUSD = 'Revenue (USD) must be a valid non-negative number if provided for a period.';
                } else {
                    formRevenueRateUSD = parsedRate;
                }
            } else if (formRevenueRateUSDStr === '') { // User explicitly cleared the rate input
                formRevenueRateUSD = null;
            }
            // If formRevenueRateUSDStr was null (field not in form), formRevenueRateUSD stays null, implying no rate submitted

            if (!errors.revenueRateUSD) { // Only proceed if rate (or its clearance) is valid
                const existingEntryForPeriod = updatedMonthlyRevenue[formRevenuePeriod];
                if (formRevenueRateUSD !== null) { // User wants to set/update the rate for formRevenuePeriod
                    if (!existingEntryForPeriod || existingEntryForPeriod.usd !== formRevenueRateUSD || existingEntryForPeriod.status !== formPaymentStatus) {
                        console.log(`[processEdit] Updating/Adding period ${formRevenuePeriod} with USD ${formRevenueRateUSD}, Status ${formPaymentStatus}`);
                        updatedMonthlyRevenue[formRevenuePeriod] = { usd: formRevenueRateUSD, pkr: formRevenueRateUSD * PKR_RATE, status: formPaymentStatus };
                        revenueDataChanged = true;
                    }
                } else { // formRevenueRateUSD is null (user cleared rate input FOR THIS formRevenuePeriod)
                    if (updatedMonthlyRevenue.hasOwnProperty(formRevenuePeriod)) {
                        console.log(`[processEdit] Deleting period ${formRevenuePeriod} as amount was cleared.`);
                        delete updatedMonthlyRevenue[formRevenuePeriod];
                        revenueDataChanged = true;
                    }
                }
            }
        }
    }
    // Only assign to dataToUpdate if actual changes occurred or if it's different from existing.
    if (revenueDataChanged || JSON.stringify(updatedMonthlyRevenue) !== JSON.stringify(existingPartnerData.monthly_revenue || {})) {
        dataToUpdate.monthly_revenue = updatedMonthlyRevenue as any;
    }


    // Revenue Source Re-evaluation (only if something that affects it changed)
    const currentApiKey = dataToUpdate.adstera_api_key === undefined ? existingPartnerData.adstera_api_key : dataToUpdate.adstera_api_key;
    const currentMonthlyRevenue = dataToUpdate.monthly_revenue === undefined ? (existingPartnerData.monthly_revenue || {}) : dataToUpdate.monthly_revenue;
    let newRevenueSource: string | null = null;

    if (currentApiKey) {
        newRevenueSource = 'api_loading'; // Default if key present
        if (dataToUpdate.adstera_api_key === undefined && existingPartnerData.adstera_api_key) { // Key unchanged by this form submit
            newRevenueSource = existingPartnerData.revenue_source; // Keep old source
        }
    } else if (Object.keys(currentMonthlyRevenue).length > 0) {
        newRevenueSource = 'manual';
    } else {
        newRevenueSource = null;
    }

    if (newRevenueSource !== existingPartnerData.revenue_source) {
        dataToUpdate.revenue_source = newRevenueSource;
    }
    
    console.log("processEditPartnerFormData - FINAL VALIDATION ERRORS:", JSON.stringify(errors, null, 2));
    console.log("processEditPartnerFormData - DATA TO UPDATE (if no errors):", JSON.stringify(dataToUpdate, null, 2));
    return { data: dataToUpdate, errors };
}

// --- HELPER: Shape IMPORTED Partner Data ---
function shapeImportedPartnerDataForDb(importedRowMappedData: Record<string, any>, adminId: string, existingPartner: PartnerRow | null): Partial<PartnerInsert | PartnerUpdate> {
    const output: Partial<PartnerInsert | PartnerUpdate> = { admin_id: adminId };
    const getName = importedRowMappedData.name ? String(importedRowMappedData.name).trim() : ''; const getEmail = importedRowMappedData.email ? String(importedRowMappedData.email).toLowerCase().trim() : ''; const getMobile = importedRowMappedData.mobile ? String(importedRowMappedData.mobile).trim() : '';
    output.name = getName || (existingPartner ? existingPartner.name : null); output.email = getEmail || (existingPartner ? existingPartner.email : null); output.mobile = getMobile || (existingPartner ? existingPartner.mobile : null);
    const assignOrKeep = (key: keyof (PartnerInsert | PartnerUpdate), importedVal: any) => { if (importedVal !== undefined) { (output as any)[key] = importedVal === '' ? null : (typeof importedVal === 'string' ? importedVal.trim() : importedVal); } else if (existingPartner && (existingPartner as any)[key] !== undefined) { (output as any)[key] = (existingPartner as any)[key]; } else if (!existingPartner) { (output as any)[key] = null; }};
    assignOrKeep('address', importedRowMappedData.address); assignOrKeep('webmoney', importedRowMappedData.webmoney); assignOrKeep('multi_account_no', importedRowMappedData.multi_account_no); assignOrKeep('adstera_link', importedRowMappedData.adstera_link); assignOrKeep('adstera_email_link', importedRowMappedData.adstera_email_link);
    if (importedRowMappedData.adstera_api_key !== undefined) { output.adstera_api_key = importedRowMappedData.adstera_api_key ? String(importedRowMappedData.adstera_api_key).trim() : null; if (!existingPartner || output.adstera_api_key !== existingPartner.adstera_api_key) { output.api_revenue_usd = null; output.api_revenue_pkr = null; output.last_api_check = null; }} else if (existingPartner) { output.adstera_api_key = existingPartner.adstera_api_key; } else { output.adstera_api_key = null; }
    if (importedRowMappedData.account_creation) output.account_creation = importedRowMappedData.account_creation; else if (existingPartner) output.account_creation = existingPartner.account_creation; else output.account_creation = null;
    if (importedRowMappedData.account_start) output.account_start = importedRowMappedData.account_start; else if (existingPartner) output.account_start = existingPartner.account_start; else output.account_start = null;
    output.account_status = importedRowMappedData.accountStatus || existingPartner?.account_status || 'active';
    let finalMonthlyRevenue: Record<string, MonthlyRevenuePeriodEntry> = {}; if (existingPartner && existingPartner.monthly_revenue && typeof existingPartner.monthly_revenue === 'object') { finalMonthlyRevenue = JSON.parse(JSON.stringify(existingPartner.monthly_revenue)); }
    if (importedRowMappedData.revenuePeriod && (importedRowMappedData.revenueUSD !== null && importedRowMappedData.revenueUSD !== undefined)) { const period = importedRowMappedData.revenuePeriod as string; const usd = importedRowMappedData.revenueUSD as number; const status = (importedRowMappedData.paymentStatus as string | null) || 'pending'; finalMonthlyRevenue[period] = { usd, pkr: usd * PKR_RATE, status }; } output.monthly_revenue = finalMonthlyRevenue as any;
    const apiKeyForSource = output.adstera_api_key === undefined ? existingPartner?.adstera_api_key : output.adstera_api_key;
    if (apiKeyForSource) { const apiKeyChanged = importedRowMappedData.adstera_api_key !== undefined && importedRowMappedData.adstera_api_key !== existingPartner?.adstera_api_key; if (apiKeyChanged || (existingPartner && existingPartner.revenue_source !== 'api' && existingPartner.revenue_source !== 'api_error' && existingPartner.revenue_source !== 'api_loading')) { output.revenue_source = 'api_loading'; } else if (existingPartner) { output.revenue_source = existingPartner.revenue_source; } else { output.revenue_source = 'api_loading'; } } else if (Object.keys(output.monthly_revenue || {}).length > 0) { output.revenue_source = 'manual'; } else { output.revenue_source = null; } return output;
}


// --- SVELTEKIT ACTIONS ---
// src/routes/(app)/dashboard/+page.server.ts
// ... (existing imports, types, load function, helper functions) ...

export const actions: Actions = {
    addPartner: async ({ request, locals, fetch }) => { // Add `fetch` to params
        // ... (existing validation logic for addPartner) ...
        // Inside the block after successful Supabase insert:
        // if (insertError) { ... }

        // const { data: partnerDataToInsert, ... } = processNewPartnerFormData(...)
        // Let's assume partnerDataToInsert is available here after processing but before insertion if we want its ID
        // OR, we fetch the newly created partner if insert was by PK to get the ID

        // Simpler: If insert was successful, and partnerDataToInsert HAD an API key making revenue_source 'api_loading'
        // We need the ID of the newly created partner.
        // The `.insert()` doesn't easily return the ID by default without a .select().single() and assuming only one insert.

        // Best approach after insert: The `addPartner` function should return enough info
        // or the client should invalidate and the list update triggers UI change for 'api_loading'.
        // The 'api_loading' itself can be a visual cue. A separate "fetch revenue" button per row,
        // or the "Refresh All API" covers the fetching after initial add.

        // FOR SIMPLICITY for now: We will rely on 'Refresh All' or a manual trigger.
        // Auto-triggering here requires getting the newly created partner's ID back robustly,
        // which can be done with `.insert(partnerDataToInsert).select('id').single()` if only one.
        // If we want to trigger, it would look like this:

        /*
        // --- Hypothetical auto-trigger logic for addPartner ---
        const { data: newPartner, error: insertError } = await supabase
            .from('partners')
            .insert(partnerDataToInsert)
            .select('id, adstera_api_key, revenue_source') // select the ID and key/source
            .single();

        if (insertError) {
            // ... handle insertError ...
            return fail(500, { message: `DB error: ${insertError.message}`, ... });
        }

        if (newPartner && newPartner.revenue_source === 'api_loading' && newPartner.adstera_api_key) {
            console.log(`[/dashboard addPartner action] New partner ${newPartner.id} has API key, queueing revenue fetch.`);
            // Non-blocking call to our API endpoint
            fetch('/api/fetch-adsterra-revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId: newPartner.id })
            }).catch(err => console.error("Error auto-fetching revenue for new partner:", err));
            // Don't await this, let it run in the background.
        }
        return { success: true, message: 'Partner added successfully!', action: '?/addPartner' };
        // --- End hypothetical ---
        */

        // CURRENT addPartner (keeping it simple, manual refresh for now)
        // (Your existing addPartner logic for insertError handling and success return)
        if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: '?/addPartner' }); }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const { data: partnerDataToInsert, errors: validationErrors } = processNewPartnerFormData(formData, adminId);

        if (partnerDataToInsert.email && !validationErrors.email) {
            try {
                const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToInsert.email);
                if (emailCheckError) throw emailCheckError;
                if (count && count > 0) validationErrors.email = 'This email already exists for your partners.';
            } catch (e: any) { return fail(500, { success: false, message: `Server error: ${e.message}`, errors: validationErrors, data: Object.fromEntries(formData), action: '?/addPartner' }); }
        }
        if (Object.keys(validationErrors).length > 0) {
            return fail(400, { success: false, message: 'Form has errors.', errors: validationErrors, data: Object.fromEntries(formData), action: '?/addPartner' });
        }
        
        // Modified insert to get ID back
        const { data: insertedPartnerData, error: insertError } = await supabase
            .from('partners')
            .insert(partnerDataToInsert)
            .select('id, adstera_api_key, revenue_source') // Select what's needed for API trigger
            .single(); // Expecting one row

        if (insertError) {
            if (insertError.code === '23505') return fail(409, { success: false, message: 'Duplicate entry.', errors: { email: 'Email might be duplicate.' }, data: Object.fromEntries(formData), action: '?/addPartner' });
            return fail(500, { success: false, message: `DB error: ${insertError.message}`, data: Object.fromEntries(formData), action: '?/addPartner' });
        }

        if (insertedPartnerData && insertedPartnerData.revenue_source === 'api_loading' && insertedPartnerData.adstera_api_key) {
            console.log(`[/dashboard addPartner action] Partner ${insertedPartnerData.id} added with API key. Triggering initial revenue fetch.`);
            // Fire-and-forget: We don't await this as the form action should return quickly.
            // The `fetch` here is SvelteKit's server-side fetch, which can call relative paths.
            fetch('/api/fetch-adsterra-revenue', { // This calls your own API endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId: insertedPartnerData.id })
            }).then(async (res) => {
                if (!res.ok) console.error(`Auto-fetch for new partner ${insertedPartnerData.id} failed with status ${res.status}: ${await res.text()}`);
                else console.log(`Auto-fetch for new partner ${insertedPartnerData.id} initiated.`);
            }).catch(err => console.error("Error initiating auto-fetch for new partner:", err));
        }
        return { success: true, message: 'Partner added successfully!', action: '?/addPartner' };
    },

    editPartner: async ({ request, locals, url, fetch }) => { // Add `fetch` to params
        const partnerIdToEdit = url.searchParams.get('id');
        const currentActionPath = `?/editPartner&id=${partnerIdToEdit || 'unknown'}`;
        console.log(`[/dashboard editPartner action (${currentActionPath})] Received submission.`);

        if (!locals.admin || !locals.admin.id) { /* ... unauthorized ... */ return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: currentActionPath });}
        const adminId = locals.admin.id;
        if (!partnerIdToEdit) { /* ... missing ID ... */ return fail(400, { success: false, message: 'Partner ID missing.', action: `?/editPartner` });}

        const { data: existingPartner, error: fetchError } = await supabase.from('partners').select('*').eq('id', partnerIdToEdit).eq('admin_id', adminId).single();
        if (fetchError || !existingPartner) { /* ... not found ... */ return fail(404, { success: false, message: 'Partner not found or access denied.', action: currentActionPath });}

        const formData = await request.formData();
        const { data: partnerDataToUpdate, errors: validationErrors } = processEditPartnerFormData(formData, existingPartner);

        // ... (email uniqueness check from previous complete code for editPartner) ...
        if (partnerDataToUpdate.email && partnerDataToUpdate.email !== existingPartner.email && !validationErrors.email) { try { const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToUpdate.email as string).neq('id', partnerIdToEdit); if (emailCheckError) throw emailCheckError; if (count && count > 0) { validationErrors.email = 'This email address already exists for another partner.'; } } catch (e: any) { return fail(500, { success: false, message: `Server error during email check: ${e.message}`, errors: validationErrors, data: Object.fromEntries(formData), action: currentActionPath }); } }


        if (Object.keys(validationErrors).length > 0) {
            /* ... fail with validation errors ... */
            const formValues: Record<string, any> = {}; formData.forEach((value, key) => formValues[key] = value); const repopulateData = { ...existingPartner, ...formValues, monthly_revenue: existingPartner.monthly_revenue }; return fail(400, { success: false, message: 'Form has errors.', errors: validationErrors, data: repopulateData, action: currentActionPath });
        }

        // Check if API key was actually part of the update and changed,
        // or if revenue_source in the update payload is 'api_loading'.
        const apiKeyActuallyChanged = partnerDataToUpdate.adstera_api_key !== undefined &&
                                    partnerDataToUpdate.adstera_api_key !== existingPartner.adstera_api_key;
        const shouldTriggerApiFetch = apiKeyActuallyChanged || partnerDataToUpdate.revenue_source === 'api_loading';


        if (Object.keys(partnerDataToUpdate).length === 0 && !shouldTriggerApiFetch) { // Also ensure if only key changed and needs fetch, it proceeds
             console.log(`[/dashboard editPartner action (${currentActionPath})] No actual data changes to save (excluding API key check for fetch).`);
             // If API key changed, revenue_source would be 'api_loading' which means partnerDataToUpdate ISN'T empty
             // So this check for empty partnerDataToUpdate is tricky with implicit API key effects
             if (apiKeyActuallyChanged && partnerDataToUpdate.adstera_api_key) {
                 // Only an API key change, no other field changes. Proceed to fetch, skip DB update.
                 console.log(`[/dashboard editPartner action] API key changed for ${partnerIdToEdit}. Triggering revenue fetch.`);
                 fetch('/api/fetch-adsterra-revenue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ partnerId: partnerIdToEdit })
                }).then(async (res) => {
                    if (!res.ok) console.error(`Auto-fetch for edited partner ${partnerIdToEdit} failed with status ${res.status}: ${await res.text()}`);
                    else console.log(`Auto-fetch for edited partner ${partnerIdToEdit} initiated.`);
                }).catch(err => console.error("Error initiating auto-fetch for edited partner:", err));
                 return { success: true, message: 'API key updated, revenue fetch initiated.', action: currentActionPath };
             }
             return { success: true, message: 'No changes detected for partner.', action: currentActionPath };
        }


        const { error: updateError } = await supabase
            .from('partners')
            .update(partnerDataToUpdate)
            .eq('id', partnerIdToEdit)
            .eq('admin_id', adminId);

        if (updateError) { /* ... fail with update error ... */ return fail(500, { success: false, message: `Database error during partner update: ${updateError.message}`, action: currentActionPath });}

        if (shouldTriggerApiFetch && partnerDataToUpdate.adstera_api_key) { // Or use finalApiKey logic if new key is null
            console.log(`[/dashboard editPartner action] Partner ${partnerIdToEdit} updated, API key present/changed. Triggering revenue fetch.`);
            fetch('/api/fetch-adsterra-revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId: partnerIdToEdit })
            }).then(async (res) => {
                if (!res.ok) console.error(`Auto-fetch for edited partner ${partnerIdToEdit} (post-update) failed: ${await res.text()}`);
                else console.log(`Auto-fetch for edited partner ${partnerIdToEdit} (post-update) initiated.`);
            }).catch(err => console.error("Error initiating auto-fetch for edited partner (post-update):", err));
        }

        return { success: true, message: 'Partner updated successfully!', action: currentActionPath };
    },

    // ... (deletePartner, toggleAccountStatus, importPartners actions are the same) ...
     deletePartner: async ({ request, locals }) => { if (!locals.admin || !locals.admin.id) return fail(401, { success: false, message: 'Unauthorized.', action: '?/deletePartner' }); const adminId = locals.admin.id; const formData = await request.formData(); const partnerId = formData.get('partnerId') as string; if (!partnerId) return fail(400, { success: false, message: 'Partner ID required.', action: '?/deletePartner' }); const { error: delError } = await supabase.from('partners').delete().eq('id', partnerId).eq('admin_id', adminId); if (delError) return fail(500, { success: false, message: `DB error: ${delError.message}`, action: '?/deletePartner' }); return { success: true, message: 'Partner deleted.', action: '?/deletePartner' }; },
     toggleAccountStatus: async ({ request, locals }) => { if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.' }); } const adminId = locals.admin.id; const formData = await request.formData(); const partnerId = formData.get('partnerId') as string; const currentStatus = formData.get('currentStatus') as string; if (!partnerId || !currentStatus) { return fail(400, { success: false, message: 'ID & status required.' }); } const newStatus = currentStatus === 'active' ? 'suspended' : 'active'; const { error: updateError } = await supabase.from('partners').update({ account_status: newStatus, updated_at: new Date().toISOString() }).eq('id', partnerId).eq('admin_id', adminId); if (updateError) { return fail(500, { success: false, message: `DB error: ${updateError.message}` }); } return { type: 'success', status: 200, data: { success: true, message: `Status updated to ${newStatus}.` }}; },
     importPartners: async ({ request, locals }): Promise<ActionResult> => { if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized for import.' }); } const adminId = locals.admin.id; const formData = await request.formData(); const partnersToImportJson = formData.get('partnersToImportJson') as string; if (!partnersToImportJson) { return fail(400, { success: false, message: 'No import data received.' }); } let partnersToImport: Array<Record<string, any>>; try { partnersToImport = JSON.parse(partnersToImportJson); if (!Array.isArray(partnersToImport) || partnersToImport.length === 0) { throw new Error("Data not array or empty."); } } catch (e: any) { return fail(400, { success: false, message: `Invalid import data: ${e.message}` }); } const resultsReport = { successfulUpserts: 0, failedRowsInfo: [] as { originalIndex?: number, email?: string, error: string }[] }; const importedEmails = partnersToImport.map(p => p.email?.toLowerCase()).filter(Boolean) as string[]; let existingPartnersMap = new Map<string, PartnerRow>(); if (importedEmails.length > 0) { const { data: dbPartners, error: fetchErr } = await supabase.from('partners').select('*').eq('admin_id', adminId).in('email', importedEmails); if (fetchErr) { return fail(500, { success: false, message: `DB error preparing import: ${fetchErr.message}`}); } dbPartners?.forEach(p => { if(p.email) existingPartnersMap.set(p.email.toLowerCase(), p); }); } const upsertOperations: Array<PartnerUpdate | PartnerInsert> = []; for (const importedRow of partnersToImport) { const emailKey = importedRow.email?.toLowerCase(); if (!emailKey) { resultsReport.failedRowsInfo.push({ originalIndex: importedRow._originalIndexExcel, email: importedRow.email, error: "Email missing/invalid." }); continue; } const existingPartner = existingPartnersMap.get(emailKey) || null; let shapedData = shapeImportedPartnerDataForDb(importedRow, adminId, existingPartner); if (existingPartner) { (shapedData as PartnerUpdate).id = existingPartner.id; } upsertOperations.push(shapedData as (PartnerUpdate | PartnerInsert)); } if (upsertOperations.length > 0) { const { error: batchError, count } = await supabase.from('partners').upsert(upsertOperations, { onConflict: 'admin_id,email' }); if (batchError) { console.error("Supabase batch upsert error for import:", batchError); return fail(500, { success: false, message: `Import DB error: ${batchError.message}.`, data: { errorsByRow: [{ error: batchError.message, email:"Batch Operation" }] } }); } resultsReport.successfulUpserts = count ?? upsertOperations.length; } if (resultsReport.failedRowsInfo.length > 0) { return fail(400, { success: false, message: `Import: ${resultsReport.successfulUpserts} success, ${resultsReport.failedRowsInfo.length} pre-DB failures.`, data: { successfulUpserts: resultsReport.successfulUpserts, errorsByRow: resultsReport.failedRowsInfo } }); } return { type: 'success', status: 200, data: { success: true, message: `Successfully imported/updated ${resultsReport.successfulUpserts} partner(s).`, successfulUpserts: resultsReport.successfulUpserts } }; },

       refreshAllApiRevenue: async ({ locals, fetch }) => { // Added `fetch` from event context
        console.log('[/dashboard refreshAllApiRevenue action] Request received.');
        if (!locals.admin || !locals.admin.id) {
            return fail(401, { success: false, message: 'Unauthorized.', action: '?/refreshAllApiRevenue' });
        }
        const adminId = locals.admin.id;

        // 1. Get all partners for this admin that have an API key
        const { data: partnersWithKeys, error: fetchPartnersError } = await supabase
            .from('partners')
            .select('id, name, adstera_api_key') // Only need id and key
            .eq('admin_id', adminId)
            .not('adstera_api_key', 'is', null) // Key is not null
            .neq('adstera_api_key', '');        // Key is not an empty string

        if (fetchPartnersError) {
            console.error('[/dashboard refreshAllApiRevenue action] Error fetching partners with API keys:', fetchPartnersError);
            return fail(500, { success: false, message: 'Database error fetching partners.', action: '?/refreshAllApiRevenue' });
        }

        if (!partnersWithKeys || partnersWithKeys.length === 0) {
            console.log('[/dashboard refreshAllApiRevenue action] No partners with API keys found for this admin.');
            return { success: true, message: 'No partners found with API keys configured to refresh.', action: '?/refreshAllApiRevenue' };
        }

        console.log(`[/dashboard refreshAllApiRevenue action] Found ${partnersWithKeys.length} partners with API keys. Initiating fetches...`);

        // 2. For each partner, trigger the /api/fetch-adsterra-revenue endpoint
        // These are fire-and-forget. We don't wait for all of them to complete
        // before returning a response to the client for the initial action.
        let initiatedCount = 0;
        partnersWithKeys.forEach(partner => {
            if (partner.id && partner.adstera_api_key) {
                initiatedCount++;
                fetch('/api/fetch-adsterra-revenue', { // SvelteKit server-side fetch to own endpoint
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ partnerId: partner.id })
                })
                .then(async (res) => {
                    if (!res.ok) {
                        console.error(`Background API fetch for ${partner.name} (ID: ${partner.id}) failed: ${res.status} - ${await res.text()}`);
                    } else {
                        console.log(`Background API fetch initiated for ${partner.name} (ID: ${partner.id}) successfully.`);
                    }
                })
                .catch(err => {
                    console.error(`Error in background API fetch promise for ${partner.name} (ID: ${partner.id}):`, err);
                });
            }
        });

        // The UI will update gradually as each background fetch completes and `invalidateAll`
        // (from the dashboard page's general form handler) refreshes the data.
        return {
            success: true,
            message: `API revenue refresh process initiated for ${initiatedCount} partner(s). Table will update as data arrives.`,
            action: '?/refreshAllApiRevenue'
        };
    }
};