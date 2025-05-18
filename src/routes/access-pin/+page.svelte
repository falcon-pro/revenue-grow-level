<!-- src/routes/access-pin/+page.svelte -->
<script lang="ts">
  import PinAccessForm from '$lib/components/Auth/PinAccessForm.svelte';
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-gray-200 p-4">
  <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
    <div class="text-center mb-8">
      <svg class="mx-auto h-12 w-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      <h1 class="mt-4 text-2xl font-bold text-center text-gray-900">Admin Portal Access</h1>
      <p class="mt-1 text-sm text-center text-gray-600">Enter your secure PIN to proceed.</p>
    </div>

    <!-- Just render the form, we'll pass errorMessage later when we have a server action -->
    <PinAccessForm />

  </div>
</div>