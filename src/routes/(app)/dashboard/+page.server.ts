// src/routes/(app)/dashboard/+page.server.ts
import { supabase } from '$lib/supabaseClient';
import { error, fail, redirect } from '@sveltejs/kit'; // redirect is not used in this version of addPartner, but good to have
import type { PageServerLoad, Actions } from './$types';
import type { Database } from '../../../types/supabase'; // Or your custom types
import { PKR_RATE } from '$lib/utils/revenue'; // Import PKR_RATE

// Define types from Supabase schema (or your custom types file)
type PartnerRow = Database['public']['Tables']['partners']['Row'];
type PartnerInsert = Database['public']['Tables']['partners']['Insert'];
// Assuming monthly_revenue in Supabase is JSONB like: { "YYYY-MM": { usd: number, pkr: number, status: string } }
// We need a type for one entry of that map
type MonthlyRevenuePeriodEntry = {
    usd?: number | null;
    pkr?: number | null;
    status?: string | null;
};


// Load function to fetch partners for display
export const load: PageServerLoad = async ({ locals, parent }) => {
    console.log('[/dashboard/+page.server.ts] Load function running...');

    const { admin } = await parent(); // Get admin data from the parent layout's load function

    if (!admin || !admin.id) {
        // This should ideally be caught by the (app)/+layout.server.ts guard,
        // but as a safeguard if this page is accessed directly or locals isn't populated.
        console.error('[/dashboard/+page.server.ts] Admin not found in locals. This should have been caught by layout guard.');
        throw error(401, 'Unauthorized: Admin context not found for dashboard.');
    }

    console.log('[/dashboard/+page.server.ts] Fetching partners for admin ID:', admin.id);

    const { data: partners, error: dbError } = await supabase
        .from('partners')
        .select('*') // Select all columns for now
        .eq('admin_id', admin.id) // Filter by the logged-in admin's ID
        .order('created_at', { ascending: false }); // Example order

    if (dbError) {
        console.error('[/dashboard/+page.server.ts] Supabase error fetching partners:', dbError);
        throw error(500, `Database error fetching partners: ${dbError.message}`);
    }

    console.log('[/dashboard/+page.server.ts] Fetched partners count:', partners?.length ?? 0);

    return {
        // `admin` object is already available to the +page.svelte from the parent layout's data
        partners: partners || [] // Ensure partners is always an array, even if null/undefined from Supabase
    };
};


// Helper function to process form data for a NEW partner
function processNewPartnerFormData(formData: FormData, adminId: string): { data: PartnerInsert, errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const data: Partial<PartnerInsert> = {}; // Use Partial for building up

    data.admin_id = adminId;

    // Extract and validate required text fields
    const name = formData.get('name') as string | null;
    if (!name || name.trim() === '') errors.name = 'Name is required.';
    else data.name = name.trim();

    const mobile = formData.get('mobile') as string | null;
    if (!mobile || mobile.trim() === '') errors.mobile = 'Mobile is required.';
    else data.mobile = mobile.trim();

    const email = formData.get('email') as string | null;
    if (!email || email.trim() === '') {
        errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.email = 'Invalid email format.';
    } else {
        data.email = email.trim();
    }

    // Optional text fields
    data.address = (formData.get('address') as string)?.trim() || null;
    data.webmoney = (formData.get('webmoney') as string)?.trim() || null;
    data.multi_account_no = (formData.get('multi_account_no') as string)?.trim() || null;
    data.adstera_link = (formData.get('adstera_link') as string)?.trim() || null;
    data.adstera_email_link = (formData.get('adstera_email_link') as string)?.trim() || null;
    data.adstera_api_key = (formData.get('adstera_api_key') as string)?.trim() || null;

    // Date fields
    const accountCreationStr = formData.get('account_creation') as string;
    if (accountCreationStr) {
        try { data.account_creation = new Date(accountCreationStr).toISOString(); }
        catch (e) { errors.account_creation = "Invalid creation date format."; }
    } else { data.account_creation = null; }


    const accountStartStr = formData.get('account_start') as string;
    if (accountStartStr) {
        try { data.account_start = new Date(accountStartStr).toISOString(); }
        catch (e) { errors.account_start = "Invalid start date format."; }
    } else { data.account_start = null; }


    data.account_status = 'active'; // Default for new partners

    // Monthly Revenue (for one period from the form)
    const revenuePeriod = formData.get('revenuePeriod') as string | null;
    const revenueRateUSDStr = formData.get('revenueRateUSD') as string | null;
    const paymentStatus = (formData.get('paymentStatus') as string | null) || 'pending';
    let revenueRateUSD: number | null = null;

    if (revenueRateUSDStr && revenueRateUSDStr.trim() !== '') {
        const parsedRate = parseFloat(revenueRateUSDStr);
        if (isNaN(parsedRate) || parsedRate < 0) {
            errors.revenueRateUSD = 'Revenue (USD) must be a valid non-negative number.';
        } else {
            revenueRateUSD = parsedRate;
        }
    }

    if (revenueRateUSD !== null && (!revenuePeriod || revenuePeriod.trim() === '')) {
        errors.revenuePeriod = 'Revenue period (YYYY-MM) is required when a revenue amount is entered.';
    }
    if (revenuePeriod && revenuePeriod.trim() !== '' && !/^\d{4}-\d{2}$/.test(revenuePeriod.trim())) {
        errors.revenuePeriod = 'Revenue period must be in YYYY-MM format.';
    }


    if (revenuePeriod && revenuePeriod.trim() !== '' && revenueRateUSD !== null && !errors.revenueRateUSD && !errors.revenuePeriod) {
        const monthlyEntry: MonthlyRevenuePeriodEntry = {
            usd: revenueRateUSD,
            pkr: revenueRateUSD * PKR_RATE, // Make sure PKR_RATE is defined and imported
            status: paymentStatus
        };
        // Ensure monthly_revenue is treated as Record<string, MonthlyRevenuePeriodEntry>
        data.monthly_revenue = { [revenuePeriod.trim()]: monthlyEntry } as any; // Cast to `any` then to expected type if TS complains
    } else {
        data.monthly_revenue = {} as any; // Default to empty object
    }

    // Determine initial revenue_source based on API key and monthly_revenue
    if (data.adstera_api_key) { // No need to check trim() again if already trimmed above
        data.revenue_source = 'api_loading';
        data.api_revenue_usd = null;
        data.api_revenue_pkr = null;
        data.last_api_check = null;
    } else if (data.monthly_revenue && Object.keys(data.monthly_revenue).length > 0) {
        data.revenue_source = 'manual';
    } else {
        data.revenue_source = null;
    }
    // `created_at` and `updated_at` are handled by Supabase defaults/triggers

    return { data: data as PartnerInsert, errors }; // Cast to PartnerInsert (the one for Supabase insert operations)
}


// SvelteKit Form Actions
export const actions: Actions = {
    addPartner: async ({ request, locals }) => {
        console.log('[/dashboard addPartner action] Received addPartner form submission.');

        if (!locals.admin || !locals.admin.id) {
            console.error('[/dashboard addPartner action] Unauthorized: No admin in session.');
            // Return values that the form prop in +page.svelte can use
            return fail(401, {
                success: false, // Indicate overall failure
                message: 'Unauthorized. Please log in again.',
                errors: { general: 'Unauthorized access.' } // General error
            });
        }
        const adminId = locals.admin.id;

        const formData = await request.formData();
        const { data: partnerDataToInsert, errors: validationErrors } = processNewPartnerFormData(formData, adminId);

        // Server-side email uniqueness check (scoped to current admin)
        if (partnerDataToInsert.email && !validationErrors.email) {
            try {
                const { data: existingPartner, error: emailCheckError } = await supabase
                    .from('partners')
                    .select('id', { count: 'exact', head: true }) // More efficient: just check existence
                    .eq('admin_id', adminId)
                    .eq('email', partnerDataToInsert.email);

                if (emailCheckError) {
                    console.error('[/dashboard addPartner action] Error checking email uniqueness:', emailCheckError);
                    return fail(500, { success: false, message: 'Database error checking email. Please try again.', errors: validationErrors });
                }
                // If existingPartner is not null or count > 0 (depending on query)
                if (existingPartner && (existingPartner as any).count > 0) { // Using count head true check
                    validationErrors.email = 'This email address already exists for one of your partners.';
                }
            } catch (e) {
                console.error('[/dashboard addPartner action] Exception checking email uniqueness:', e);
                return fail(500, { success: false, message: 'Server error during email check.', errors: validationErrors });
            }
        }

        if (Object.keys(validationErrors).length > 0) {
            console.log('[/dashboard addPartner action] Validation errors found:', validationErrors);
            // When returning validation errors, also return the submitted data
            // so the form can re-populate itself. SvelteKit can do this automatically if names match.
            const formValues: Record<string, any> = {};
            for (const [key, value] of formData.entries()) {
                formValues[key] = value;
            }
            return fail(400, {
                success: false,
                message: 'Form has errors. Please correct them and resubmit.',
                errors: validationErrors,
                data: formValues // Send back original form data for repopulation
            });
        }

        console.log('[/dashboard addPartner action] No validation errors. Attempting to insert partner:', partnerDataToInsert);
        const { error: insertError } = await supabase
            .from('partners')
            .insert(partnerDataToInsert)
            .select() // Important to select to get back data if needed or confirm success more robustly
            .single(); // Expecting one row to be inserted

        if (insertError) {
            console.error('[/dashboard addPartner action] Supabase insert error:', insertError);
            // Handle specific errors if needed (e.g., unique constraint violation)
            if (insertError.code === '23505') { // Unique violation (e.g. email_admin_id if constraint is re-added properly)
                 return fail(409, { success: false, message: 'Failed to add partner. This might be due to a duplicate entry (e.g., email).', errors: { email: 'This email may already be registered under your account.' } });
            }
            return fail(500, { success: false, message: `Database error while adding partner: ${insertError.message}` });
        }

        console.log('[/dashboard addPartner action] Partner added successfully to Supabase.');

        // For now, return a success message. The page will not auto-refresh the partner list yet.
        // The +page.svelte will receive this `form` data and can display `form.message`.
        // TODO in a later phase: Invalidate the partners list so the `load` function re-runs, or update client-side.
        return {
            success: true,
            message: 'Partner added successfully!'
        };

        // TODO LATER: If partnerDataToInsert.revenue_source === 'api_loading', consider triggering an async API fetch here
        // This could be done by calling another internal action/endpoint or a Supabase Edge Function.
    }
};