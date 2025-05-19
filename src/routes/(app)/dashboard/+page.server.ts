// src/routes/(app)/dashboard/+page.server.ts

// --- CONSOLE LOG AT THE VERY TOP TO CONFIRM FILE PROCESSING ---
console.log('--- ✅✅✅ DASHBOARD +page.server.ts IS BEING PROCESSED BY SVELTEKIT ✅✅✅ ---');

import { supabase } from '$lib/supabaseClient';
import { error, fail, redirect } from '@sveltejs/kit'; // redirect might be used in other actions
import type { PageServerLoad, Actions } from './$types';
import type { Database } from '../../../types/supabase'; // Adjust path if needed
import { PKR_RATE } from '$lib/utils/revenue';

type PartnerRow = Database['public']['Tables']['partners']['Row'];
type PartnerInsert = Database['public']['Tables']['partners']['Insert'];
type PartnerUpdate = Database['public']['Tables']['partners']['Update'];
type MonthlyRevenuePeriodEntry = {
    usd?: number | null;
    pkr?: number | null;
    status?: string | null;
};

// --- LOAD FUNCTION (Should be existing and correct) ---
export const load: PageServerLoad = async ({ locals, parent }) => {
    console.log('[/dashboard/+page.server.ts] Load function running...');
    const { admin } = await parent();
    if (!admin || !admin.id) {
        throw error(401, 'Unauthorized: Admin context not found for dashboard.');
    }
    const { data: partners, error: dbError } = await supabase
        .from('partners')
        .select('*')
        .eq('admin_id', admin.id)
        .order('created_at', { ascending: false });
    if (dbError) {
        console.error('[/dashboard/+page.server.ts] Supabase error fetching partners:', dbError);
        throw error(500, `Database error fetching partners: ${dbError.message}`);
    }
    return { partners: partners || [] };
};

// --- HELPER FUNCTIONS (processNewPartnerFormData, processEditPartnerFormData - assumed existing and correct) ---
function processNewPartnerFormData(formData: FormData, adminId: string): { data: PartnerInsert, errors: Record<string, string> } {
    // ... (Full code for this function from previous steps) ...
    // Ensure it's complete and has no syntax errors. For brevity, I'm not re-pasting it here
    // but it must be present and correct.
    const errors: Record<string, string> = {}; const data: Partial<PartnerInsert> = {}; data.admin_id = adminId; const name = formData.get('name') as string | null; if (!name || name.trim() === '') errors.name = 'Name is required.'; else data.name = name.trim(); const mobile = formData.get('mobile') as string | null; if (!mobile || mobile.trim() === '') errors.mobile = 'Mobile is required.'; else data.mobile = mobile.trim(); const email = formData.get('email') as string | null; if (!email || email.trim() === '') { errors.email = 'Email is required.'; } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { errors.email = 'Invalid email format.'; } else { data.email = email.trim(); } data.address = (formData.get('address') as string)?.trim() || null; data.webmoney = (formData.get('webmoney') as string)?.trim() || null; data.multi_account_no = (formData.get('multi_account_no') as string)?.trim() || null; data.adstera_link = (formData.get('adstera_link') as string)?.trim() || null; data.adstera_email_link = (formData.get('adstera_email_link') as string)?.trim() || null; data.adstera_api_key = (formData.get('adstera_api_key') as string)?.trim() || null; const accountCreationStr = formData.get('account_creation') as string; if (accountCreationStr) { try { data.account_creation = new Date(accountCreationStr).toISOString(); } catch (e) { errors.account_creation = "Invalid creation date."; } } else { data.account_creation = null; } const accountStartStr = formData.get('account_start') as string; if (accountStartStr) { try { data.account_start = new Date(accountStartStr).toISOString(); } catch (e) { errors.account_start = "Invalid start date."; } } else { data.account_start = null; } data.account_status = 'active'; const revenuePeriod = (formData.get('revenuePeriod') as string | null)?.trim(); const revenueRateUSDStr = (formData.get('revenueRateUSD') as string | null); const paymentStatus = (formData.get('paymentStatus') as string | null) || 'pending'; let revenueRateUSD: number | null = null; if (revenueRateUSDStr && revenueRateUSDStr.trim() !== '') { const parsedRate = parseFloat(revenueRateUSDStr); if (isNaN(parsedRate) || parsedRate < 0) { errors.revenueRateUSD = 'Revenue (USD) must be valid & non-negative.'; } else { revenueRateUSD = parsedRate; } } if (revenueRateUSD !== null && (!revenuePeriod || revenuePeriod.trim() === '')) { errors.revenuePeriod = 'Period required if rate entered.'; } if (revenuePeriod && !/^\d{4}-\d{2}$/.test(revenuePeriod)) { errors.revenuePeriod = 'Period must be YYYY-MM.'; } if (revenuePeriod && revenueRateUSD !== null && !errors.revenueRateUSD && !errors.revenuePeriod) { const monthlyEntry: MonthlyRevenuePeriodEntry = { usd: revenueRateUSD, pkr: revenueRateUSD * PKR_RATE, status: paymentStatus }; data.monthly_revenue = { [revenuePeriod]: monthlyEntry } as any; } else { data.monthly_revenue = {} as any; } if (data.adstera_api_key) { data.revenue_source = 'api_loading'; data.api_revenue_usd = null; data.api_revenue_pkr = null; data.last_api_check = null; } else if (data.monthly_revenue && Object.keys(data.monthly_revenue).length > 0) { data.revenue_source = 'manual'; } else { data.revenue_source = null; } return { data: data as PartnerInsert, errors };
}

function processEditPartnerFormData(formData: FormData, existingPartnerData: PartnerRow, adminId: string): { data: PartnerUpdate, errors: Record<string, string> } {
    // ... (Full code for this function from previous steps) ...
    // Ensure it's complete and has no syntax errors. For brevity, not re-pasting.
     const errors: Record<string, string> = {}; const dataToUpdate: PartnerUpdate = {}; const name = formData.get('name') as string | null; if (!name || name.trim() === '') errors.name = 'Name is required.'; else dataToUpdate.name = name.trim(); const mobile = formData.get('mobile') as string | null; if (!mobile || mobile.trim() === '') errors.mobile = 'Mobile is required.'; else dataToUpdate.mobile = mobile.trim(); const email = formData.get('email') as string | null; if (!email || email.trim() === '') { errors.email = 'Email is required.'; } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { errors.email = 'Invalid email format.'; } else { dataToUpdate.email = email.trim(); } dataToUpdate.address = (formData.get('address') as string)?.trim() || null; dataToUpdate.webmoney = (formData.get('webmoney') as string)?.trim() || null; dataToUpdate.multi_account_no = (formData.get('multi_account_no') as string)?.trim() || null; dataToUpdate.adstera_link = (formData.get('adstera_link') as string)?.trim() || null; dataToUpdate.adstera_email_link = (formData.get('adstera_email_link') as string)?.trim() || null; const newApiKey = (formData.get('adstera_api_key') as string)?.trim() || null; if (newApiKey !== existingPartnerData.adstera_api_key) { dataToUpdate.adstera_api_key = newApiKey; dataToUpdate.api_revenue_usd = null; dataToUpdate.api_revenue_pkr = null; dataToUpdate.last_api_check = null; } const accountCreationStr = formData.get('account_creation') as string; if (accountCreationStr) { try { dataToUpdate.account_creation = new Date(accountCreationStr).toISOString(); } catch (e) { errors.account_creation = "Invalid creation date."; } } else dataToUpdate.account_creation = null; const accountStartStr = formData.get('account_start') as string; if (accountStartStr) { try { dataToUpdate.account_start = new Date(accountStartStr).toISOString(); } catch (e) { errors.account_start = "Invalid start date."; } } else dataToUpdate.account_start = null; const updatedMonthlyRevenue: Record<string, MonthlyRevenuePeriodEntry> = JSON.parse(JSON.stringify(existingPartnerData.monthly_revenue || {})); const formRevenuePeriod = (formData.get('revenuePeriod') as string | null)?.trim(); const formRevenueRateUSDStr = formData.get('revenueRateUSD') as string | null; const formPaymentStatus = (formData.get('paymentStatus') as string | null) || 'pending'; let formRevenueRateUSD: number | null | undefined = undefined; if (formRevenueRateUSDStr !== null && formRevenueRateUSDStr.trim() !== '') { const parsedRate = parseFloat(formRevenueRateUSDStr); if (isNaN(parsedRate) || parsedRate < 0) { errors.revenueRateUSD = 'Revenue (USD) must be a valid non-negative number.'; } else { formRevenueRateUSD = parsedRate; } } else if (formRevenueRateUSDStr === '') { formRevenueRateUSD = null; } if (formRevenueRateUSD !== undefined && (!formRevenuePeriod || formRevenuePeriod.trim() === '')) { errors.revenuePeriod = 'Revenue period (YYYY-MM) is required to add/update revenue amount.'; } if (formRevenuePeriod && !/^\d{4}-\d{2}$/.test(formRevenuePeriod)) { errors.revenuePeriod = 'Revenue period must be in YYYY-MM format.'; } if (formRevenuePeriod && !errors.revenuePeriod && !errors.revenueRateUSD) { if (formRevenueRateUSD !== undefined && formRevenueRateUSD !== null) { const monthlyEntry: MonthlyRevenuePeriodEntry = { usd: formRevenueRateUSD, pkr: formRevenueRateUSD * PKR_RATE, status: formPaymentStatus }; updatedMonthlyRevenue[formRevenuePeriod] = monthlyEntry; } else if (formRevenueRateUSD === null && updatedMonthlyRevenue.hasOwnProperty(formRevenuePeriod)) { delete updatedMonthlyRevenue[formRevenuePeriod]; } } dataToUpdate.monthly_revenue = updatedMonthlyRevenue as any; const finalApiKey = dataToUpdate.adstera_api_key === undefined ? existingPartnerData.adstera_api_key : dataToUpdate.adstera_api_key; const finalMonthlyRevenue = dataToUpdate.monthly_revenue; if (finalApiKey) { dataToUpdate.revenue_source = (dataToUpdate.adstera_api_key !== undefined && dataToUpdate.adstera_api_key !== existingPartnerData.adstera_api_key) ? (finalApiKey ? 'api_loading' : null) : existingPartnerData.revenue_source; if (!finalApiKey && dataToUpdate.revenue_source?.startsWith('api')) { dataToUpdate.revenue_source = Object.keys(finalMonthlyRevenue || {}).length > 0 ? 'manual' : null; } } else if (Object.keys(finalMonthlyRevenue || {}).length > 0) { dataToUpdate.revenue_source = 'manual'; } else { dataToUpdate.revenue_source = null; } return { data: dataToUpdate, errors };
}

// --- SVELTEKIT ACTIONS ---
export const actions: Actions = {
    addPartner: async ({ request, locals }) => {
        // ... (Full code from previous steps - ensure no syntax errors)
         console.log('[/dashboard addPartner action] Received form submission.'); if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: '?/addPartner' }); } const adminId = locals.admin.id; const formData = await request.formData(); const { data: partnerDataToInsert, errors: validationErrors } = processNewPartnerFormData(formData, adminId); if (partnerDataToInsert.email && !validationErrors.email) { try { const { count, error: emailCheckError } = await supabase.from('partners').select('id', { count: 'exact', head: true }).eq('admin_id', adminId).eq('email', partnerDataToInsert.email); if (emailCheckError) throw emailCheckError; if (count && count > 0) validationErrors.email = 'This email already exists for your partners.'; } catch (e: any) { console.error('Email check error:', e); return fail(500, { success: false, message: `Server error: ${e.message}`, errors: validationErrors, action: '?/addPartner' }); } } if (Object.keys(validationErrors).length > 0) { const formValues: Record<string, any> = {}; formData.forEach((value, key) => formValues[key] = value); return fail(400, { success: false, message: 'Form has errors.', errors: validationErrors, data: formValues, action: '?/addPartner' }); } const { error: insertError } = await supabase.from('partners').insert(partnerDataToInsert); if (insertError) { if (insertError.code === '23505') return fail(409, { success: false, message: 'Duplicate entry.', errors: { email: 'Email might be duplicate.' }, action: '?/addPartner' }); return fail(500, { success: false, message: `DB error: ${insertError.message}`, action: '?/addPartner' }); } return { success: true, message: 'Partner added successfully!', action: '?/addPartner' };
    },

    deletePartner: async ({ request, locals }) => {
        // ... (Full code from previous steps - ensure no syntax errors)
        console.log('[/dashboard deletePartner action] Received delete request.'); if (!locals.admin || !locals.admin.id) return fail(401, { success: false, message: 'Unauthorized.', action: '?/deletePartner' }); const adminId = locals.admin.id; const formData = await request.formData(); const partnerId = formData.get('partnerId') as string; if (!partnerId) return fail(400, { success: false, message: 'Partner ID required.', action: '?/deletePartner' }); const { error: deleteError } = await supabase.from('partners').delete().eq('id', partnerId).eq('admin_id', adminId); if (deleteError) return fail(500, { success: false, message: `DB error: ${deleteError.message}`, action: '?/deletePartner' }); return { success: true, message: 'Partner deleted.', action: '?/deletePartner' };
    },

    editPartner: async ({ request, locals, url }) => {
        // ... (Full code from previous steps - ensure no syntax errors)
        console.log('[/dashboard editPartner action] Received editPartner submission.'); const currentActionPath = `?/editPartner&id=${url.searchParams.get('id')}`; if (!locals.admin || !locals.admin.id) { return fail(401, { success: false, message: 'Unauthorized.', errors: { general: 'Auth' }, action: currentActionPath }); } const adminId = locals.admin.id; const partnerIdToEdit = url.searchParams.get('id'); if (!partnerIdToEdit) { return fail(400, { success: false, message: 'Partner ID missing from request.', action: '?/editPartner' }); } const { data: existingPartner, error: fetchError } = await supabase .from('partners') .select('*') .eq('id', partnerIdToEdit) .eq('admin_id', adminId) .single(); if (fetchError || !existingPartner) { console.error('[/dashboard editPartner action] Error fetching existing partner or not found/owned:', fetchError); return fail(404, { success: false, message: 'Partner not found or access denied.', action: currentActionPath }); } const formData = await request.formData(); const { data: partnerDataToUpdate, errors: validationErrors } = processEditPartnerFormData(formData, existingPartner, adminId); if (partnerDataToUpdate.email && partnerDataToUpdate.email !== existingPartner.email && !validationErrors.email) { try { const { count, error: emailCheckError } = await supabase .from('partners') .select('id', { count: 'exact', head: true }) .eq('admin_id', adminId) .eq('email', partnerDataToUpdate.email) .neq('id', partnerIdToEdit); if (emailCheckError) throw emailCheckError; if (count && count > 0) { validationErrors.email = 'This email address already exists for another of your partners.'; } } catch (e: any) { console.error('Edit email check error:', e); return fail(500, { success: false, message: `Server error: ${e.message}`, errors: validationErrors, action: currentActionPath }); } } if (Object.keys(validationErrors).length > 0) { console.log('[/dashboard editPartner action] Validation errors found:', validationErrors); const formValues: Record<string, any> = {}; formData.forEach((value, key) => formValues[key] = value); const repopulateData = { ...existingPartner, ...formValues, monthly_revenue: existingPartner.monthly_revenue, revenuePeriodFromSelect: formData.get('selectRevenuePeriodForEdit'), revenuePeriod: formValues.revenuePeriod, revenueRateUSD: formValues.revenueRateUSD, paymentStatus: formValues.paymentStatus }; return fail(400, { success: false, message: 'Form has errors.', errors: validationErrors, data: repopulateData, action: currentActionPath }); } console.log('[/dashboard editPartner action] Updating partner ID:', partnerIdToEdit, 'with data:', partnerDataToUpdate); const { error: updateError } = await supabase .from('partners') .update(partnerDataToUpdate) .eq('id', partnerIdToEdit) .eq('admin_id', adminId); if (updateError) { console.error('[/dashboard editPartner action] Supabase update error:', updateError); return fail(500, { success: false, message: `Database error: ${updateError.message}`, action: currentActionPath }); } return { success: true, message: 'Partner updated successfully!', action: currentActionPath };
    },

    // --- THIS IS THE ACTION IN QUESTION ---
    toggleAccountStatus: async ({ request, locals }) => {
        console.log('--- ✅ ACTION: toggleAccountStatus CALLED on server ---'); // Log entry into action
        if (!locals.admin || !locals.admin.id) {
            console.error('[/dashboard toggleAccountStatus action] Unauthorized.');
            return fail(401, { success: false, message: 'Unauthorized.' });
        }
        const adminId = locals.admin.id;

        const formData = await request.formData();
        const partnerId = formData.get('partnerId') as string;
        const currentStatus = formData.get('currentStatus') as string;

        if (!partnerId || !currentStatus) {
            console.error('[/dashboard toggleAccountStatus action] Missing partnerId or currentStatus.');
            return fail(400, { success: false, message: 'Partner ID and current status are required.' });
        }

        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        console.log(`[/dashboard toggleAccountStatus action] For admin '${adminId}', changing status for partner '${partnerId}' from '${currentStatus}' to '${newStatus}'`);

        const { error: updateError } = await supabase
            .from('partners')
            .update({ account_status: newStatus, updated_at: new Date().toISOString() }) // Explicitly set updated_at
            .eq('id', partnerId)
            .eq('admin_id', adminId);

        if (updateError) {
            console.error('[/dashboard toggleAccountStatus action] Supabase update error:', updateError);
            return fail(500, { success: false, message: `Database error updating status: ${updateError.message}` });
        }

        console.log('[/dashboard toggleAccountStatus action] Status updated successfully in DB.');
        return { // This structure is for responses processed by `deserialize` from a manual fetch
            type: 'success',
            status: 200,
            data: { success: true, message: `Account status updated to ${newStatus}.` }
        };
    }
};