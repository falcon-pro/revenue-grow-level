// src/routes/(app)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
    console.log('[/(app)/+layout.server.ts] Checking auth for path:', url.pathname);
    if (!locals.admin) {
        console.log('[/(app)/+layout.server.ts] No admin found, redirecting to /access-pin');
        // Redirect to the PIN access page, but include a 'redirectTo' query param
        // so after successful login, we can send them back to where they were trying to go.
        throw redirect(307, `/access-pin?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
    }

    console.log('[/(app)/+layout.server.ts] Admin found:', locals.admin);
    // Pass the admin object to the layout and its children pages
    return {
        admin: locals.admin
    };
};