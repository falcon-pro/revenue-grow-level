// src/routes/access-pin/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { supabase } from '$lib/supabaseClient'; // Import Supabase client
import { v4 as uuidv4 } from 'uuid'; // For generating session tokens, or use crypto.randomUUID

const SESSION_COOKIE_NAME = 'admin_session_token'; // Cookie will now store a token
const SESSION_MAX_AGE_SECONDS = 20 * 60; // 20 minutes

export const load: PageServerLoad = async ({ locals, url }) => {
    console.log('[/access-pin/+page.server.ts] Load function. Current URL:', url.href);
    if (locals.admin) { // locals.admin will be populated by the hook if a valid session_token is found
        const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';
        console.log('[/access-pin/+page.server.ts] Admin already effectively logged in. Redirecting to:', redirectTo);
        throw redirect(303, redirectTo);
    }
    console.log('[/access-pin/+page.server.ts] No active admin session. Displaying PIN page.');
    return {};
};

export const actions: Actions = {
    verifyPin: async ({ cookies, request, url, fetch }) => { // `fetch` can be used for internal API calls if needed
        const formData = await request.formData();
        const submittedPin = formData.get('pin') as string;
        const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';

        console.log('[/access-pin verifyPin action] Attempting login. redirectTo:', redirectTo);

        if (!submittedPin || typeof submittedPin !== 'string' || submittedPin.length !== 6 || !/^\d{6}$/.test(submittedPin)) {
            console.log('[/access-pin verifyPin action] Invalid PIN format submitted:', submittedPin);
            return fail(400, { error: 'Invalid PIN format. Please enter 6 digits.', pin: submittedPin });
        }

        const adminPinsConfig = import.meta.env.VITE_ADMIN_PINS as string;
        if (!adminPinsConfig) {
            console.error('CRITICAL: VITE_ADMIN_PINS environment variable is not set.');
            return fail(500, { error: 'Server configuration error.' });
        }

        const pinMappings = new Map<string, string>();
        try {
            const configuredAdmins = adminPinsConfig.split(',');
            for (const adminEntry of configuredAdmins) {
                const parts = adminEntry.split(':');
                if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
                    pinMappings.set(parts[1].trim(), parts[0].trim()); // pin:adminId (e.g., "123456":"main_admin")
                }
            }
        } catch (e) {
            console.error('Error parsing VITE_ADMIN_PINS:', e);
            return fail(500, { error: 'Server configuration error parsing PINs.' });
        }

        const matchedAdminId = pinMappings.get(submittedPin); // This is your admin identifier string, e.g., "main_admin"

        if (matchedAdminId) {
            console.log('[/access-pin verifyPin action] PIN Valid. Matched Admin Identifier:', matchedAdminId);

            const sessionToken = crypto.randomUUID ? crypto.randomUUID() : uuidv4(); // Generate a strong unique session token
            const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

            console.log(`[/access-pin verifyPin action] Upserting session for admin_id_text: ${matchedAdminId}, token: ${sessionToken.substring(0,8)}...`);

            // Upsert (update or insert) the session token for this admin identifier
            // This ensures only one active session_token per admin_id_text.
            const { error: upsertError } = await supabase
                .from('active_admin_sessions')
                .upsert(
                    {
                        admin_id_text: matchedAdminId, // This is the unique admin identifier (e.g., "main_admin")
                        session_token: sessionToken,
                        expires_at: expiresAt.toISOString()
                    },
                    {
                        onConflict: 'admin_id_text', // If a session for this admin_id_text exists, update its token and expiry
                        // if ignoreDuplicates is false (default), it will perform an UPDATE on conflict.
                    }
                );

            if (upsertError) {
                console.error('[/access-pin verifyPin action] Supabase error upserting session token:', upsertError);
                return fail(500, { error: 'Session creation failed in database.' });
            }
            console.log('[/access-pin verifyPin action] Session token upserted successfully in DB.');

            // Set the new session token in the cookie
            cookies.set(SESSION_COOKIE_NAME, sessionToken, {
                path: '/',
                httpOnly: true,
                secure: !dev,
                sameSite: 'lax',
                maxAge: SESSION_MAX_AGE_SECONDS,
            });
            console.log(`[/access-pin verifyPin action] Cookie '${SESSION_COOKIE_NAME}' set with new token. Redirecting to: ${redirectTo}`);

            throw redirect(303, redirectTo);
        } else {
            console.log('[/access-pin verifyPin action] Invalid PIN submitted:', submittedPin);
            return fail(401, { error: 'Invalid PIN. Please try again.', pin: submittedPin });
        }
    }
};