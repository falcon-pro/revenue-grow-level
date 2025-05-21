// src/routes/logout/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient'; // << Ensure supabase is imported

const SESSION_COOKIE_NAME = 'admin_session_token'; // Match with hooks.server.ts

export const POST: RequestHandler = async ({ cookies }) => {
    const token = cookies.get(SESSION_COOKIE_NAME);
    console.log(`[/logout POST] Attempting to log out. Token from cookie: ${token ? token.substring(0,8)+'...' : 'None'}`);

    if (token) {
        try {
            const { error: deleteError } = await supabase
                .from('active_admin_sessions')
                .delete()
                .eq('session_token', token);

            if (deleteError) {
                console.error('[/logout POST] Error deleting session from DB:', deleteError.message);
                // Still proceed to delete cookie and redirect
            } else {
                console.log('[/logout POST] Session token deleted from DB successfully.');
            }
        } catch (e: any) {
            console.error('[/logout POST] Exception deleting session from DB:', e.message);
        }
    }
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    console.log('[/logout POST] Browser cookie deleted. Redirecting to /access-pin.');
    throw redirect(303, '/access-pin?reason=logged_out');
};

export const GET: RequestHandler = async ({ cookies }) => { // Also handle GET for convenience
    const token = cookies.get(SESSION_COOKIE_NAME);
    console.log(`[/logout GET] Attempting to log out via GET. Token from cookie: ${token ? token.substring(0,8)+'...' : 'None'}`);
    if (token) {
        try {
            await supabase.from('active_admin_sessions').delete().eq('session_token', token);
            console.log('[/logout GET] Session token deleted from DB via GET successfully.');
        } catch (e: any) {
            console.error('[/logout GET] Exception deleting session from DB via GET:', e.message);
        }
    }
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    console.log('[/logout GET] Browser cookie deleted. Redirecting to /access-pin.');
    throw redirect(303, '/access-pin?reason=logged_out_get');
};