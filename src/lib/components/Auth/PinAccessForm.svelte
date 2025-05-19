<script lang="ts">
  export let formActionPath: string = '?/verifyPin';
  export let errorMessage: string | null = null;

  let pins: string[] = Array(6).fill('');
  let currentIndex = 0;
  let isLoading = false;

  function handleInput(e: InputEvent, index: number) {
    const input = e.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    
    if (value) {
      pins[index] = value.slice(0, 1);
      
      // Auto-submit when all digits are entered
      if (pins.every(pin => pin !== '') && pins.length === 6) {
        const form = input.closest('form');
        isLoading = true;
        form?.requestSubmit();
        return;
      }
      
      // Move to next input
      if (index < 5) {
        currentIndex = index + 1;
        setTimeout(() => {
          const nextInput = document.getElementById(`pin-${index + 1}`);
          nextInput?.focus();
        }, 10);
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !pins[index] && index > 0) {
      currentIndex = index - 1;
      setTimeout(() => {
        const prevInput = document.getElementById(`pin-${index - 1}`);
        prevInput?.focus();
      }, 10);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasteData = e.clipboardData?.getData('text/plain').replace(/\D/g, '').slice(0, 6) || '';
    
    pasteData.split('').forEach((char, i) => {
      if (i < 6) pins[i] = char;
    });
    
    if (pasteData.length === 6) {
      const form = e.target?.closest('form');
      isLoading = true;
      form?.requestSubmit();
    } else {
      currentIndex = Math.min(pasteData.length, 5);
      setTimeout(() => {
        document.getElementById(`pin-${currentIndex}`)?.focus();
      }, 10);
    }
  }

  $: pinValue = pins.join('');
</script>

<form method="POST" action={formActionPath} class="space-y-8" autocomplete="off">
  <div class="flex flex-col items-center">
    <div class="flex space-x-3 mb-8">
      {#each pins as _, i}
        <input
          id={`pin-${i}`}
          name={`pin-${i}`}
          type="password"
          bind:value={pins[i]}
          on:input={(e) => handleInput(e, i)}
          on:keydown={(e) => handleKeyDown(e, i)}
          on:paste={handlePaste}
          maxlength="1"
          inputmode="numeric"
          autofocus={i === 0}
          class="w-14 h-14 text-3xl text-center bg-white border-2 border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:shadow-md hover:border-blue-300 transform hover:scale-105"
          disabled={isLoading}
        />
      {/each}
    </div>

    <input type="hidden" name="pin" value={pinValue} />

    {#if errorMessage}
      <div class="animate-shake mb-6 w-full max-w-xs">
        <div class="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 shadow-sm text-center">
          {errorMessage}
        </div>
      </div>
    {/if}

    {#if isLoading}
      <div class="w-full max-w-xs mx-auto py-3 text-center">
        <svg class="animate-spin h-6 w-6 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="mt-2 text-sm text-gray-600">Verifying...</p>
      </div>
    {/if}
  </div>
</form>

<style>
  .animate-shake {
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
</style>