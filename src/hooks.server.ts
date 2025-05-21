// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { supabase } from '$lib/supabaseClient';

const SESSION_COOKIE_NAME = 'admin_session_token';
const SESSION_MAX_AGE_SECONDS = 20 * 60; // 20 minutes

export const handle: Handle = async ({ event, resolve }) => {
    const sessionTokenFromCookie = event.cookies.get(SESSION_COOKIE_NAME);
    event.locals.admin = null;

    if (sessionTokenFromCookie) {
        console.log(`[Hook] Found session token in cookie: ${sessionTokenFromCookie.substring(0,8)}... Attempting to validate.`);
        try {
            const { data: sessionData, error: dbError } = await supabase
                .from('active_admin_sessions')
                .select('admin_id_text, expires_at')
                .eq('session_token', sessionTokenFromCookie)
                .single(); // This will error if not exactly one row.

            if (dbError) {
                // This specific error code from PostgREST (which Supabase uses) means 0 rows found.
                // Other dbError codes could mean different issues (network, table gone, etc.)
                if (dbError.code === 'PGRST116') { // PGRST116: "The result contains 0 rows"
                    console.log(`[Hook] Session token ${sessionTokenFromCookie.substring(0,8)}... NOT FOUND in DB (PGRST116).`);
                } else {
                    console.error("[Hook] Supabase error fetching session:", dbError.message, "Code:", dbError.code);
                }
                // In any DB error case fetching the session, treat session as invalid
                event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
            } else if (sessionData && new Date(sessionData.expires_at) > new Date()) {
                // Session token is valid in DB and not expired
                event.locals.admin = { id: sessionData.admin_id_text };
                // console.log(`[Hook] Session validated for admin: ${sessionData.admin_id_text}. Refreshing cookie and DB expiry.`);

                const newExpiresAtDb = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
                // Set cookie first, then try to update DB (less critical if DB update fails momentarily)
                event.cookies.set(SESSION_COOKIE_NAME, sessionTokenFromCookie, {
                    path: '/', httpOnly: true, secure: !dev, sameSite: 'lax',
                    maxAge: SESSION_MAX_AGE_SECONDS,
                });
                
                const { error: updateExpiryError } = await supabase
                    .from('active_admin_sessions')
                    .update({ expires_at: newExpiresAtDb.toISOString() })
                    .eq('session_token', sessionTokenFromCookie);

                if (updateExpiryError) {
                    console.error("[Hook] Error updating session expiry in DB:", updateExpiryError.message);
                }
            } else {
                // Session token was found but is EXPIRED in DB
                if (sessionData) {
                     console.log(`[Hook] Session token for admin '${sessionData.admin_id_text}' (token: ${sessionTokenFromCookie.substring(0,8)}...) found in DB but is EXPIRED (DB time: ${sessionData.expires_at}).`);
                }
                console.log('[Hook] Deleting expired session cookie from browser.');
                event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
            }
        } catch (e: any) {
            // This catch is if `.single()` itself throws an error that is not a PostgrestError (less likely for 'no rows')
            // or if any other unexpected JS error happens in the try block.
            console.error("[Hook] Unexpected JS exception during session verification:", e.message);
            event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        }
    } else {
        // console.log('[Hook] No session token cookie found on this request.');
    }

    const response = await resolve(event);
    return response;
};