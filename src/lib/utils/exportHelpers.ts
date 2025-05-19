// src/lib/utils/exportHelpers.ts
import type { Database } from '../../types/supabase'; // Adjust path if your types are elsewhere
type MonthlyRevenueData = Database['public']['Tables']['partners']['Row']['monthly_revenue'];
import { getMonthName } from './helpers'; // Assuming getMonthName is in helpers.ts

export function formatDateForExcel(dateInput: string | Date | null | undefined): string | null {
    if (!dateInput) return null;
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (e) {
        return String(dateInput).substring(0, 16).replace('T', ' ');
    }
}

export function formatRevenueForExcel(amount: number | null | undefined): number | null {
    if (amount == null || isNaN(Number(amount))) return null;
    return Number(amount);
}

export function getRevenuePeriodRangeForExcel(monthlyRevenue: MonthlyRevenueData): string {
    if (!monthlyRevenue || typeof monthlyRevenue !== 'object' || Object.keys(monthlyRevenue).length === 0) {
        return '-';
    }
    const periods = Object.keys(monthlyRevenue).filter(period => {
        const entry = (monthlyRevenue as Record<string, any>)[period]; // Adjust type if needed
        return entry && typeof entry.usd === 'number' && entry.usd > 0;
    }).sort();

    if (periods.length === 0) return '-';
    if (periods.length === 1) return getMonthName(periods[0]); // Uses getMonthName from helpers
    return `${getMonthName(periods[0])} to ${getMonthName(periods[periods.length - 1])}`;
}