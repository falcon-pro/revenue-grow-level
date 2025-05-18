// src/routes/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    console.log('[/+page.server.ts] Checking if admin is logged in for root page.');
    if (locals.admin) {
        console.log('[/+page.server.ts] Admin logged in, redirecting to /dashboard from root.');
        throw redirect(303, '/dashboard'); // If logged in, go to dashboard
    }
    // If not logged in, they just see the root page content (links to /access-pin or /dashboard)
    console.log('[/+page.server.ts] Not logged in, showing root page.');
    return {};
};