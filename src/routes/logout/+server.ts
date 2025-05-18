// src/routes/logout/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This will handle POST requests to /logout
export const POST: RequestHandler = async ({ cookies }) => {
    console.log('[/logout/+server.ts] Logging out admin.');
    // Clear the admin session cookie
    cookies.delete('admin_session', { path: '/' });

    // Redirect to the access PIN page
    throw redirect(303, '/access-pin');
};

// Optional: If someone tries to GET /logout, redirect them too
export const GET: RequestHandler = async () => {
    console.log('[/logout/+server.ts] GET request to logout, redirecting.');
    throw redirect(303, '/access-pin');
};