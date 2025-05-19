// src/lib/stores/toastStore.ts
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface ToastMessage {
    id: string; // Unique ID for each toast
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    duration?: number; // Optional: individual duration
}

// Create a writable store that holds an array of ToastMessage objects
export const toastMessages: Writable<ToastMessage[]> = writable([]);

const defaultDuration = 5000; // Default duration in ms

export function addToast(
    message: string,
    type: ToastMessage['type'] = 'info',
    duration: number = defaultDuration
) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `toast-${Date.now()}-${Math.random()}`; // Generate a unique ID

    // Add the new toast to the beginning of the array for visibility
    toastMessages.update(currentMessages => [
        { id, type, message, duration },
        ...currentMessages
    ]);

    // Automatically remove the toast after its duration
    if (duration > 0) {
        setTimeout(() => {
            removeToast(id);
        }, duration);
    }
    return id; // Return ID if manual removal is needed
}

export function removeToast(id: string) {
    toastMessages.update(currentMessages =>
        currentMessages.filter(toast => toast.id !== id)
    );
}

// Convenience functions
export const toast = {
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number) => addToast(message, 'error', duration),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration)
};