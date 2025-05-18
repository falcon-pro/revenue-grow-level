// src/lib/utils/formatters.ts
export function formatDate(dateInput: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!dateInput) return '-';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '-'; // Invalid date
        
        const defaultOptions: Intl.DateTimeFormatOptions = {
            day: '2-digit', month: 'short', year: 'numeric',
            // hour: 'numeric', minute: '2-digit', hour12: true, // Add time if needed
            ...options
        };
        return date.toLocaleDateString('en-US', defaultOptions);
    } catch (e) {
        console.warn("Error formatting date:", e, dateInput);
        return String(dateInput).substring(0,10); // Fallback
    }
}

export function formatCurrency(amount: number | null | undefined, currencyCode: string = 'USD'): string {
    if (amount == null || isNaN(Number(amount))) return '-';
    try {
        const numberAmount = Number(amount);
        return numberAmount.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: currencyCode === 'PKR' ? 0 : 2,
            maximumFractionDigits: currencyCode === 'PKR' ? 0 : 2,
        });
    } catch (e) {
        console.warn("Currency formatting error:", e, amount);
        return `${currencyCode} ${Number(amount).toFixed(2)}`; // Fallback
    }
}