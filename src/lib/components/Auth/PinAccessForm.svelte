<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  
  export let formActionPath: string = '?/verifyPin';
  export let errorMessage: string | null = null;

  let pins: string[] = Array(6).fill('');
  let currentIndex = 0;
  let isLoading = false;
  let isFocused = false;
  let isHovered = false;
  let showConfetti = false;

  function handleInput(e: InputEvent, index: number) {
    const input = e.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    
    if (value) {
      pins[index] = value.slice(0, 1);
      
      if (pins.every(pin => pin !== '')) {
        const form = input.closest('form');
        isLoading = true;
        setTimeout(() => {
          form?.requestSubmit(); // Form submit with delay
        }, 800); // Delay for animation
        return;
      }
      
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
      setTimeout(() => form?.requestSubmit(), 800);
    } else {
      currentIndex = Math.min(pasteData.length, 5);
      setTimeout(() => {
        document.getElementById(`pin-${currentIndex}`)?.focus();
      }, 10);
    }
  }

  function handleFocus() {
    isFocused = true;
  }

  function handleBlur() {
    isFocused = false;
  }

  function triggerConfetti() {
    showConfetti = true;
    setTimeout(() => showConfetti = false, 3000);
  }

  $: pinValue = pins.join('');
</script>

<div class="pin-verification-container">
  <!-- Floating 3D Background Elements -->
  <div class="floating-shapes">
    <div class="shape shape-1" />
    <div class="shape shape-2" />
    <div class="shape shape-3" />
    <div class="shape shape-4" />
  </div>

  <!-- Main Card with 3D Perspective -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="verification-card"
    class:card-hover={isHovered}
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
  >
    <!-- Card Header with Animated Icon -->
    <div class="card-header">
      <div class="icon-container">
        <div class="icon-circle">
           <svg class="h-8 w-8 text-gray-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      </div>
      <h1 class="title">Secure Verification</h1>
      <p class="subtitle">Enter your 6-digit magic code</p>
    </div>

    <!-- Pin Input Form with 3D Effects -->
    <form 
      method="POST" 
      action={formActionPath}
      class="pin-form"
      on:focusin={handleFocus}
      on:focusout={handleBlur}
    >
      <div class="pin-input-container">
        {#each pins as _, i}
          <div class="pin-digit-wrapper" in:fly={{ y: 20, duration: 500, delay: i * 50, easing: quintOut }}>
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
              class="pin-digit rounded"
              class:digit-filled={pins[i] !== ''}
              class:digit-active={currentIndex === i && isFocused}
              disabled={isLoading}
            />
            <div class="digit-underline" class:underline-active={pins[i] !== '' || currentIndex === i} />
          </div>
        {/each}
      </div>

      <input type="hidden" name="pin" value={pinValue} />

      <!-- Loading Animation -->
      {#if isLoading}
        <div class="loading-animation" transition:fade>
          <div class="loading-dots">
            {#each { length: 3 } as _, i}
              <div class="dot" style={`--delay: ${i * 0.15}s`} />
            {/each}
          </div>
          <p class="loading-text">Verifying your magic code...</p>
        </div>
      {/if}

      <!-- Error Message -->
      {#if errorMessage}
        <div class="error-message" transition:fade>
          <div class="error-content" in:fly={{ y: 20 }}>
            <svg class="error-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        </div>
      {/if}
    </form>

    <!-- Resend Code Link -->
    <div class="resend-container">
      <p class="resend-text">Didn't receive your code?</p>
      <button class="resend-button" type="button">
        <span class="resend-label">Send again</span>
        <svg class="resend-icon" viewBox="0 0 24 24">
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Success Confetti Effect -->
  {#if showConfetti}
    <div class="confetti-container">
      {#each Array(50) as _, i}
        <div class="confetti" style={`--delay: ${Math.random() * 2}s; --x: ${Math.random() * 100}%; --color: hsl(${Math.random() * 360}, 100%, 70%)`} />
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .pin-verification-container {
    --primary: #7c3aed;
    --primary-light: #8b5cf6;
    --primary-dark: #6d28d9;
    --error: #ef4444;
    --success: #10b981;
    --text: #1f2937;
    --text-light: #6b7280;
    --bg: #f9fafb;
    --card-bg: #ffffff;
    --shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    --transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: var(--bg);
    position: relative;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* Floating background shapes */
  .floating-shapes {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 0;
    overflow: hidden;
  }

  .shape {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.2;
    animation: float 15s infinite ease-in-out;
  }

  .shape-1 {
    width: 300px;
    height: 300px;
    background: var(--primary-light);
    top: 10%;
    left: 10%;
    animation-delay: 0s;
  }

  .shape-2 {
    width: 400px;
    height: 400px;
    background: #f59e0b;
    bottom: 10%;
    right: 10%;
    animation-delay: 2s;
  }

  .shape-3 {
    width: 250px;
    height: 250px;
    background: #10b981;
    top: 50%;
    right: 20%;
    animation-delay: 4s;
  }

  .shape-4 {
    width: 200px;
    height: 200px;
    background: #3b82f6;
    bottom: 30%;
    left: 20%;
    animation-delay: 6s;
  }

  @keyframes float {
    0%, 100% {
      transform: translate(0, 0) rotate(0deg);
    }
    25% {
      transform: translate(50px, 50px) rotate(5deg);
    }
    50% {
      transform: translate(0, 100px) rotate(0deg);
    }
    75% {
      transform: translate(-50px, 50px) rotate(-5deg);
    }
  }

  /* Main verification card */
  .verification-card {
    width: 100%;
    max-width: 420px;
    background: var(--card-bg);
    border-radius: 24px;
    padding: 2.5rem;
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transform-style: preserve-3d;
    transition: var(--transition);
    position: relative;
    z-index: 1;
    overflow: hidden;
  }

  .card-hover {
    transform: perspective(1000px) rotateX(5deg) rotateY(5deg) translateZ(20px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  }

  .card-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .icon-container {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .icon-circle {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--primary-light));
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3);
    animation: pulse 2s infinite ease-in-out;
  }

  .icon {
    width: 40px;
    height: 40px;
    fill: white;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 0.5rem;
    background: linear-gradient(to right, var(--primary), var(--primary-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--text-light);
    font-weight: 500;
  }

  /* Pin input form */
  .pin-form {
    margin-top: 2rem;
  }

  .pin-input-container {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .pin-digit-wrapper {
    position: relative;
    flex: 1;
    height: 60px;
  }

  .pin-digit {
    width: 100%;
    height: 100%;
    text-align: center;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--primary-dark);
    background: transparent;
    border: none;
    outline: none;
    transition: var(--transition);
    position: relative;
    z-index: 2;
  }

  .pin-digit:focus {
    color: var(--primary);
  }

  .digit-underline {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: #e5e7eb;
    transition: var(--transition);
  }

  .digit-underline.underline-active {
    height: 3px;
    background: var(--primary);
    box-shadow: 0 2px 10px rgba(124, 58, 237, 0.3);
  }

  .digit-filled {
    color: var(--primary);
    transform: translateY(-5px);
  }

  .digit-active {
    color: var(--primary);
  }

  /* Loading animation */
  .loading-animation {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .loading-dots {
    display: flex;
    gap: 0.5rem;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--primary);
    animation: bounce 1s infinite ease-in-out;
    animation-delay: var(--delay);
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .loading-text {
    font-size: 0.875rem;
    color: var(--text-light);
    font-weight: 500;
  }

  /* Error message */
  .error-message {
    margin-bottom: 1.5rem;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 12px;
    color: var(--error);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .error-icon {
    width: 20px;
    height: 20px;
    fill: var(--error);
  }

  /* Resend code */
  .resend-container {
    text-align: center;
    margin-top: 1.5rem;
  }

  .resend-text {
    font-size: 0.875rem;
    color: var(--text-light);
    margin-bottom: 0.5rem;
  }

  .resend-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: none;
    color: var(--primary);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    padding: 0.25rem 0.5rem;
    border-radius: 8px;
  }

  .resend-button:hover {
    color: var(--primary-dark);
    transform: translateY(-2px);
  }

  .resend-icon {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  /* Confetti animation */
  .confetti-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }

  .confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--color);
    opacity: 0;
    top: -10px;
    left: var(--x);
    animation: confetti-fall 3s ease-in forwards;
    animation-delay: var(--delay);
  }

  @keyframes confetti-fall {
    0% {
      opacity: 1;
      transform: translateY(0) rotate(0deg);
    }
    100% {
      opacity: 0;
      transform: translateY(100vh) rotate(720deg);
    }
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .pin-verification-container {
      --primary: #8b5cf6;
      --primary-light: #a78bfa;
      --primary-dark: #7c3aed;
      --text: #f3f4f6;
      --text-light: #9ca3af;
      --bg: #111827;
      --card-bg: rgba(31, 41, 55, 0.8);
    }

    .verification-card {
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .digit-underline {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 480px) {
    .verification-card {
      padding: 1.5rem;
      border-radius: 20px;
    }

    .icon-circle {
      width: 70px;
      height: 70px;
    }

    .icon {
      width: 32px;
      height: 32px;
    }

    .title {
      font-size: 1.5rem;
    }

    .pin-digit-wrapper {
      height: 50px;
    }

    .pin-digit {
      font-size: 1.5rem;
    }
  }
</style>