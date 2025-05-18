<!-- src/lib/components/Auth/PinAccessForm.svelte -->
<script lang="ts">
  export let formActionPath: string = '?/verifyPin';
  export let errorMessage: string | null = null;

  let pinValue: string = '';
  let isLoading: boolean = false;

  function handlePinInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove non-digit characters
    pinValue = value.slice(0, 6); // Limit to 6 digits
  }

  $: isPinValid = /^\d{6}$/.test(pinValue); // Derived reactive variable
</script>

<form method="POST" action={formActionPath} class="space-y-6" autocomplete="off">
  <div>
    <label for="pin" class="block text-sm font-medium text-gray-700 mb-1">
      Enter 6-Digit PIN
    </label>
    <input
      type="password"
      name="pin"
      id="pin"
      bind:value={pinValue}
      on:input={handlePinInput}
      required
      maxlength="6"
      inputmode="numeric"
      title="PIN must be exactly 6 digits"
      class="form-input block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      placeholder="••••••"
    />
  </div>

  {#if errorMessage}
    <p class="text-sm text-red-600 bg-red-100 p-3 rounded-md border border-red-300" role="alert">
      {errorMessage}
    </p>
  {/if}

  <div>
    <button
      type="submit"
      disabled={isLoading || !isPinValid}
      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if isLoading}
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing...
      {:else}
        Access Dashboard
      {/if}
    </button>
  </div>
</form>
