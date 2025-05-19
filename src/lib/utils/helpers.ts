// src/lib/utils/helpers.ts
export function getMonthName(monthStr: string | null | undefined): string {
    // ... (existing code) ...
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

export function formatDateForInput(dateStringOrDate: string | Date | null | undefined): string {
    if (!dateStringOrDate) return '';
    try {
        const date = new Date(dateStringOrDate);
        if (isNaN(date.getTime())) return '';
        // Format: YYYY-MM-DDTHH:mm
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        console.warn("Error formatting date for input:", e, dateStringOrDate);
        return '';
    }
}