<!-- src/lib/components/UI/Toast.svelte -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { removeToast, type ToastMessage } from '$lib/stores/toastStore';
  import Icon from '../Icon.svelte';

  export let toast: ToastMessage;

  let timer: number | undefined;
  let isHovered = false;

  // Auto-dismiss after delay unless hovered
  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });

  $: if (toast.duration && !isHovered) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => removeToast(toast.id), toast.duration);
  }

  function dismiss() {
    removeToast(toast.id);
  }

  // Style mapping for different toast types
  const typeClasses = {
    success: {
      bg: 'bg-gradient-to-br from-green-500 to-green-600',
      border: 'border-green-700',
      icon: 'check-circle',
      progress: 'bg-green-400'
    },
    error: {
      bg: 'bg-gradient-to-br from-red-500 to-red-600',
      border: 'border-red-700',
      icon: 'x-circle',
      progress: 'bg-red-400'
    },
    info: {
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      border: 'border-blue-700',
      icon: 'information-circle',
      progress: 'bg-blue-400'
    },
    warning: {
      bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      border: 'border-amber-700',
      icon: 'exclamation',
      progress: 'bg-amber-400'
    }
  };

  // Title mapping
  const typeTitles = {
    success: 'Success',
    error: 'Error',
    info: 'Information',
    warning: 'Warning'
  };
</script>

<div
  in:fly={{ y: -20, duration: 300, delay: 50 }}
  out:fade={{ duration: 200 }}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  class="relative w-full max-w-sm overflow-hidden rounded-xl shadow-lg {typeClasses[toast.type].bg} {typeClasses[toast.type].border} border-l-4 text-white pointer-events-auto"
  role="alert"
>
  <!-- Progress bar -->
  {#if toast.duration}
    <div class="absolute top-0 left-0 right-0 h-1 bg-white/10">
      <div
        class="h-full {typeClasses[toast.type].progress} transition-all duration-linear"
        style={`width: ${isHovered ? '100%' : '0%'}`}
        animate={{ duration: toast.duration, easing: 'linear' }}
      />
    </div>
  {/if}

  <div class="p-4">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <Icon 
          name={typeClasses[toast.type].icon} 
          class="h-6 w-6 text-white/90" 
        />
      </div>
      <div class="ml-3 flex-1 pt-0.5">
        <h3 class="text-sm font-semibold">
          {toast.title || typeTitles[toast.type]}
        </h3>
        {#if typeof toast.message === 'string'}
          <p class="mt-1 text-sm text-white/90">{toast.message}</p>
        {:else}
          <div class="mt-1 text-sm text-white/90">{@html toast.message}</div>
        {/if}
      </div>
      <div class="ml-4 flex-shrink-0 flex">
        <button
          on:click={dismiss}
          class="inline-flex rounded-md text-white/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          <span class="sr-only">Close</span>
          <Icon name="x-mark" class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</div>