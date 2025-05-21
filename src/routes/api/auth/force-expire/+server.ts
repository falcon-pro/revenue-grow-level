// src/routes/api/auth/force-expire/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';

const SESSION_COOKIE_NAME = 'admin_session_token'; // Consistent with other files

export const POST: RequestHandler = async ({ cookies, locals }) => {
    console.log('[/api/auth/force-expire] Received POST request to expire session.');

    // Although we're expiring, it's good practice to ensure it's an authenticated user requesting this for their own session
    // locals.admin should be populated by the hook if the cookie was still valid when this endpoint was hit.
    const adminCurrentlyInLocals = locals.admin; // Admin ID from hook if session was valid
    const tokenFromCookie = cookies.get(SESSION_COOKIE_NAME);

    if (tokenFromCookie) {
        try {
            console.log(`[/api/auth/force-expire] Expiring session for token ${tokenFromCookie.substring(0,5)}... (Admin ID from locals: ${adminCurrentlyInLocals?.id})`);
            // Delete the session from the database
            const { error: deleteError } = await supabase
                .from('active_admin_sessions')
                .delete()
                .eq('session_token', tokenFromCookie);

            if (deleteError) {
                console.error('[/api/auth/force-expire] Error deleting session from DB:', deleteError.message);
                // Continue to delete cookie anyway
            } else {
                console.log('[/api/auth/force-expire] Session token deleted from DB.');
            }
        } catch (e: any) {
            console.error('[/api/auth/force-expire] Exception deleting session from DB:', e.message);
        }
        // Always attempt to delete the cookie from the browser
        cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        console.log('[/api/auth/force-expire] Browser session cookie cleared.');
        return json({ success: true, message: 'Session has been marked for expiration.' });
    } else {
        console.log('[/api/auth/force-expire] No session token found in cookie to expire.');
        return json({ success: false, message: 'No active session to expire.' }, { status: 400 });
    }
};