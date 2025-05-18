// src/routes/access-pin/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment'; // To check if in development mode for cookie security

// This load function is optional for this page, but good practice to include if needed later.
// It also ensures $types.ActionData is correctly inferred if we need it for the page component.
export const load: PageServerLoad = async ({ locals }) => {
    // If user is already logged in (we'll set locals.admin later), redirect to dashboard
    if (locals.admin) {
        throw redirect(303, '/dashboard');
    }
    return {}; // No specific data to load for the PIN page itself
};

export const actions: Actions = {
    // This 'default' action will be called if PinAccessForm.svelte has action="?/default" or just action=""
    // If PinAccessForm.svelte has action="?/verifyPin", then this should be 'verifyPin'
    // Let's assume PinAccessForm.svelte has action="?/verifyPin" as per its default prop
    verifyPin: async ({ cookies, request }) => {
        const formData = await request.formData();
        const submittedPin = formData.get('pin') as string;

        if (!submittedPin || typeof submittedPin !== 'string' || submittedPin.length !== 6 || !/^\d{6}$/.test(submittedPin) ) {
            return fail(400, { error: 'Invalid PIN format. Please enter 6 digits.', pin: submittedPin });
        }

        const adminPinsConfig = import.meta.env.VITE_ADMIN_PINS as string;
        if (!adminPinsConfig) {
            console.error('VITE_ADMIN_PINS environment variable is not set.');
            return fail(500, { error: 'Server configuration error. Please contact support.' });
        }

        // Parse the VITE_ADMIN_PINS string: "id1:pin1,id2:pin2"
        const pinMappings = new Map<string, string>(); // Stores PIN -> admin_id
        const configuredAdmins = adminPinsConfig.split(',');
        for (const adminEntry of configuredAdmins) {
            const [adminId, pin] = adminEntry.split(':');
            if (adminId && pin) {
                pinMappings.set(pin.trim(), adminId.trim());
            }
        }

        const matchedAdminId = pinMappings.get(submittedPin);

        if (matchedAdminId) {
            // PIN is valid! Set a cookie.
            // The cookie will store the matchedAdminId (or a session token that maps to it)
            cookies.set('admin_session', matchedAdminId, {
                path: '/',
                httpOnly: true, // Important for security: cookie not accessible via client-side JS
                secure: !dev,   // True in production (HTTPS), false in local dev (HTTP)
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // Cookie expires in 7 days
            });

            // Redirect to the dashboard
            throw redirect(303, '/dashboard'); // 303 See Other is common for POST-redirect-GET
        } else {
            // PIN is invalid
            // Optional: Add a small delay to make brute-force attacks slightly harder
            await new Promise(resolve => setTimeout(resolve, 300));
            return fail(401, { error: 'Invalid PIN. Please try again.', pin: submittedPin });
        }
    }
};