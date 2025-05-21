// src/routes/logout/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SESSION_COOKIE_NAME = 'admin_session'; // Make sure this matches hook

export const POST: RequestHandler = async ({ cookies }) => {
    console.log('[/logout/+server.ts] POST: Clearing admin session cookie and redirecting to access-pin.');
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    throw redirect(303, '/access-pin?reason=logged_out'); // Redirect to login after clearing cookie
};

// Optional: Handle GET requests to /logout as well, for convenience or if linked directly
export const GET: RequestHandler = async ({ cookies }) => {
    console.log('[/logout/+server.ts] GET: Clearing admin session cookie and redirecting to access-pin.');
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    throw redirect(303, '/access-pin?reason=logged_out_get');
};