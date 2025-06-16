// src/routes/(app)/dashboard/+page.server.ts
console.log('--- ✅✅✅ DASHBOARD +page.server.ts IS BEING PROCESSED (FIXED VERSION) ✅✅✅ ---');

import { supabase } from '$lib/supabaseClient';
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions, ActionResult } from './$types';
import type { Database } from '../../../types/supabase';
import { PKR_RATE } from '$lib/utils/revenue';

// --- TYPE DEFINITIONS ---
type PartnerRow = Database['public']['Tables']['partners']['Row'];
type PartnerInsert = Database['public']['Tables']['partners']['Insert'];
type PartnerUpdate = Database['public']['Tables']['partners']['Update'];
type MonthlyRevenuePeriodEntry = { usd?: number | null; pkr?: number | null; status?: string | null; }; // No 'source' here

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

// --- HELPER: Process NEW Partner Form Data (apify_accounts integrated) ---
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

    // --- Handle apify_accounts ---
    const apifyAccountsStr = formData.get('apify_accounts') as string | null;
    if (apifyAccountsStr && apifyAccountsStr.trim() !== '') {
        const num = parseInt(apifyAccountsStr.trim(), 10);
        if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
            errors.apify_accounts = 'Apify Accounts must be a whole non-negative number.';
        } else {
            data.apify_accounts = num;
        }
    } else {
        data.apify_accounts = null; // Default to null if empty or not provided
    }
    // --- END apify_accounts ---

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


// --- HELPER: Process EDIT Partner Form Data (Revised for clarity, robustness, and apify_accounts) ---
function processEditPartnerFormData(formData: FormData, existingPartnerData: PartnerRow): { data: PartnerUpdate, errors: Record<string, string> } {
    console.log("--- SERVER: processEditPartnerFormData (REVISED) ---");
    // formData.forEach((value, key) => console.log(`EDIT FORM DATA RECEIVED: ${key} = "${value}" (type: ${typeof value})`));
    // console.log("Existing Partner Data for Edit (before processing form):", JSON.stringify(existingPartnerData, null, 2));

    const errors: Record<string, string> = {};
    const dataToUpdate: PartnerUpdate = {};
    const isValueChanged = (newValue: any, oldValue: any) => newValue !== undefined && newValue !== oldValue;

    const nameVal = (formData.get('name') as string)?.trim();
    if (!nameVal) errors.name = 'Name is required.';
    else if (isValueChanged(nameVal, existingPartnerData.name)) dataToUpdate.name = nameVal;

    const mobileVal = (formData.get('mobile') as string)?.trim();
    if (!mobileVal) errors.mobile = 'Mobile is required.';
    else if (isValueChanged(mobileVal, existingPartnerData.mobile)) dataToUpdate.mobile = mobileVal;

    const emailVal = (formData.get('email') as string)?.trim();
    if (!emailVal) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) errors.email = 'Invalid email format.';
    else if (isValueChanged(emailVal, existingPartnerData.email)) dataToUpdate.email = emailVal;

    const addressVal = (formData.get('address') as string)?.trim() || null;
    if (isValueChanged(addressVal, existingPartnerData.address)) dataToUpdate.address = addressVal;

    const webmoneyVal = (formData.get('webmoney') as string)?.trim() || null;
    if (isValueChanged(webmoneyVal, existingPartnerData.webmoney)) dataToUpdate.webmoney = webmoneyVal;

    const multiAccNoVal = (formData.get('multi_account_no') as string)?.trim() || null;
    if (isValueChanged(multiAccNoVal, existingPartnerData.multi_account_no)) dataToUpdate.multi_account_no = multiAccNoVal;

    // --- Handle apify_accounts for Edit ---
    const apifyAccountsStr = formData.get('apify_accounts') as string | null;
    if (apifyAccountsStr !== null) { // Field was submitted (even if empty string)
        if (apifyAccountsStr.trim() === '') {
            if (existingPartnerData.apify_accounts !== null) dataToUpdate.apify_accounts = null; // Explicitly cleared
        } else {
            const num = parseInt(apifyAccountsStr.trim(), 10);
            if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
                errors.apify_accounts = 'Apify Accounts must be a whole non-negative number.';
            } else if (isValueChanged(num, existingPartnerData.apify_accounts)) {
                dataToUpdate.apify_accounts = num;
            }
        }
    } // If apifyAccountsStr is null (not in form data), field is untouched for update


    const adsteraLinkVal = (formData.get('adstera_link') as string)?.trim() || null;
    if (isValueChanged(adsteraLinkVal, existingPartnerData.adstera_link)) dataToUpdate.adstera_link = adsteraLinkVal;

    const adsteraEmailLinkVal = (formData.get('adstera_email_link') as string)?.trim() || null;
    if (isValueChanged(adsteraEmailLinkVal, existingPartnerData.adstera_email_link)) dataToUpdate.adstera_email_link = adsteraEmailLinkVal;

    const newApiKeyRaw = formData.get('adstera_api_key') as string | null; // Can be null if field not sent
    if (newApiKeyRaw !== null) { // API key field was present in the form data
        const newApiKey = newApiKeyRaw.trim();
        const formApiKeyToStore = newApiKey === '' ? null : newApiKey;
        if (formApiKeyToStore !== existingPartnerData.adstera_api_key) {
            dataToUpdate.adstera_api_key = formApiKeyToStore;
            dataToUpdate.api_revenue_usd = null;
            dataToUpdate.api_revenue_pkr = null;
            dataToUpdate.last_api_check = null;
        }
    }


    const accountCreationStr = formData.get('account_creation') as string;
    if (accountCreationStr !== undefined ) {
        if (accountCreationStr.trim() !== '') {
             try {
                const newDate = new Date(accountCreationStr).toISOString();
                if (newDate !== existingPartnerData.account_creation) dataToUpdate.account_creation = newDate;
            } catch (e) { errors.account_creation = "Invalid creation date."; }
        } else if (existingPartnerData.account_creation !== null) {
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
        } else if (existingPartnerData.account_start !== null) {
            dataToUpdate.account_start = null;
        }
    }

    // --- Process Monthly Revenue (Structured like old, more robust code) ---
    let revenueDataChanged = false;
    const updatedMonthlyRevenue: Record<string, MonthlyRevenuePeriodEntry> =
        JSON.parse(JSON.stringify(existingPartnerData.monthly_revenue || {}));

    const formRevenuePeriod = (formData.get('revenuePeriod') as string | null)?.trim();
    const formRevenueRateUSDStr = formData.get('revenueRateUSD') as string | null;
    const formPaymentStatus = (formData.get('paymentStatus') as string | null) || 'pending';

    if (formRevenuePeriod || formRevenueRateUSDStr !== null) { // Process if period or rate was part of the form
        if (formRevenuePeriod && !/^\d{4}-\d{2}$/.test(formRevenuePeriod)) {
            errors.revenuePeriod = 'Period (YYYY-MM) format is required if revenue details are provided.';
        } else if (!formRevenuePeriod && formRevenueRateUSDStr !== null && formRevenueRateUSDStr.trim() !== '') {
            errors.revenuePeriod = 'Period (YYYY-MM) is required if revenue amount is entered.';
        } else if (formRevenuePeriod) { // Period is validly formatted, or it's present and rate might clear it
            let formRevenueRateUSD: number | null = null;

            if (formRevenueRateUSDStr !== null && formRevenueRateUSDStr.trim() !== '') { // Rate was submitted with a value
                const parsedRate = parseFloat(formRevenueRateUSDStr);
                if (isNaN(parsedRate) || parsedRate < 0) {
                    errors.revenueRateUSD = 'Revenue (USD) must be a valid non-negative number if provided.';
                } else {
                    formRevenueRateUSD = parsedRate;
                }
            } else if (formRevenueRateUSDStr === '') { // User explicitly cleared the rate input
                formRevenueRateUSD = null;
            }
            // If formRevenueRateUSDStr is null (field not in form), formRevenueRateUSD remains null here.
            // This implies that if the rate field isn't submitted, we don't try to parse it.

            if (!errors.revenueRateUSD && !errors.revenuePeriod) {
                const existingEntryForPeriod = updatedMonthlyRevenue[formRevenuePeriod];

                if (formRevenueRateUSDStr !== null) { // Rate field was present in the form (empty or with value)
                    if (formRevenueRateUSD !== null) { // User wants to set/update the rate for formRevenuePeriod
                        if (!existingEntryForPeriod || existingEntryForPeriod.usd !== formRevenueRateUSD || existingEntryForPeriod.status !== formPaymentStatus) {
                            updatedMonthlyRevenue[formRevenuePeriod] = { usd: formRevenueRateUSD, pkr: formRevenueRateUSD * PKR_RATE, status: formPaymentStatus };
                            revenueDataChanged = true;
                        }
                    } else { // formRevenueRateUSD is null (user cleared rate input FOR THIS formRevenuePeriod)
                        if (updatedMonthlyRevenue.hasOwnProperty(formRevenuePeriod)) {
                            delete updatedMonthlyRevenue[formRevenuePeriod];
                            revenueDataChanged = true;
                        }
                    }
                } else if (existingEntryForPeriod && existingEntryForPeriod.status !== formPaymentStatus) {
                    // Rate field was NOT in form, but period was. Only update status if it changed.
                    updatedMonthlyRevenue[formRevenuePeriod].status = formPaymentStatus;
                    revenueDataChanged = true;
                }
            }
        }
    }

    if (revenueDataChanged || JSON.stringify(updatedMonthlyRevenue) !== JSON.stringify(existingPartnerData.monthly_revenue || {})) {
        dataToUpdate.monthly_revenue = updatedMonthlyRevenue as any;
    }

    // --- Revenue Source Re-evaluation ---
    const finalApiKey = dataToUpdate.adstera_api_key === undefined ? existingPartnerData.adstera_api_key : dataToUpdate.adstera_api_key;
    const finalMonthlyRevenue = dataToUpdate.monthly_revenue === undefined ? (existingPartnerData.monthly_revenue || {}) : dataToUpdate.monthly_revenue;
    let newRevenueSource: string | null = null;

    if (finalApiKey && finalApiKey.trim() !== '') {
        newRevenueSource = 'api_loading';
    } else if (finalMonthlyRevenue && Object.keys(finalMonthlyRevenue).length > 0) {
        newRevenueSource = 'manual';
    } else {
        newRevenueSource = null;
    }

    if (newRevenueSource !== existingPartnerData.revenue_source) {
        dataToUpdate.revenue_source = newRevenueSource;
    }
    
    // console.log("processEditPartnerFormData (REVISED) - FINAL VALIDATION ERRORS:", JSON.stringify(errors, null, 2));
    // console.log("processEditPartnerFormData (REVISED) - DATA TO UPDATE (if no errors):", JSON.stringify(dataToUpdate, null, 2));
    return { data: dataToUpdate, errors };
}

// --- HELPER: Shape IMPORTED Partner Data (apify_accounts integrated, fixed monthly revenue) ---
function shapeImportedPartnerDataForDb(importedRowMappedData: Record<string, any>, adminId: string, existingPartner: PartnerRow | null): Partial<PartnerInsert | PartnerUpdate> {
    const output: Partial<PartnerInsert | PartnerUpdate> = { admin_id: adminId };
    const getName = importedRowMappedData.name ? String(importedRowMappedData.name).trim() : '';
    const getEmail = importedRowMappedData.email ? String(importedRowMappedData.email).toLowerCase().trim() : '';
    const getMobile = importedRowMappedData.mobile ? String(importedRowMappedData.mobile).trim() : '';
    
    output.name = getName || (existingPartner ? existingPartner.name : null);
    output.email = getEmail || (existingPartner ? existingPartner.email : null);
    output.mobile = getMobile || (existingPartner ? existingPartner.mobile : null);

    const assignOrKeep = (key: keyof (PartnerInsert | PartnerUpdate), importedVal: any) => {
        if (importedVal !== undefined) {
            (output as any)[key] = importedVal === '' ? null : (typeof importedVal === 'string' ? importedVal.trim() : importedVal);
        } else if (existingPartner && (existingPartner as any)[key] !== undefined) {
            (output as any)[key] = (existingPartner as any)[key];
        } else if (!existingPartner) {
            (output as any)[key] = null;
        }
    };

    assignOrKeep('address', importedRowMappedData.address);
    assignOrKeep('webmoney', importedRowMappedData.webmoney);
    assignOrKeep('multi_account_no', importedRowMappedData.multi_account_no);
    
    // --- Handle apify_accounts in import shaping ---
    if (importedRowMappedData.apify_accounts !== undefined) {
        const apifyVal = String(importedRowMappedData.apify_accounts).trim();
        if (apifyVal === '') {
            output.apify_accounts = null;
        } else {
            const num = parseInt(apifyVal, 10);
            if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
                output.apify_accounts = existingPartner ? existingPartner.apify_accounts : null; // Fallback
            } else {
                output.apify_accounts = num;
            }
        }
    } else if (existingPartner) {
        output.apify_accounts = existingPartner.apify_accounts;
    } else {
        output.apify_accounts = null;
    }
    // --- END apify_accounts ---

    assignOrKeep('adstera_link', importedRowMappedData.adstera_link);
    assignOrKeep('adstera_email_link', importedRowMappedData.adstera_email_link);

    if (importedRowMappedData.adstera_api_key !== undefined) {
        output.adstera_api_key = importedRowMappedData.adstera_api_key ? String(importedRowMappedData.adstera_api_key).trim() : null;
        if (!existingPartner || output.adstera_api_key !== existingPartner.adstera_api_key) {
            output.api_revenue_usd = null; output.api_revenue_pkr = null; output.last_api_check = null;
        }
    } else if (existingPartner) {
        output.adstera_api_key = existingPartner.adstera_api_key;
    } else {
        output.adstera_api_key = null;
    }

    if (importedRowMappedData.account_creation) output.account_creation = importedRowMappedData.account_creation; // Assuming already ISO
    else if (existingPartner) output.account_creation = existingPartner.account_creation;
    else output.account_creation = null;

    if (importedRowMappedData.account_start) output.account_start = importedRowMappedData.account_start; // Assuming already ISO
    else if (existingPartner) output.account_start = existingPartner.account_start;
    else output.account_start = null;
    
    output.account_status = importedRowMappedData.accountStatus || existingPartner?.account_status || 'active';
    
    let finalMonthlyRevenue: Record<string, MonthlyRevenuePeriodEntry> = {};
    if (existingPartner && existingPartner.monthly_revenue && typeof existingPartner.monthly_revenue === 'object') {
        finalMonthlyRevenue = JSON.parse(JSON.stringify(existingPartner.monthly_revenue));
    }
    if (importedRowMappedData.revenuePeriod && (importedRowMappedData.revenueUSD !== null && importedRowMappedData.revenueUSD !== undefined)) {
        const period = importedRowMappedData.revenuePeriod as string;
        const usd = importedRowMappedData.revenueUSD as number;
        const status = (importedRowMappedData.paymentStatus as string | null) || 'pending';
        finalMonthlyRevenue[period] = { usd, pkr: usd * PKR_RATE, status }; // No 'source' here
    }
    output.monthly_revenue = finalMonthlyRevenue as any;
    
    const apiKeyForSource = output.adstera_api_key === undefined ? existingPartner?.adstera_api_key : output.adstera_api_key;
    let newRevenueSourceFinal: string | null = null;
    if (apiKeyForSource && apiKeyForSource.trim() !== '') {
        newRevenueSourceFinal = 'api_loading';
    } else if (Object.keys(output.monthly_revenue || {}).length > 0) {
        newRevenueSourceFinal = 'manual';
    } else {
        newRevenueSourceFinal = null;
    }
    output.revenue_source = newRevenueSourceFinal;
    
    return output;
}

// --- SVELTEKIT ACTIONS ---
export const actions: Actions = {
    addPartner: async ({ request, locals, fetch }) => {
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
        
        const { data: insertedPartnerData, error: insertError } = await supabase
            .from('partners')
            .insert(partnerDataToInsert)
            .select() // Select all columns of the newly inserted partner
            .single();

        if (insertError) {
            if (insertError.code === '23505') return fail(409, { success: false, message: 'Duplicate entry. Email might be taken.', errors: { email: 'This email already exists for one of your partners.' }, data: Object.fromEntries(formData), action: '?/addPartner' });
            return fail(500, { success: false, message: `DB error: ${insertError.message}`, data: Object.fromEntries(formData), action: '?/addPartner' });
        }

        if (insertedPartnerData && insertedPartnerData.revenue_source === 'api_loading' && insertedPartnerData.adstera_api_key) {
            console.log(`[/dashboard addPartner action] Partner ${insertedPartnerData.id} added with API key. Triggering initial revenue fetch.`);
            fetch('/api/fetch-adsterra-revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId: insertedPartnerData.id })
            }).then(async (res) => {
                if (!res.ok) console.error(`Auto-fetch for new partner ${insertedPartnerData.id} failed with status ${res.status}: ${await res.text()}`);
                else console.log(`Auto-fetch for new partner ${insertedPartnerData.id} initiated.`);
            }).catch(err => console.error("Error initiating auto-fetch for new partner:", err));
        }
        return { success: true, message: 'Partner added successfully!', action: '?/addPartner', newPartner: insertedPartnerData };
    },

    editPartner: async ({ request, locals, url, fetch }) => {
        const partnerIdToEdit = url.searchParams.get('id');
        const currentActionPath = `?/editPartner&id=${partnerIdToEdit || 'unknown'}`;
        console.log(`[/dashboard editPartner action (${currentActionPath})] Received submission.`);

        if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: currentActionPath });}
        const adminId = locals.admin.id;
        if (!partnerIdToEdit) { return fail(400, { success: false, message: 'Partner ID missing.', action: `?/editPartner` });}

        const { data: existingPartner, error: fetchError } = await supabase.from('partners').select('*').eq('id', partnerIdToEdit).eq('admin_id', adminId).single();
        if (fetchError || !existingPartner) { return fail(404, { success: false, message: 'Partner not found or access denied.', action: currentActionPath });}

        const formData = await request.formData();
        const { data: partnerDataToUpdate, errors: validationErrors } = processEditPartnerFormData(formData, existingPartner);

        if (partnerDataToUpdate.email && partnerDataToUpdate.email !== existingPartner.email && !validationErrors.email) {
            try {
                const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToUpdate.email as string).neq('id', partnerIdToEdit);
                if (emailCheckError) throw emailCheckError;
                if (count && count > 0) { validationErrors.email = 'This email address already exists for another partner.'; }
            } catch (e: any) { return fail(500, { success: false, message: `Server error during email check: ${e.message}`, errors: validationErrors, data: Object.fromEntries(formData), action: currentActionPath }); }
        }

        if (Object.keys(validationErrors).length > 0) {
            const formValues: Record<string, any> = {}; formData.forEach((value, key) => formValues[key] = value);
            // Ensure monthly_revenue from existingPartner is used for repopulation if not changed by form,
            // or use the partially processed updatedMonthlyRevenue if that was the source of error.
            // For simplicity, just send back existing and form values. Client form should handle merging.
            const repopulateData = { ...existingPartner, ...formValues };
            return fail(400, { success: false, message: 'Form has errors.', errors: validationErrors, data: repopulateData, action: currentActionPath });
        }

        if (Object.keys(partnerDataToUpdate).length === 0) {
             console.log(`[/dashboard editPartner action (${currentActionPath})] No actual data changes to save.`);
             return { success: true, message: 'No changes detected for partner.', action: currentActionPath, updatedPartner: existingPartner };
        }

        const { data: updatedDbPartner, error: updateError } = await supabase
            .from('partners')
            .update(partnerDataToUpdate)
            .eq('id', partnerIdToEdit)
            .eq('admin_id', adminId)
            .select() // Select all columns of the updated partner
            .single();

        if (updateError) { return fail(500, { success: false, message: `Database error during partner update: ${updateError.message}`, action: currentActionPath });}

        // Check if API fetch should be triggered based on the final state in the DB
        if (updatedDbPartner && updatedDbPartner.revenue_source === 'api_loading' && updatedDbPartner.adstera_api_key) {
            console.log(`[/dashboard editPartner action] Partner ${updatedDbPartner.id} updated. Triggering revenue fetch due to API key/source status.`);
            fetch('/api/fetch-adsterra-revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId: updatedDbPartner.id })
            }).then(async (res) => {
                if (!res.ok) console.error(`Auto-fetch for edited partner ${updatedDbPartner.id} (post-update) failed: ${await res.text()}`);
                else console.log(`Auto-fetch for edited partner ${updatedDbPartner.id} (post-update) initiated.`);
            }).catch(err => console.error("Error initiating auto-fetch for edited partner (post-update):", err));
        }

        return { success: true, message: 'Partner updated successfully!', action: currentActionPath, updatedPartner: updatedDbPartner };
    },

    deletePartner: async ({ request, locals }) => {
        if (!locals.admin || !locals.admin.id) return fail(401, { success: false, message: 'Unauthorized.', action: '?/deletePartner' });
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const partnerId = formData.get('partnerId') as string;
        if (!partnerId) return fail(400, { success: false, message: 'Partner ID required.', action: '?/deletePartner' });
        const { error: delError } = await supabase.from('partners').delete().eq('id', partnerId).eq('admin_id', adminId);
        if (delError) return fail(500, { success: false, message: `DB error: ${delError.message}`, action: '?/deletePartner' });
        return { success: true, message: 'Partner deleted.', action: '?/deletePartner', deletedPartnerId: partnerId };
    },

    toggleAccountStatus: async ({ request, locals }) => {
        if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.' }); }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const partnerId = formData.get('partnerId') as string;
        const currentStatus = formData.get('currentStatus') as string;
        if (!partnerId || !currentStatus) { return fail(400, { success: false, message: 'ID & status required.' }); }
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const { error: updateError } = await supabase.from('partners').update({ account_status: newStatus, updated_at: new Date().toISOString() }).eq('id', partnerId).eq('admin_id', adminId);
        if (updateError) { return fail(500, { success: false, message: `DB error: ${updateError.message}` }); }
        return { type: 'success' as const, status: 200, data: { success: true, message: `Status updated to ${newStatus}.` }}; // SvelteKit expects `type` for success from `enhance`
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
        const importedEmails = partnersToImport.map(p => p.email?.toLowerCase().trim()).filter(Boolean) as string[];
        let existingPartnersMap = new Map<string, PartnerRow>();
        if (importedEmails.length > 0) {
            const { data: dbPartners, error: fetchErr } = await supabase.from('partners').select('*').eq('admin_id', adminId).in('email', importedEmails);
            if (fetchErr) { return fail(500, { success: false, message: `DB error preparing import: ${fetchErr.message}`}); }
            dbPartners?.forEach(p => { if(p.email) existingPartnersMap.set(p.email.toLowerCase().trim(), p); });
        }

        const upsertOperations: Array<PartnerUpdate | PartnerInsert> = [];
        for (const [index, importedRow] of partnersToImport.entries()) {
            const emailKey = importedRow.email?.toLowerCase().trim();
            if (!emailKey) {
                resultsReport.failedRowsInfo.push({ originalIndex: importedRow._originalIndexExcel ?? index, email: importedRow.email, error: "Email missing/invalid." });
                continue;
            }
            const existingPartner = existingPartnersMap.get(emailKey) || null;
            let shapedData = shapeImportedPartnerDataForDb(importedRow, adminId, existingPartner);
            if (existingPartner) { (shapedData as PartnerUpdate).id = existingPartner.id; }
            upsertOperations.push(shapedData as (PartnerUpdate | PartnerInsert));
        }

        if (upsertOperations.length > 0) {
            const { error: batchError, count } = await supabase.from('partners').upsert(upsertOperations, { onConflict: 'admin_id,email' }); // Make sure onConflict matches your unique constraint
            if (batchError) {
                console.error("Supabase batch upsert error for import:", batchError);
                return fail(500, { success: false, message: `Import DB error: ${batchError.message}. Some rows may have failed.`, data: { errorsByRow: [{ error: batchError.message, email:"Batch Operation" }] } });
            }
            resultsReport.successfulUpserts = count ?? 0; // If count is null, means 0 successful from this batch.
        }
        
        if (resultsReport.failedRowsInfo.length > 0) {
            return fail(400, { success: false, message: `Import completed with issues: ${resultsReport.successfulUpserts} successful, ${resultsReport.failedRowsInfo.length} pre-DB failures.`, data: { successfulUpserts: resultsReport.successfulUpserts, errorsByRow: resultsReport.failedRowsInfo } });
        }
        return { type: 'success' as const, status: 200, data: { success: true, message: `Successfully imported/updated ${resultsReport.successfulUpserts} partner(s).`, successfulUpserts: resultsReport.successfulUpserts } };
    },
    
    refreshAllApiRevenue: async ({ locals, fetch }) => {
        console.log('[/dashboard refreshAllApiRevenue action] Request received.');
        if (!locals.admin || !locals.admin.id) {
            return fail(401, { success: false, message: 'Unauthorized.', action: '?/refreshAllApiRevenue' });
        }
        const adminId = locals.admin.id;

        const { data: partnersWithKeys, error: fetchPartnersError } = await supabase
            .from('partners')
            .select('id, name, adstera_api_key')
            .eq('admin_id', adminId)
            .not('adstera_api_key', 'is', null)
            .neq('adstera_api_key', '');

        if (fetchPartnersError) {
            console.error('[/dashboard refreshAllApiRevenue action] Error fetching partners with API keys:', fetchPartnersError);
            return fail(500, { success: false, message: 'Database error fetching partners.', action: '?/refreshAllApiRevenue' });
        }

        if (!partnersWithKeys || partnersWithKeys.length === 0) {
            return { success: true, message: 'No partners found with API keys configured to refresh.', action: '?/refreshAllApiRevenue' };
        }

        console.log(`[/dashboard refreshAllApiRevenue action] Found ${partnersWithKeys.length} partners with API keys. Initiating fetches...`);
        let initiatedCount = 0;
        partnersWithKeys.forEach(partner => {
            if (partner.id && partner.adstera_api_key) {
                initiatedCount++;
                fetch('/api/fetch-adsterra-revenue', {
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

        return {
            success: true,
            message: `API revenue refresh process initiated for ${initiatedCount} partner(s). Table will update as data arrives.`,
            action: '?/refreshAllApiRevenue'
        };
    }
};