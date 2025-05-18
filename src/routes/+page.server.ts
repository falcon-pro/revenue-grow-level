// src/routes/+page.server.ts
import { supabase } from '$lib/supabaseClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    console.log('Attempting to fetch from Supabase for connection test...');
    try {
        const { data, error } = await supabase.from('partners').select('id').limit(1);

        if (error) {
            console.error('Supabase query error during test:', error);
            return { success: false, errorMessage: error.message, data: null };
        }
        console.log('Supabase query success. Test data (or empty array):', data);
        return { success: true, errorMessage: null, data: data };
    } catch (e: any) {
        console.error('Exception during Supabase query test:', e);
        return { success: false, errorMessage: e.message || 'Unknown exception during test', data: null };
    }
};