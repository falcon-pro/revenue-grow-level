<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css'; // Your global styles
  import ToastContainer from '$lib/components/UI/ToastContainer.svelte';
</script>

<div class="min-h-screen flex flex-col text-slate-800 bg-slate-50">
  <ToastContainer />
  <main class="flex-grow"> <slot /> </main>
</div>