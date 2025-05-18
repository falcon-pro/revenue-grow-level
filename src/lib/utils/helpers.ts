// src/lib/utils/helpers.ts
export function getMonthName(monthStr: string | null | undefined): string {
    if (!monthStr || monthStr === 'all' || !/^\d{4}-\d{2}$/.test(monthStr)) {
        return monthStr === 'all' ? 'All Time' : (monthStr || '-');
    }
    try {
        const [year, month] = monthStr.split('-');
        const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
        return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch (e) {
        return monthStr;
    }
}

// You can add other general helpers here later