<script lang="ts">
  import PinAccessForm from '$lib/components/Auth/PinAccessForm.svelte';
  import type { PageData, ActionData } from './$types';
  
  export let data: PageData;
  export let form: ActionData;
</script>

<div class="min-h-screen flex items-center justify-center p-4">

      <PinAccessForm errorMessage={form?.error} />

      {#if form?.message}
        <div class="mt-6 p-3 bg-green-50 rounded-lg text-green-700 text-sm text-center">
          {form.message}
        </div>
      {/if}

</div>