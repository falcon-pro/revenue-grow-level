// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_MAX_AGE_SECONDS = 20 * 60 * 1000; // 20 minutes

export const handle: Handle = async ({ event, resolve }) => {
    const adminSessionCookieValue = event.cookies.get(SESSION_COOKIE_NAME);

    if (adminSessionCookieValue) {
        event.locals.admin = { id: adminSessionCookieValue };
        event.cookies.set(SESSION_COOKIE_NAME, adminSessionCookieValue, {
            path: '/', httpOnly: true, secure: !dev, sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_SECONDS, // Refresh expiry on activity
        });
    } else {
        event.locals.admin = null;
    }
    return resolve(event);
};