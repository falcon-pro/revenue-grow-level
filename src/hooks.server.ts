// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const adminSessionCookie = event.cookies.get('admin_session');

    if (adminSessionCookie) {
        // Here, adminSessionCookie directly holds the admin_id or identifier
        // In a more complex system, this might be a session token you'd validate
        // or look up in a database. For our PIN system, this is fine for now.
        event.locals.admin = {
            id: adminSessionCookie // Or parse it if it's more complex, e.g., JSON
            // You could add more admin details here if you fetched them from a DB
            // based on adminSessionCookie if it were, say, a user UUID.
        };
        console.log('[hooks.server.ts] Admin session found:', event.locals.admin);
    } else {
        event.locals.admin = null; // Ensure it's explicitly null if no cookie
        console.log('[hooks.server.ts] No admin session found.');
    }

    // Add a custom header to prevent caching of API responses for dynamic content
    // For actual API endpoints, you might want more specific caching headers.
    // For HTML pages rendered by SvelteKit, SvelteKit often handles caching well,
    // but this is a general good practice for dynamic data.
    const response = await resolve(event);

    // Example: Prevent caching for HTML responses from authenticated areas if desired,
    // though SvelteKit SSR often does a good job. This is more for API like endpoints.
    // if (event.locals.admin && response.headers.get('content-type')?.includes('text/html')) {
    //   response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    //   response.headers.set('Pragma', 'no-cache');
    //   response.headers.set('Expires', '0');
    // }
    
    return response;
};