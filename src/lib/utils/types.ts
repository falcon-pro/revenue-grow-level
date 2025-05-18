// src/lib/utils/types.ts
export interface MonthlyRevenueEntry {
    usd?: number | null;
    pkr?: number | null;
    status?: string | null; // 'pending', 'received', 'not_received'
}

export interface Partner {
    id: string; // UUID
    admin_id: string; // Assuming TEXT type now
    name: string | null;
    mobile: string | null;
    email: string | null;
    address: string | null;
    webmoney: string | null;
    multi_account_no: string | null; // In your Supabase schema it's multi_account_no
    adstera_link: string | null;
    adstera_email_link: string | null; // Renamed from adsteraEmail in original
    adstera_api_key: string | null;    // Renamed from adsteraApi
    account_creation: string | null; // TIMESTAMPTZ as string
    account_start: string | null;    // TIMESTAMPTZ as string
    account_status: string | null;   // 'active', 'suspended'
    monthly_revenue: Record<string, MonthlyRevenueEntry> | null; // e.g., {"YYYY-MM": MonthlyRevenueEntry}
    api_revenue_usd: number | null;
    api_revenue_pkr: number | null;
    last_api_check: string | null;   // TIMESTAMPTZ as string
    revenue_source: string | null;   // 'api', 'manual', ...
    api_error_message: string | null; // Was errorMessage
    created_at: string | null;       // TIMESTAMPTZ as string
    updated_at: string | null;       // TIMESTAMPTZ as string
}