// src/routes/(app)/dashboard/+page.server.ts
console.log('--- ✅✅✅ DASHBOARD +page.server.ts IS BEING PROCESSED (Import Logic Final) ✅✅✅ ---');

import { supabase } from '$lib/supabaseClient';
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions, ActionResult } from './$types';
import type { Database } from '../../../types/supabase';
import { PKR_RATE } from '$lib/utils/revenue';

// --- TYPE DEFINITIONS ---
type PartnerRow = Database['public']['Tables']['partners']['Row'];
type PartnerInsert = Database['public']['Tables']['partners']['Insert'];
type PartnerUpdate = Database['public']['Tables']['partners']['Update'];
type MonthlyRevenuePeriodEntry = { usd?: number | null; pkr?: number | null; status?: string | null; };

// --- LOAD FUNCTION (Assumed correct from previous steps) ---
export const load: PageServerLoad = async ({ locals, parent }) => {
    const { admin } = await parent();
    if (!admin || !admin.id) { throw error(401, 'Unauthorized: Admin context not found.'); }
    const { data: partners, error: dbError } = await supabase.from('partners').select('*').eq('admin_id', admin.id).order('created_at', { ascending: false });
    if (dbError) { throw error(500, `DB error fetching partners: ${dbError.message}`); }
    return { partners: partners || [] };
};

// --- HELPER: Process NEW Partner Form Data (Assumed correct) ---
function processNewPartnerFormData(formData: FormData, adminId: string): { data: PartnerInsert, errors: Record<string, string> } {
    const errors: Record<string, string> = {}; const data: Partial<PartnerInsert> = { admin_id: adminId };
    data.name = (formData.get('name') as string)?.trim() || ''; if (!data.name) errors.name = 'Name is required.';
    data.mobile = (formData.get('mobile') as string)?.trim() || ''; if (!data.mobile) errors.mobile = 'Mobile is required.';
    data.email = (formData.get('email') as string)?.trim() || '';
    if (!data.email) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email format.';
    data.address = (formData.get('address') as string)?.trim() || null; data.webmoney = (formData.get('webmoney') as string)?.trim() || null; data.multi_account_no = (formData.get('multi_account_no') as string)?.trim() || null; data.adstera_link = (formData.get('adstera_link') as string)?.trim() || null; data.adstera_email_link = (formData.get('adstera_email_link') as string)?.trim() || null; data.adstera_api_key = (formData.get('adstera_api_key') as string)?.trim() || null;
    const accountCreationStr = formData.get('account_creation') as string; if (accountCreationStr && accountCreationStr.trim() !== '') { try { data.account_creation = new Date(accountCreationStr).toISOString(); } catch (e) { errors.account_creation = "Invalid creation date."; } } else { data.account_creation = null; }
    const accountStartStr = formData.get('account_start') as string; if (accountStartStr && accountStartStr.trim() !== '') { try { data.account_start = new Date(accountStartStr).toISOString(); } catch (e) { errors.account_start = "Invalid start date."; } } else { data.account_start = null; }
    data.account_status = 'active'; const revenuePeriod = (formData.get('revenuePeriod') as string | null)?.trim(); const revenueRateUSDStr = (formData.get('revenueRateUSD') as string | null); const paymentStatus = (formData.get('paymentStatus') as string | null) || 'pending'; let revenueRateUSD: number | null = null;
    if (revenueRateUSDStr !== null && revenueRateUSDStr.trim() !== '') { const parsedRate = parseFloat(revenueRateUSDStr); if (isNaN(parsedRate) || parsedRate < 0) { errors.revenueRateUSD = 'RevUSD must be valid & non-negative.'; } else { revenueRateUSD = parsedRate; } }
    if (revenueRateUSD !== null && !revenuePeriod) { errors.revenuePeriod = 'Period required if rate entered.'; } if (revenuePeriod && !/^\d{4}-\d{2}$/.test(revenuePeriod)) { errors.revenuePeriod = 'Period must be YYYY-MM.'; }
    if (revenuePeriod && revenueRateUSD !== null && !errors.revenueRateUSD && !errors.revenuePeriod) { data.monthly_revenue = { [revenuePeriod]: { usd: revenueRateUSD, pkr: revenueRateUSD * PKR_RATE, status: paymentStatus } } as any; } else { data.monthly_revenue = {} as any; }
    if (data.adstera_api_key) { data.revenue_source = 'api_loading'; data.api_revenue_usd = null; data.api_revenue_pkr = null; data.last_api_check = null; } else if (data.monthly_revenue && Object.keys(data.monthly_revenue).length > 0) { data.revenue_source = 'manual'; } else { data.revenue_source = null; }
    return { data: data as PartnerInsert, errors };
}
// --- HELPER: Process EDIT Partner Form Data (Assumed correct) ---
function processEditPartnerFormData(formData: FormData, existingPartnerData: PartnerRow, adminId: string): { data: PartnerUpdate, errors: Record<string, string> } {
    const errors: Record<string, string> = {}; const dataToUpdate: PartnerUpdate = {};
    dataToUpdate.name = (formData.get('name') as string)?.trim() || ''; if (!dataToUpdate.name) errors.name = 'Name required.';
    dataToUpdate.mobile = (formData.get('mobile') as string)?.trim() || ''; if (!dataToUpdate.mobile) errors.mobile = 'Mobile required.';
    dataToUpdate.email = (formData.get('email') as string)?.trim() || ''; if (!dataToUpdate.email) errors.email = 'Email required.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dataToUpdate.email)) errors.email = 'Invalid email.';
    dataToUpdate.address = (formData.get('address') as string)?.trim() || null; dataToUpdate.webmoney = (formData.get('webmoney') as string)?.trim() || null; dataToUpdate.multi_account_no = (formData.get('multi_account_no') as string)?.trim() || null; dataToUpdate.adstera_link = (formData.get('adstera_link') as string)?.trim() || null; dataToUpdate.adstera_email_link = (formData.get('adstera_email_link') as string)?.trim() || null;
    const newApiKey = (formData.get('adstera_api_key') as string)?.trim() || null; if (newApiKey !== existingPartnerData.adstera_api_key) { dataToUpdate.adstera_api_key = newApiKey; dataToUpdate.api_revenue_usd = null; dataToUpdate.api_revenue_pkr = null; dataToUpdate.last_api_check = null; }
    const accCreateStr = formData.get('account_creation') as string; if (accCreateStr && accCreateStr.trim()!=='') { try {dataToUpdate.account_creation = new Date(accCreateStr).toISOString();} catch(e){errors.account_creation="Invalid date.";} } else dataToUpdate.account_creation = null;
    const accStartStr = formData.get('account_start') as string; if (accStartStr && accStartStr.trim()!=='') { try {dataToUpdate.account_start = new Date(accStartStr).toISOString();} catch(e){errors.account_start="Invalid date.";} } else dataToUpdate.account_start = null;
    const monthlyRevenue = JSON.parse(JSON.stringify(existingPartnerData.monthly_revenue || {})); const formRevenuePeriod = (formData.get('revenuePeriod') as string | null)?.trim(); const formRevenueRateUSDStr = formData.get('revenueRateUSD') as string | null; const formPaymentStatus = (formData.get('paymentStatus') as string | null) || 'pending'; let formRevenueRateUSD: number | null | undefined = undefined;
    if (formRevenueRateUSDStr !== null && formRevenueRateUSDStr.trim() !== '') { const parsedRate = parseFloat(formRevenueRateUSDStr); if (isNaN(parsedRate) || parsedRate < 0) { errors.revenueRateUSD = 'RevUSD must be valid.'; } else { formRevenueRateUSD = parsedRate; } } else if (formRevenueRateUSDStr === '') { formRevenueRateUSD = null; }
    if (formRevenueRateUSD !== undefined && !formRevenuePeriod) { errors.revenuePeriod = 'Period required.'; } if (formRevenuePeriod && !/^\d{4}-\d{2}$/.test(formRevenuePeriod)) { errors.revenuePeriod = 'Period YYYY-MM.'; }
    if (formRevenuePeriod && !errors.revenuePeriod && !errors.revenueRateUSD) { if (formRevenueRateUSD !== undefined && formRevenueRateUSD !== null) { monthlyRevenue[formRevenuePeriod] = { usd: formRevenueRateUSD, pkr: formRevenueRateUSD * PKR_RATE, status: formPaymentStatus }; } else if (formRevenueRateUSD === null && monthlyRevenue.hasOwnProperty(formRevenuePeriod)) { delete monthlyRevenue[formRevenuePeriod]; } } dataToUpdate.monthly_revenue = monthlyRevenue as any;
    const finalApiKey = dataToUpdate.adstera_api_key === undefined ? existingPartnerData.adstera_api_key : dataToUpdate.adstera_api_key; const finalMonthlyRev = dataToUpdate.monthly_revenue;
    if (finalApiKey) { const apiKeyChanged = dataToUpdate.adstera_api_key !== undefined && dataToUpdate.adstera_api_key !== existingPartnerData.adstera_api_key; if (apiKeyChanged) { dataToUpdate.revenue_source = 'api_loading'; } else { dataToUpdate.revenue_source = existingPartnerData.revenue_source; } } else { dataToUpdate.revenue_source = Object.keys(finalMonthlyRev || {}).length > 0 ? 'manual' : null; } if (dataToUpdate.adstera_api_key === null && existingPartnerData.adstera_api_key && existingPartnerData.revenue_source?.startsWith('api')){ dataToUpdate.revenue_source = Object.keys(finalMonthlyRev || {}).length > 0 ? 'manual' : null; }
    return { data: dataToUpdate, errors };
}
// --- HELPER: Shape IMPORTED Partner Data for DB Upsert (CORRECTED AND COMPLETE) ---
function shapeImportedPartnerDataForDb(
    importedRowMappedData: Record<string, any>,
    adminId: string,
    existingPartner: PartnerRow | null
): Partial<PartnerInsert | PartnerUpdate> {
    const output: Partial<PartnerInsert | PartnerUpdate> = {
        admin_id: adminId // Always set for upsert context with onConflict admin_id
    };

    // Handle potentially null/undefined values from import correctly
    const getName = importedRowMappedData.name ? String(importedRowMappedData.name).trim() : '';
    const getEmail = importedRowMappedData.email ? String(importedRowMappedData.email).toLowerCase().trim() : '';
    const getMobile = importedRowMappedData.mobile ? String(importedRowMappedData.mobile).trim() : '';

    output.name = getName || (existingPartner ? existingPartner.name : null);
    output.email = getEmail || (existingPartner ? existingPartner.email : null);
    output.mobile = getMobile || (existingPartner ? existingPartner.mobile : null);

    const assignOrKeep = (key: keyof (PartnerInsert | PartnerUpdate), importedVal: any) => {
      if (importedVal !== undefined) { (output as any)[key] = importedVal === '' ? null : (typeof importedVal === 'string' ? importedVal.trim() : importedVal); }
      else if (existingPartner && (existingPartner as any)[key] !== undefined) { (output as any)[key] = (existingPartner as any)[key]; }
      else if (!existingPartner) { (output as any)[key] = null; }
    };
    
    assignOrKeep('address', importedRowMappedData.address);
    assignOrKeep('webmoney', importedRowMappedData.webmoney);
    assignOrKeep('multi_account_no', importedRowMappedData.multi_account_no);
    assignOrKeep('adstera_link', importedRowMappedData.adstera_link);
    assignOrKeep('adstera_email_link', importedRowMappedData.adstera_email_link);
    
    if (importedRowMappedData.adstera_api_key !== undefined) {
        output.adstera_api_key = importedRowMappedData.adstera_api_key ? String(importedRowMappedData.adstera_api_key).trim() : null;
        if (!existingPartner || output.adstera_api_key !== existingPartner.adstera_api_key) {
            output.api_revenue_usd = null; output.api_revenue_pkr = null; output.last_api_check = null;
        }
    } else if (existingPartner) { output.adstera_api_key = existingPartner.adstera_api_key; }
    else { output.adstera_api_key = null; }

    if (importedRowMappedData.account_creation) output.account_creation = importedRowMappedData.account_creation; // Assumes already ISO string
    else if (existingPartner) output.account_creation = existingPartner.account_creation; else output.account_creation = null;

    if (importedRowMappedData.account_start) output.account_start = importedRowMappedData.account_start; // Assumes already ISO string
    else if (existingPartner) output.account_start = existingPartner.account_start; else output.account_start = null;
    
    output.account_status = importedRowMappedData.accountStatus || existingPartner?.account_status || 'active';

    let finalMonthlyRevenue: Record<string, MonthlyRevenuePeriodEntry> = {};
    if (existingPartner && existingPartner.monthly_revenue && typeof existingPartner.monthly_revenue === 'object') {
        finalMonthlyRevenue = JSON.parse(JSON.stringify(existingPartner.monthly_revenue));
    }

    if (importedRowMappedData.revenuePeriod && (importedRowMappedData.revenueUSD !== null && importedRowMappedData.revenueUSD !== undefined)) {
        const period = importedRowMappedData.revenuePeriod as string;
        const usd = importedRowMappedData.revenueUSD as number;
        const status = (importedRowMappedData.paymentStatus as string | null) || 'pending';
        finalMonthlyRevenue[period] = { usd, pkr: usd * PKR_RATE, status };
    }
    output.monthly_revenue = finalMonthlyRevenue as any;

    const apiKeyForSource = output.adstera_api_key === undefined ? existingPartner?.adstera_api_key : output.adstera_api_key;
    if (apiKeyForSource) {
        const apiKeyChanged = importedRowMappedData.adstera_api_key !== undefined && importedRowMappedData.adstera_api_key !== existingPartner?.adstera_api_key;
        if (apiKeyChanged || (existingPartner && existingPartner.revenue_source !== 'api' && existingPartner.revenue_source !== 'api_error' && existingPartner.revenue_source !== 'api_loading')) {
            output.revenue_source = 'api_loading';
        } else if (existingPartner) { output.revenue_source = existingPartner.revenue_source; }
        else { output.revenue_source = 'api_loading'; }
    } else if (Object.keys(output.monthly_revenue || {}).length > 0) {
        output.revenue_source = 'manual';
    } else {
        output.revenue_source = null;
    }
    
    return output;
}

// --- SVELTEKIT ACTIONS (addPartner, deletePartner, editPartner, toggleAccountStatus, and importPartners) ---
export const actions: Actions = {
    addPartner: async ({ request, locals }) => { if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: '?/addPartner' }); } const adminId = locals.admin.id; const formData = await request.formData(); const { data: partnerDataToInsert, errors: validationErrors } = processNewPartnerFormData(formData, adminId); if (partnerDataToInsert.email && !validationErrors.email) { try { const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToInsert.email); if (emailCheckError) throw emailCheckError; if (count && count > 0) validationErrors.email = 'This email already exists for your partners.'; } catch (e: any) { return fail(500, { success: false, message: `Server error: ${e.message}`, errors: validationErrors, data: Object.fromEntries(formData), action: '?/addPartner' }); } } if (Object.keys(validationErrors).length > 0) { return fail(400, { success: false, message: 'Form has errors.', errors: validationErrors, data: Object.fromEntries(formData), action: '?/addPartner' }); } const { error: insertError } = await supabase.from('partners').insert(partnerDataToInsert); if (insertError) { if (insertError.code === '23505') return fail(409, { success: false, message: 'Duplicate entry.', errors: { email: 'Email might be duplicate.' }, data: Object.fromEntries(formData), action: '?/addPartner' }); return fail(500, { success: false, message: `DB error: ${insertError.message}`, data: Object.fromEntries(formData), action: '?/addPartner' }); } return { success: true, message: 'Partner added successfully!', action: '?/addPartner' }; },
    deletePartner: async ({ request, locals }) => { if (!locals.admin || !locals.admin.id) return fail(401, { success: false, message: 'Unauthorized.', action: '?/deletePartner' }); const adminId = locals.admin.id; const formData = await request.formData(); const partnerId = formData.get('partnerId') as string; if (!partnerId) return fail(400, { success: false, message: 'Partner ID required.', action: '?/deletePartner' }); const { error: deleteError } = await supabase.from('partners').delete().eq('id', partnerId).eq('admin_id', adminId); if (deleteError) return fail(500, { success: false, message: `DB error: ${deleteError.message}`, action: '?/deletePartner' }); return { success: true, message: 'Partner deleted.', action: '?/deletePartner' }; },
    editPartner: async ({ request, locals, url }) => { const partnerIdToEdit = url.searchParams.get('id'); const currentActionPath = `?/editPartner&id=${partnerIdToEdit || 'unknown'}`; if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: currentActionPath }); } const adminId = locals.admin.id; if (!partnerIdToEdit) { return fail(400, { success: false, message: 'Partner ID missing.', action: '?/editPartner' }); } const { data: existingPartner, error: fetchError } = await supabase.from('partners').select('*').eq('id', partnerIdToEdit).eq('admin_id', adminId).single(); if (fetchError || !existingPartner) { return fail(404, { success: false, message: 'Partner not found.', action: currentActionPath }); } const formData = await request.formData(); const { data: partnerDataToUpdate, errors: validationErrors } = processEditPartnerFormData(formData, existingPartner, adminId); if (partnerDataToUpdate.email && partnerDataToUpdate.email !== existingPartner.email && !validationErrors.email) { try { const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToUpdate.email).neq('id', partnerIdToEdit); if (emailCheckError) throw emailCheckError; if (count && count > 0) { validationErrors.email = 'Email exists for another partner.'; } } catch (e: any) { return fail(500, { success: false, message: `Server error: ${e.message}`, errors: validationErrors, data: Object.fromEntries(formData), action: currentActionPath }); } } if (Object.keys(validationErrors).length > 0) { const repopData = { ...Object.fromEntries(formData), ...existingPartner, ...validationErrors.data}; return fail(400, { success: false, message: 'Form has errors.', errors: validationErrors, data: repopData, action: currentActionPath }); } const { error: updateError } = await supabase.from('partners').update(partnerDataToUpdate).eq('id', partnerIdToEdit).eq('admin_id', adminId); if (updateError) { return fail(500, { success: false, message: `DB error: ${updateError.message}`, action: currentActionPath }); } return { success: true, message: 'Partner updated.', action: currentActionPath }; },
    toggleAccountStatus: async ({ request, locals }) => { if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.' }); } const adminId = locals.admin.id; const formData = await request.formData(); const partnerId = formData.get('partnerId') as string; const currentStatus = formData.get('currentStatus') as string; if (!partnerId || !currentStatus) { return fail(400, { success: false, message: 'ID & status required.' }); } const newStatus = currentStatus === 'active' ? 'suspended' : 'active'; const { error: updateError } = await supabase.from('partners').update({ account_status: newStatus, updated_at: new Date().toISOString() }).eq('id', partnerId).eq('admin_id', adminId); if (updateError) { return fail(500, { success: false, message: `DB error: ${updateError.message}` }); } return { type: 'success', status: 200, data: { success: true, message: `Status updated to ${newStatus}.` }}; },

    importPartners: async ({ request, locals }): Promise<ActionResult> => { // Explicit ActionResult for clarity
        console.log('[/dashboard importPartners action] Import request received.');
        if (!locals.admin || !locals.admin.id) {
            return fail(401, { success: false, message: 'Unauthorized for import.' });
        }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const partnersToImportJson = formData.get('partnersToImportJson') as string;

        if (!partnersToImportJson) {
            return fail(400, { success: false, message: 'No import data received.' });
        }

        let partnersToImport: Array<Record<string, any>>;
        try {
            partnersToImport = JSON.parse(partnersToImportJson);
            if (!Array.isArray(partnersToImport) || partnersToImport.length === 0) { throw new Error("Data not array or empty."); }
        } catch (e: any) {
            return fail(400, { success: false, message: `Invalid import data: ${e.message}` });
        }

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
            console.log(`Upserting ${upsertOperations.length} partners.`);
            const { error: batchError, count } = await supabase.from('partners').upsert(upsertOperations, { onConflict: 'admin_id,email' });
            if (batchError) {
                console.error("Supabase batch upsert error:", batchError);
                return fail(500, { success: false, message: `Import DB error: ${batchError.message}.`, errorsByRow: [{ error: batchError.message }] }); // Note: errorsByRow structure used by client
            }
            resultsReport.successfulUpserts = count ?? upsertOperations.length;
        }

        if (resultsReport.failedRowsInfo.length > 0) {
            return fail(400, { // Data for fail is what `form.data` will be on client
                success: false, // App-level success flag within the `data`
                message: `Import processed. ${resultsReport.successfulUpserts} upserted successfully. ${resultsReport.failedRowsInfo.length} had pre-DB errors.`,
                successfulUpserts: resultsReport.successfulUpserts,
                errorsByRow: resultsReport.failedRowsInfo
            });
        }
        
        // If we reach here, ALL rows prepared for upsert were processed by DB without throwing a batchError.
        // And there were no pre-DB failures that stopped us from having any upsertOperations.
        console.log("Import action completed, returning success structure.");
        return { // THIS IS THE STRUCTURE FOR A SUCCESSFUL ACTION, FOR deserialize.
            type: 'success',
            status: 200, // HTTP status
            data: { // This specific object is what `result.data` will be on the client
                success: true, // Your application-specific success flag
                message: `Successfully imported/updated ${resultsReport.successfulUpserts} partner(s).`,
                successfulUpserts: resultsReport.successfulUpserts
            }
        };
    }
};