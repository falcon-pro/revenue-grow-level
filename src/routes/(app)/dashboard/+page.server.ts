// src/routes/(app)/dashboard/+page.server.ts
import { supabase } from '$lib/supabaseClient';
import { error } from '@sveltejs/kit'; // Import error helper
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
    console.log('[/dashboard/+page.server.ts] Loading dashboard data...');

    // Wait for the parent layout's load function to complete to ensure `locals.admin` is processed
    // and to get admin data if returned from parent.
    // The 'admin' prop is being returned by `(app)/+layout.server.ts`
    const { admin } = await parent();

    if (!admin || !admin.id) {
        // This should ideally be caught by the (app)/+layout.server.ts guard,
        // but as a safeguard:
        console.error('[/dashboard/+page.server.ts] Admin not found in locals after parent load. This should not happen.');
        throw error(401, 'Unauthorized: Admin not found');
    }

    console.log('[/dashboard/+page.server.ts] Fetching partners for admin ID:', admin.id);

    // Simulate delay START
    if (import.meta.env.DEV) { // Only in development
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }

    const { data: partners, error: dbError } = await supabase
        .from('partners')
        .select('*') // Select all columns for now
        .eq('admin_id', admin.id) // Filter by the logged-in admin's ID
        .order('created_at', { ascending: false }); // Example order

    if (dbError) {
        console.error('[/dashboard/+page.server.ts] Supabase error fetching partners:', dbError);
        throw error(500, `Database error: ${dbError.message}`);
    }

    console.log('[/dashboard/+page.server.ts] Fetched partners:', partners?.length);

    return {
        // We don't need to return 'admin' again here if it's already in parent layout data
        // and accessible via `data.admin` in `(app)/dashboard/+page.svelte` (from layout data).
        // However, returning it here directly can make page-specific logic cleaner.
        // admin: admin, // already available from parent layout's data
        partners: partners || [] // Ensure partners is always an array
    };
    
};