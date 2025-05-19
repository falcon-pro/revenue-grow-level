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
export const actions: Actions = {
    addPartner: async ({ request, locals }) => {
        if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: '?/addPartner' }); }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const { data: partnerDataToInsert, errors: validationErrors } = processNewPartnerFormData(formData, adminId);

        if (partnerDataToInsert.email && !validationErrors.email) {
            try {
                const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToInsert.email);
                if (emailCheckError) { console.error("Add partner email check DB error:", emailCheckError); throw emailCheckError; }
                if (count && count > 0) { validationErrors.email = 'This email address already exists for your partners.'; }
            } catch (e: any) { return fail(500, { success: false, message: `Server error checking email: ${e.message}`, errors: validationErrors, data: Object.fromEntries(formData), action: '?/addPartner' }); }
        }
        if (Object.keys(validationErrors).length > 0) {
            return fail(400, { success: false, message: 'Form has validation errors.', errors: validationErrors, data: Object.fromEntries(formData), action: '?/addPartner' });
        }
        const { error: insertError } = await supabase.from('partners').insert(partnerDataToInsert);
        if (insertError) {
            console.error("Add partner DB insert error:", insertError);
            if (insertError.code === '23505') return fail(409, { success: false, message: 'A partner with this email may already exist for your account.', errors: { email: 'This email might already be in use.' }, data: Object.fromEntries(formData), action: '?/addPartner' });
            return fail(500, { success: false, message: `Database error adding partner: ${insertError.message}`, data: Object.fromEntries(formData), action: '?/addPartner' });
        }
        return { success: true, message: 'Partner added successfully!', action: '?/addPartner' };
    },

    deletePartner: async ({ request, locals }) => {
        if (!locals.admin || !locals.admin.id) return fail(401, { success: false, message: 'Unauthorized.', action: '?/deletePartner' });
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const partnerId = formData.get('partnerId') as string;
        if (!partnerId) return fail(400, { success: false, message: 'Partner ID is required.', action: '?/deletePartner' });
        const { error: deleteError } = await supabase.from('partners').delete().eq('id', partnerId).eq('admin_id', adminId);
        if (deleteError) { console.error("Delete partner DB error:", deleteError); return fail(500, { success: false, message: `Database error deleting partner: ${deleteError.message}`, action: '?/deletePartner' }); }
        return { success: true, message: 'Partner deleted successfully.', action: '?/deletePartner' };
    },

    editPartner: async ({ request, locals, url }) => {
        const partnerIdToEdit = url.searchParams.get('id');
        const currentActionPath = `?/editPartner&id=${partnerIdToEdit || 'unknown'}`;
        console.log(`[/dashboard editPartner action (${currentActionPath})] Received submission.`);

        if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: currentActionPath }); }
        const adminId = locals.admin.id;
        if (!partnerIdToEdit) { return fail(400, { success: false, message: 'Partner ID missing from request.', action: `?/editPartner` }); } // Generic action if ID really gone

        const { data: existingPartner, error: fetchError } = await supabase.from('partners').select('*').eq('id', partnerIdToEdit).eq('admin_id', adminId).single();
        if (fetchError || !existingPartner) { console.error(`Edit partner - fetch existing error or not found (ID: ${partnerIdToEdit}) :`, fetchError); return fail(404, { success: false, message: 'Partner not found or not accessible.', action: currentActionPath }); }

        const formData = await request.formData();
        const { data: partnerDataToUpdate, errors: validationErrors } = processEditPartnerFormData(formData, existingPartner);

        if (partnerDataToUpdate.email && partnerDataToUpdate.email !== existingPartner.email && !validationErrors.email) {
            try {
                const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToUpdate.email as string).neq('id', partnerIdToEdit);
                if (emailCheckError) { console.error("Edit partner email check DB error:", emailCheckError); throw emailCheckError; }
                if (count && count > 0) { validationErrors.email = 'This email address already exists for another of your partners.'; }
            } catch (e: any) { return fail(500, { success: false, message: `Server error during email uniqueness check: ${e.message}`, errors: validationErrors, data: Object.fromEntries(formData), action: currentActionPath }); }
        }
        console.log(`[/dashboard editPartner action] Validation Errors after all checks:`, JSON.stringify(validationErrors));

        if (Object.keys(validationErrors).length > 0) {
            console.log(`[/dashboard editPartner action (${currentActionPath})] Validation errors returned to client.`);
            const formValues: Record<string, any> = {}; formData.forEach((value, key) => formValues[key] = value);
            const repopulateData = { ...existingPartner, ...formValues, monthly_revenue: existingPartner.monthly_revenue }; // Key parts for repopulation
            return fail(400, { success: false, message: 'Form has errors. Please correct them.', errors: validationErrors, data: repopulateData, action: currentActionPath });
        }
        
        // If dataToUpdate is empty (no actual changes were made to updatable fields),
        // we can consider it a success without hitting the DB.
        if (Object.keys(partnerDataToUpdate).length === 0) {
            console.log(`[/dashboard editPartner action (${currentActionPath})] No actual changes detected for partner. Returning success.`);
            return { success: true, message: 'No changes detected for partner.', action: currentActionPath };
        }

        console.log(`[/dashboard editPartner action (${currentActionPath})] Attempting to update partner with data:`, JSON.stringify(partnerDataToUpdate));
        const { error: updateError } = await supabase.from('partners').update(partnerDataToUpdate).eq('id', partnerIdToEdit).eq('admin_id', adminId);
        if (updateError) { console.error("Edit partner DB update error:", updateError); return fail(500, { success: false, message: `Database error during partner update: ${updateError.message}`, action: currentActionPath }); }
        
        console.log(`[/dashboard editPartner action (${currentActionPath})] Partner updated successfully.`);
        return { success: true, message: 'Partner updated successfully!', action: currentActionPath };
    },

    toggleAccountStatus: async ({ request, locals }) => {
        if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.' }); }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const partnerId = formData.get('partnerId') as string;
        const currentStatus = formData.get('currentStatus') as string;
        if (!partnerId || !currentStatus) { return fail(400, { success: false, message: 'Partner ID and current status are required.' }); }
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const { error: updateError } = await supabase.from('partners').update({ account_status: newStatus, updated_at: new Date().toISOString() }).eq('id', partnerId).eq('admin_id', adminId);
        if (updateError) { console.error("Toggle status DB error:", updateError); return fail(500, { success: false, message: `Database error updating status: ${updateError.message}` }); }
        return { type: 'success', status: 200, data: { success: true, message: `Account status updated to ${newStatus}.` }};
    },

    importPartners: async ({ request, locals }): Promise<ActionResult> => {
        if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized for import.' }); }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const partnersToImportJson = formData.get('partnersToImportJson') as string;
        if (!partnersToImportJson) { return fail(400, { success: false, message: 'No import data received.' }); }

        let partnersToImport: Array<Record<string, any>>;
        try {
            partnersToImport = JSON.parse(partnersToImportJson);
            if (!Array.isArray(partnersToImport) || partnersToImport.length === 0) { throw new Error("Data not array or empty."); }
        } catch (e: any) { return fail(400, { success: false, message: `Invalid import data: ${e.message}` }); }

        const resultsReport = { successfulUpserts: 0, failedRowsInfo: [] as { originalIndex?: number, email?: string, error: string }[] };
        const importedEmails = partnersToImport.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];
        let existingPartnersMap = new Map<string, PartnerRow>();

        if (importedEmails.length > 0) {
            const { data: dbPartners, error: fetchErr } = await supabase.from('partners').select('*').eq('admin_id', adminId).in('email', importedEmails);
            if (fetchErr) { return fail(500, { success: false, message: `DB error preparing import: ${fetchErr.message}`}); }
            dbPartners?.forEach(p => { if(p.email) existingPartnersMap.set(p.email.toLowerCase(), p); });
        }

        const upsertOperations: Array<PartnerUpdate | PartnerInsert> = [];
        for (const importedRow of partnersToImport) {
            const emailKey = importedRow.email?.toLowerCase();
            if (!emailKey) { resultsReport.failedRowsInfo.push({ originalIndex: importedRow._originalIndexExcel, email: importedRow.email, error: "Email missing/invalid." }); continue; }
            const existingPartner = existingPartnersMap.get(emailKey) || null;
            let shapedData = shapeImportedPartnerDataForDb(importedRow, adminId, existingPartner);
            if (existingPartner) { (shapedData as PartnerUpdate).id = existingPartner.id; }
            upsertOperations.push(shapedData as (PartnerUpdate | PartnerInsert));
        }

        if (upsertOperations.length > 0) {
            const { error: batchError, count } = await supabase.from('partners').upsert(upsertOperations, { onConflict: 'admin_id,email' });
            if (batchError) {
                console.error("Supabase batch upsert error for import:", batchError);
                return fail(500, { success: false, message: `Import DB error: ${batchError.message}.`, data: { errorsByRow: [{ error: batchError.message, email:"Batch Operation" }] } });
            }
            resultsReport.successfulUpserts = count ?? upsertOperations.length;
        }

        if (resultsReport.failedRowsInfo.length > 0) {
            return fail(400, { success: false, message: `Import: ${resultsReport.successfulUpserts} success, ${resultsReport.failedRowsInfo.length} pre-DB failures.`, data: { successfulUpserts: resultsReport.successfulUpserts, errorsByRow: resultsReport.failedRowsInfo } });
        }
        
        return { type: 'success', status: 200, data: { success: true, message: `Successfully imported/updated ${resultsReport.successfulUpserts} partner(s).`, successfulUpserts: resultsReport.successfulUpserts } };
    }
};