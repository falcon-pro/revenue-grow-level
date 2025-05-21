// src/routes/api/auth/check-session/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
// No DB check needed here, the hook already does the validation and sets locals.admin.
// This endpoint simply reports back what the hook determined about the current request's session.

export const GET: RequestHandler = async ({ locals }) => {
    if (locals.admin && locals.admin.id) {
        // Session is considered valid by the hook for this request
        return json({
            isAuthenticated: true,
            adminId: locals.admin.id,
            // You could add more details like session expiry from hook if it were passed via locals
        });
    } else {
        // Session is considered invalid or non-existent by the hook
        return json({ isAuthenticated: false });
    }
};