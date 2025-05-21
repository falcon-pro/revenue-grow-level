// src/routes/access-pin/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment'; // To check if in development mode for cookie security

export const load: PageServerLoad = async ({ locals, url }) => {
    console.log('[/access-pin/+page.server.ts] Load function running. Current URL:', url.href);
    if (locals.admin) {
        const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';
        console.log('[/access-pin/+page.server.ts] Admin already logged in. Redirecting to:', redirectTo);
        throw redirect(303, redirectTo); // Redirect to dashboard or intended page
    }
    console.log('[/access-pin/+page.server.ts] No admin logged in. Displaying PIN page.');
    return {}; // No specific data to load if not logged in, page will render
};

export const actions: Actions = {
    verifyPin: async ({ cookies, request, url }) => { // `url` is also available here from the event context
        const formData = await request.formData();
        const submittedPin = formData.get('pin') as string;

        // Read redirectTo from the URL the form was submitted from.
        // `url.searchParams` here refers to the URL of the page where the POST request was made.
        const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';
        console.log('[/access-pin verifyPin action] Attempting login. redirectTo:', redirectTo);


        // Server-side validation of the PIN format
        if (!submittedPin || typeof submittedPin !== 'string' || submittedPin.length !== 6 || !/^\d{6}$/.test(submittedPin)) {
            console.log('[/access-pin verifyPin action] Invalid PIN format submitted:', submittedPin);
            return fail(400, {
                error: 'Invalid PIN format. Please enter 6 digits.',
                pin: submittedPin, // Send back the problematic PIN for potential display or logging
                // No need to send redirectTo back with fail explicitly if page itself handles it,
                // but you could: redirectTo: redirectTo
            });
        }

        const adminPinsConfig = import.meta.env.VITE_ADMIN_PINS as string;
        if (!adminPinsConfig) {
            console.error('CRITICAL: VITE_ADMIN_PINS environment variable is not set on the server.');
            return fail(500, {
                error: 'Server configuration error. Please contact support.',
                // redirectTo: redirectTo
            });
        }

        // Parse the VITE_ADMIN_PINS string: "id1:pin1,id2:pin2"
        const pinMappings = new Map<string, string>(); // Stores PIN -> admin_id
        try {
            const configuredAdmins = adminPinsConfig.split(',');
            for (const adminEntry of configuredAdmins) {
                const parts = adminEntry.split(':');
                if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
                    pinMappings.set(parts[1].trim(), parts[0].trim()); // pin:adminId
                } else {
                    console.warn(`Malformed entry in VITE_ADMIN_PINS: "${adminEntry}"`);
                }
            }
        } catch (e) {
            console.error('Error parsing VITE_ADMIN_PINS:', e);
            return fail(500, { error: 'Server configuration error parsing PINs.'});
        }


        const matchedAdminId = pinMappings.get(submittedPin);

        if (matchedAdminId) {
            console.log('[/access-pin verifyPin action] PIN Valid. Matched Admin ID:', matchedAdminId, '. Setting cookie.');
            cookies.set('admin_session', matchedAdminId, {
                path: '/',
                httpOnly: true,
                secure: !dev, // True in production (HTTPS), false in local dev (HTTP)
                sameSite: 'lax', // Or 'strict' for more security if applicable
                // maxAge: 60 * 60 * 24 * 7, // Cookie expires in 7 days (in seconds)
                maxAge:  20 * 60 * 1000, // Cookie expires in 30 mintues (in seconds)
            });

            console.log('[/access-pin verifyPin action] Redirecting to:', redirectTo);
            throw redirect(303, redirectTo); // 303 See Other is common for POST-redirect-GET
        } else {
            console.log('[/access-pin verifyPin action] Invalid PIN submitted:', submittedPin);
            // Optional: Add a small delay to make brute-force attacks slightly harder, but be mindful of UX.
            // await new Promise(resolve => setTimeout(resolve, 300));
            return fail(401, { // 401 Unauthorized is appropriate here
                error: 'Invalid PIN. Please try again.',
                pin: submittedPin,
                // redirectTo: redirectTo
            });
        }
    }
};