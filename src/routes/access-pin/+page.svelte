<script lang="ts">
  import PinAccessForm from '$lib/components/Auth/PinAccessForm.svelte';
  import type { PageData, ActionData } from './$types';
  
  export let data: PageData;
  export let form: ActionData;
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-50 p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
    <div class="p-8">
      <div class="text-center mb-10">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
          <svg class="h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 class="text-3xl font-extrabold text-gray-900 mb-2">Secure Access</h1>
        <p class="text-gray-600">Enter your 6-digit verification code</p>
      </div>

      <PinAccessForm errorMessage={form?.error} />

      {#if form?.message}
        <div class="mt-6 p-3 bg-green-50 rounded-lg text-green-700 text-sm text-center">
          {form.message}
        </div>
      {/if}
    </div>
    
    <div class="bg-gray-50 px-8 py-6 border-t border-gray-200">
      <p class="text-xs text-gray-500 text-center">
        Can't access your code? <a href="#" class="font-medium text-blue-600 hover:text-blue-500">Request a new one</a>
      </p>
    </div>
  </div>
</div>