<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { page } from '$app/stores'; // Still useful for redirectTo on forced logout
  import type { LayoutData } from './$types';
  import AdminBadge from '$lib/components/AdminBadge.svelte';
  import { browser } from '$app/environment'; // Import browser
  import { toast } from '$lib/stores/toastStore';

  export let data: LayoutData; // This `data.admin` is from server initial load.
  let isScrolled = false;

    $: headerClass = `
    sticky top-0 z-50 transition-all duration-300 ease-in-out
    ${isScrolled ? 'bg-white bg-opacity-80 shadow-sm backdrop-blur-md' : 'bg-white'}
  `;


  // --- Inactivity Timer Logic (keep this as is) ---
  // const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
  const INACTIVITY_TIMEOUT_MS = 15 * 1000; // For quick testing (15 seconds)

  let inactivityTimer: number | undefined;
  function resetInactivityTimer() { /* ... same ... */ if (browser && data?.admin) { clearTimeout(inactivityTimer); inactivityTimer = window.setTimeout(forceLogoutDueToInactivity, INACTIVITY_TIMEOUT_MS); } }
  async function forceLogoutDueToInactivity() {
    console.log('[Client Inactivity] Timeout reached. Navigating to /logout.');
    if (typeof window !== 'undefined') {
      // Clear the timer and listeners immediately to prevent multiple triggers
      clearTimeout(inactivityTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      // No need to modify data.admin here; navigation will handle it
      await goto('/logout', { replaceState: true }); // Let the logout endpoint handle cookie & final redirect
    }
  }

  const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
  const handleScroll = () => { if (browser) isScrolled = window.scrollY > 10; };


  // --- NEW: Single Session Check Logic ---
  let sessionCheckInterval: number | undefined;
  const SESSION_CHECK_INTERVAL_MS = 1 * 60 * 1000; // Check every 1 minute for example

  async function verifyClientSession() {
      if (!browser || !data?.admin) { // Only run if browser and was initially logged in
          // If data.admin becomes null due to navigation or logout, this logic should also stop or not run
          if (sessionCheckInterval) clearInterval(sessionCheckInterval);
          return;
      }

      console.log('[Session Check] Verifying client session status with server...');
      try {
          const response = await fetch('/api/auth/check-session'); // Uses existing cookie
          if (response.ok) {
              const sessionStatus = await response.json();
              if (sessionStatus.isAuthenticated && sessionStatus.adminId === data.admin?.id) {
                  // console.log('[Session Check] Client session still valid on server for admin:', sessionStatus.adminId);
              } else {
                  // Server says session is NOT valid (or for a different admin, unlikely here)
                  console.log('[Session Check] Server indicates client session is no longer valid. Forcing logout.');
                  toastAndRedirectToLogin("Your session was ended because you logged in elsewhere or it expired.");
              }
          } else {
              // Network error or server error during check
              console.warn('[Session Check] API call to check session failed with status:', response.status);
              // Optionally, retry or after a few failures, force logout
          }
      } catch (error) {
          console.error('[Session Check] Error verifying client session:', error);
      }
  }

 function toastAndRedirectToLogin(message: string) {
    // Now uses the toast system
    toast.warning(message, 7000); // Use warning or error type as appropriate

    // It's crucial that the redirect to /logout happens to clear HttpOnly server-side cookie
    // /logout itself will then redirect to /access-pin
    const currentPathForRedirect = $page.url.pathname + $page.url.search; // Store before goto changes page store
    goto(`/logout?reason=session_superseded_or_expired&redirectTo=${encodeURIComponent(currentPathForRedirect)}`, { replaceState: true });
  }

  // --- End Single Session Check Logic ---


  onMount(() => {
    if (browser) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      if (data?.admin) { // If logged in on initial load
        console.log('[Layout Mount] Setting up inactivity & session check timers.');
        activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer, { passive: true }));
        resetInactivityTimer();

        // Start session checker
        verifyClientSession(); // Initial check
        sessionCheckInterval = window.setInterval(verifyClientSession, SESSION_CHECK_INTERVAL_MS);
        window.addEventListener('focus', verifyClientSession); // Also check when tab gains focus
      }
    }
    return () => {
      if (browser) {
        window.removeEventListener('scroll', handleScroll);
        clearTimeout(inactivityTimer);
        activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
        
        clearInterval(sessionCheckInterval); // Clear session check interval
        window.removeEventListener('focus', verifyClientSession); // Remove focus listener
        console.log('[Layout Destroy] Cleaned up timers and listeners.');
      }
    };
  });

 // Reactive statement if `data.admin` (from server load) changes (e.g. after programmatic logout)
 $: if (browser && prevAdminState !== undefined && data?.admin !== prevAdminState) {
     console.log('[Layout Reactive] data.admin state changed. Old:', prevAdminState, 'New:', data?.admin);
     if (!data?.admin) { // User logged out server-side (e.g. cookie expired, hook nulled it)
         console.log('[Layout Reactive] Admin logged out on server, ensuring client timers are off.');
         clearTimeout(inactivityTimer);
         clearInterval(sessionCheckInterval);
         activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
         window.removeEventListener('focus', verifyClientSession);
     } else if (data?.admin && !prevAdminState) { // User just logged in
         console.log('[Layout Reactive] Admin just logged in, setting up client timers.');
         activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer, { passive: true }));
         resetInactivityTimer();
         verifyClientSession(); // Initial check
         sessionCheckInterval = window.setInterval(verifyClientSession, SESSION_CHECK_INTERVAL_MS);
         window.addEventListener('focus', verifyClientSession);
     }
     prevAdminState = data?.admin;
 }
 let prevAdminState = data?.admin; // Initialize for comparison

</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
  <header class={headerClass}>
    <div class="container mx-auto px-4 sm:px-6">
      <div class="flex items-center justify-between h-16">
        <a href="/dashboard" class="flex items-center space-x-2 cursor-pointer" aria-label="Go to dashboard">
          <svg class="h-7 w-7 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
          <span class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity">Revenue Grow</span>
        </a>
        {#if data && data.admin} <!-- Robust check for data AND data.admin -->
          <div class="flex items-center space-x-3 sm:space-x-4">
            {#if data.admin.id } <!-- Ensure id exists if AdminBadge uses it -->
                 <AdminBadge admin={data.admin} />
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </header>

  <main class="flex-grow container mx-auto px-4 sm:px-6 py-6 sm:py-8" transition:fade|local={{duration:150}}>
    <slot />
  </main>

  <footer class="bg-white border-t border-gray-200 mt-auto">
    <div class="container mx-auto px-4 sm:px-6 py-6">
      <div class="text-center md:text-left">
        <div class="flex items-center justify-center md:justify-start space-x-2 text-sm text-gray-500">
          <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span>© {new Date().getFullYear()} Revenue Grow. All rights reserved.</span>
        </div>
      </div>
    </div>
  </footer>
</div>

<style>
  button, a, input, select { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, -webkit-backdrop-filter; transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, -webkit-backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
  ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: #f1f1f1; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>