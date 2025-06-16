<!-- src/routes/Dashboard.svelte -->

<script lang="ts">
  // In a real application, this data would come from props or an API call.
  const stats = [
    {
      id: 1,
      label: 'Sales',
      value: '$8,764.22',
      change: '2%',
      trendIcon: `<svg width="12" height="12" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" class="inline-block"><path d="M1 6L3.5 3.5L6 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>`
    },
    {
      id: 2,
      label: 'Views',
      value: '112,440',
      change: '6%',
      trendIcon: `<svg width="12" height="12" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" class="inline-block"><path d="M1 6L3.5 3.5L6 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`
    },
    {
      id: 3,
      label: 'Active Users',
      value: '9,321',
      change: '4%',
      trendIcon: `<svg width="12" height="12" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" class="inline-block"><path d="M1 6L3.5 3.5L6 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>`
    },
  ];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  // Manually defined SVG path data to create smooth curves similar to the image
  const dottedLinePath = "M 0 60 C 100 40, 150 90, 250 80 C 350 70, 400 110, 500 70 C 600 30, 650 80, 750 75 C 850 70, 900 100, 1000 90";
  const solidLinePath = "M 0 130 C 100 160, 150 100, 250 120 C 350 140, 400 150, 500 130 C 600 110, 650 60, 750 80 C 850 100, 900 140, 1000 130";

</script>

<div class="bg-[#0D1117] text-gray-200 min-h-screen p-4 sm:p-6 md:p-8 font-['Inter',_sans-serif]">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <header class="flex justify-between items-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-white">Reporting overview</h1>
      <button class="flex items-center gap-2 text-sm bg-[#161B22] hover:bg-[#21262d] text-gray-300 px-3 py-1.5 rounded-lg border border-[#30363d]">
        <span class="w-2 h-2 bg-purple-500 rounded-full"></span>
        What's new?
      </button>
    </header>

    <!-- Stats Cards -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each stats as stat (stat.id)}
        <div class="bg-[#161B22] p-5 rounded-xl border border-[#30363d] transition-all hover:border-gray-600">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="bg-gray-800 p-2 rounded-lg text-gray-400">
                {@html stat.icon}
              </div>
              <p class="text-sm font-medium text-gray-400">{stat.label}</p>
            </div>
            <div class="flex items-center gap-1 text-sm font-semibold text-purple-400">
              {@html stat.trendIcon}
              <span>{stat.change}</span>
            </div>
          </div>
          <p class="text-3xl font-bold text-white mt-4">{stat.value}</p>
        </div>
      {/each}
    </section>

    <!-- Website Traffic Chart -->
    <section class="mt-10">
      <h2 class="text-xl font-semibold text-white mb-4">Website traffic</h2>
      <div class="bg-[#161B22] p-4 sm:p-6 rounded-xl border border-[#30363d]">
        <div class="w-full h-64">
          <svg viewBox="0 0 1000 200" class="w-full h-full" preserveAspectRatio="none">
            <!-- Faint Grid Lines -->
            <line x1="0" y1="50" x2="1000" y2="50" stroke="#30363d" stroke-width="1"/>
            <line x1="0" y1="100" x2="1000" y2="100" stroke="#30363d" stroke-width="1"/>
            <line x1="0" y1="150" x2="1000" y2="150" stroke="#30363d" stroke-width="1"/>

            <!-- Data Lines -->
            <path d={dottedLinePath} stroke="#6b7280" stroke-width="2.5" fill="none" stroke-dasharray="5 5" stroke-linecap="round"/>
            <path d={solidLinePath} stroke="#e5e7eb" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        
        <!-- X-Axis Labels -->
        <div class="flex justify-between mt-4 text-sm text-gray-500">
          {#each months as month}
            <span class="flex-1 text-center">{month}</span>
          {/each}
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  /* Import the Inter font for a modern look, similar to the image */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');

  /* Ensure the background covers the whole page */
  :global(body) {
    background-color: #0D1117;
  }
</style>