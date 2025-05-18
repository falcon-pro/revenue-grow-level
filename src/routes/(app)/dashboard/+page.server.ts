// src/routes/(app)/dashboard/+page.server.ts
import { supabase } from '$lib/supabaseClient';
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Database } from '../../../types/supabase';
import { PKR_RATE } from '$lib/utils/revenue';

type PartnerInsert = Database['public']['Tables']['partners']['Insert'];
type MonthlyRevenuePeriodEntry = Partial<Database['public']['Tables']['partners']['Row']['monthly_revenue'][string]>;

// LOAD FUNCTION (Same as before)
export const load: PageServerLoad = async ({ locals, parent }) => {
    console.log('[/dashboard/+page.server.ts] Load function running...');
    const { admin } = await parent();
    if (!admin || !admin.id) {
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

// HELPER FUNCTION (Same as before)
function processNewPartnerFormData(formData: FormData, adminId: string): { data: PartnerInsert, errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const data: Partial<PartnerInsert> = {};
    data.admin_id = adminId;
    const name = formData.get('name') as string | null;
    if (!name || name.trim() === '') errors.name = 'Name is required.'; else data.name = name.trim();
    const mobile = formData.get('mobile') as string | null;
    if (!mobile || mobile.trim() === '') errors.mobile = 'Mobile is required.'; else data.mobile = mobile.trim();
    const email = formData.get('email') as string | null;
    if (!email || email.trim() === '') { errors.email = 'Email is required.'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { errors.email = 'Invalid email format.'; }
    else { data.email = email.trim(); }
    data.address = (formData.get('address') as string)?.trim() || null;
    data.webmoney = (formData.get('webmoney') as string)?.trim() || null;
    data.multi_account_no = (formData.get('multi_account_no') as string)?.trim() || null;
    data.adstera_link = (formData.get('adstera_link') as string)?.trim() || null;
    data.adstera_email_link = (formData.get('adstera_email_link') as string)?.trim() || null;
    data.adstera_api_key = (formData.get('adstera_api_key') as string)?.trim() || null;
    const accountCreationStr = formData.get('account_creation') as string;
    if (accountCreationStr) { try { data.account_creation = new Date(accountCreationStr).toISOString(); } catch (e) { errors.account_creation = "Invalid creation date."; } } else { data.account_creation = null; }
    const accountStartStr = formData.get('account_start') as string;
    if (accountStartStr) { try { data.account_start = new Date(accountStartStr).toISOString(); } catch (e) { errors.account_start = "Invalid start date."; } } else { data.account_start = null; }
    data.account_status = 'active';
    const revenuePeriod = formData.get('revenuePeriod') as string | null;
    const revenueRateUSDStr = formData.get('revenueRateUSD') as string | null;
    const paymentStatus = (formData.get('paymentStatus') as string | null) || 'pending';
    let revenueRateUSD: number | null = null;
    if (revenueRateUSDStr && revenueRateUSDStr.trim() !== '') {
        const parsedRate = parseFloat(revenueRateUSDStr);
        if (isNaN(parsedRate) || parsedRate < 0) { errors.revenueRateUSD = 'Revenue (USD) must be valid & non-negative.'; } else { revenueRateUSD = parsedRate; }
    }
    if (revenueRateUSD !== null && (!revenuePeriod || revenuePeriod.trim() === '')) { errors.revenuePeriod = 'Period required if rate entered.'; }
    if (revenuePeriod && revenuePeriod.trim() !== '' && !/^\d{4}-\d{2}$/.test(revenuePeriod.trim())) { errors.revenuePeriod = 'Period must be YYYY-MM.'; }
    if (revenuePeriod && revenuePeriod.trim() !== '' && revenueRateUSD !== null && !errors.revenueRateUSD && !errors.revenuePeriod) {
        const monthlyEntry: MonthlyRevenuePeriodEntry = { usd: revenueRateUSD, pkr: revenueRateUSD * PKR_RATE, status: paymentStatus };
        data.monthly_revenue = { [revenuePeriod.trim()]: monthlyEntry } as any;
    } else { data.monthly_revenue = {} as any; }
    if (data.adstera_api_key) { data.revenue_source = 'api_loading'; data.api_revenue_usd = null; data.api_revenue_pkr = null; data.last_api_check = null; }
    else if (data.monthly_revenue && Object.keys(data.monthly_revenue).length > 0) { data.revenue_source = 'manual'; }
    else { data.revenue_source = null; }
    return { data: data as PartnerInsert, errors };
}

// ACTIONS (addPartner + new deletePartner)
export const actions: Actions = {
    addPartner: async ({ request, locals }) => {
        console.log('[/dashboard addPartner action] Received form submission.');
        if (!locals.admin || !locals.admin.id) {
            return fail(401, { success: false, message: 'Unauthorized. Please log in again.', errors: { general: 'Unauthorized access.' } });
        }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const { data: partnerDataToInsert, errors: validationErrors } = processNewPartnerFormData(formData, adminId);

        if (partnerDataToInsert.email && !validationErrors.email) {
            try {
                const { count, error: emailCheckError } = await supabase
                    .from('partners')
                    .select('id', { count: 'exact', head: true })
                    .eq('admin_id', adminId)
                    .eq('email', partnerDataToInsert.email);
                if (emailCheckError) { throw emailCheckError; }
                if (count && count > 0) { validationErrors.email = 'This email address already exists for one of your partners.'; }
            } catch (e: any) {
                console.error('[/dashboard addPartner action] Error/Exception checking email uniqueness:', e);
                return fail(500, { success: false, message: `Server error during email check: ${e.message}`, errors: validationErrors });
            }
        }

        if (Object.keys(validationErrors).length > 0) {
            console.log('[/dashboard addPartner action] Validation errors found:', validationErrors);
            const formValues: Record<string, any> = {}; formData.forEach((value, key) => formValues[key] = value);
            return fail(400, { success: false, message: 'Form has errors. Please correct them.', errors: validationErrors, data: formValues });
        }

        console.log('[/dashboard addPartner action] Attempting to insert partner.');
        const { error: insertError } = await supabase.from('partners').insert(partnerDataToInsert);

        if (insertError) {
            console.error('[/dashboard addPartner action] Supabase insert error:', insertError);
            if (insertError.code === '23505') { return fail(409, { success: false, message: 'Failed to add partner. Duplicate entry.', errors: { email: 'This email may already be registered.' } }); }
            return fail(500, { success: false, message: `Database error: ${insertError.message}` });
        }
        console.log('[/dashboard addPartner action] Partner added successfully.');
        return { success: true, message: 'Partner added successfully!', action: '?/addPartner' }; // Added action identifier
    },

    deletePartner: async ({ request, locals }) => {
        console.log('[/dashboard deletePartner action] Received delete request.');
        if (!locals.admin || !locals.admin.id) {
            console.error('[/dashboard deletePartner action] Unauthorized.');
            return fail(401, { success: false, message: 'Unauthorized.' });
        }
        const adminId = locals.admin.id;
        const formData = await request.formData();
        const partnerId = formData.get('partnerId') as string;

        if (!partnerId) {
            console.error('[/dashboard deletePartner action] Partner ID missing.');
            return fail(400, { success: false, message: 'Partner ID is required.' });
        }

        console.log('[/dashboard deletePartner action] Deleting partner ID:', partnerId, 'for admin:', adminId);
        const { error: deleteError } = await supabase
            .from('partners')
            .delete()
            .eq('id', partnerId)
            .eq('admin_id', adminId); // Ensure admin can only delete their own

        if (deleteError) {
            console.error('[/dashboard deletePartner action] Supabase delete error:', deleteError);
            return fail(500, { success: false, message: `Database error: ${deleteError.message}` });
        }

        console.log('[/dashboard deletePartner action] Partner deleted successfully.');
        // IMPORTANT: For list to auto-update with use:enhance, need to ensure SvelteKit re-runs load.
        // Returning a plain success object is fine, `invalidateAll()` in `handleSubmit` or similar is best for refresh.
        return { success: true, message: 'Partner deleted successfully.', action: '?/deletePartner' }; // Added action identifier
    }
};