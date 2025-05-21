<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { LayoutData } from './$types';
  import AdminBadge from '$lib/components/AdminBadge.svelte';

  export let data: LayoutData;
  let isScrolled = false;

  const handleScroll = () => {
    isScrolled = window.scrollY > 10;
  };

  onMount(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
  <!-- Header -->
  <header class={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 shadow-sm backdrop-blur-sm' : 'bg-white'}`}>
    <div class="container mx-auto px-4 sm:px-6">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center space-x-2">
          <svg class="h-7 w-7 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Revenue Grow</span>
        </div>

        <!-- Admin Badge -->
        {#if data.admin}
          <AdminBadge admin={data.admin} />
        {/if}
      </div>
    </div>
  </header>

  <!-- Main -->
  <main class="flex-grow container mx-auto px-4 sm:px-6 py-6" transition:fade>
    <slot />
  </main>

  <!-- Footer -->
  <footer class="bg-white border-t border-gray-200">
    <div class="container mx-auto px-4 sm:px-6 py-4">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="flex items-center space-x-2 text-sm text-gray-500">
          <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>© {new Date().getFullYear()} Revenue Grow. All rights reserved.</span>
        </div>
      </div>
    </div>
  </footer>
</div>

<style>
  button, a, input, select {
    transition: all 0.2s ease;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
</style>
