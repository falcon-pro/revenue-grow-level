<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';
  // import { page } from '$app/stores'; // No longer strictly needed here for redirectTo in this specific function
  import type { LayoutData } from './$types';
  import AdminBadge from '$lib/components/AdminBadge.svelte'; // Create this component or comment out its usage

  export let data: LayoutData;
  let isScrolled = false;

  $: headerClass = `
    sticky top-0 z-50 transition-all duration-300 ease-in-out
    ${isScrolled ? 'bg-white bg-opacity-80 shadow-sm backdrop-blur-md' : 'bg-white'}
  `;


  const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
  // const INACTIVITY_TIMEOUT_MS = 15 * 1000; // For quick testing (15 seconds)
  let inactivityTimer: number | undefined;

  function resetInactivityTimer() {
    if (typeof window !== 'undefined' && data?.admin) { // Only run timer if actually logged in
      // console.log('[Client Inactivity] Activity detected, resetting timer.');
      clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(forceLogoutDueToInactivity, INACTIVITY_TIMEOUT_MS);
    }
  }

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
  const handleScroll = () => { if (typeof window !== 'undefined') isScrolled = window.scrollY > 10; };

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: true });
      if (data?.admin) { // Only setup inactivity listeners if user is actually logged in
        console.log('[Client Inactivity] Setting up inactivity timer for authenticated layout.');
        activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer, { passive: true }));
        resetInactivityTimer(); // Start the timer
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handleScroll);
        clearTimeout(inactivityTimer);
        activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
        // console.log('[Client Inactivity] Inactivity timer/listeners cleared.');
      }
    };
  });

  // This reactive statement ensures that if the admin logs out (data.admin becomes null),
  // any existing client-side inactivity timer is cleared.
  $: if (typeof window !== 'undefined' && !data?.admin && inactivityTimer) {
    console.log('[Client Inactivity] Admin data became null, clearing timer.');
    clearTimeout(inactivityTimer);
    activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
    });
  }
  // Also, if admin logs IN (data.admin becomes non-null after being null), set up timer
  // This is mainly for first load. Subsequent navigations within (app) will re-run onMount if component remounts.
  // Or, better: let onMount with the data.admin check handle initial setup.
  // The crucial part is that `data.admin` comes from the server load.
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