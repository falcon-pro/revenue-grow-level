<!-- src/routes/+page.svelte -->
<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-6">
  <div class="w-full max-w-4xl mx-auto text-center">
    <!-- Animated Logo/Header -->
    <div class="mb-8 animate-fade-in">
      <div class="inline-flex items-center justify-center bg-white p-5 rounded-2xl shadow-lg border border-gray-100">
        <svg class="h-12 w-12 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      </div>
    </div>

    <!-- Main Heading -->
    <h1 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4 animate-slide-up">
      Welcome to <span class="text-indigo-600">Our Platform</span>
    </h1>

    <!-- Subheading -->
    <p class="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto animate-slide-up delay-100">
      Secure, powerful, and designed for your success. Get started with our intuitive dashboard.
    </p>

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row justify-center gap-4 mb-12 animate-slide-up delay-200">
      <a href="/access-pin" class="text-lg items-center flex btn-primary text-indigo-600 hover:text-black font-bold">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secure PIN Login
      </a>
      
      <a href="/dashboard" class="text-lg items-center flex btn-primary text-indigo-600 font-bold  hover:text-black ">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        Explore Dashboard
      </a>
    </div>

    <!-- Features Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in delay-300">
      <div class="feature-card">
        <div class="feature-icon bg-indigo-100 text-indigo-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 class="feature-title">Bank-Grade Security</h3>
        <p class="feature-description">Your data is protected with enterprise-level encryption.</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon bg-blue-100 text-blue-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="feature-title">Lightning Fast</h3>
        <p class="feature-description">Optimized for performance with near-instant loading.</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon bg-green-100 text-green-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        </div>
        <h3 class="feature-title">Cloud Powered</h3>
        <p class="feature-description">Access your data anywhere, anytime, on any device.</p>
      </div>
    </div>

    <!-- Footer Note -->
    <p class="text-sm text-gray-500 animate-fade-in delay-500">
      Need help? <a href="#" class="text-indigo-600 hover:underline">Contact our support team</a>
    </p>
  </div>
</div>

<style>
  /* Button Styles */
  .btn-primary {
    @apply inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200;
  }

  .btn-secondary {
    @apply inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200;
  }

  /* Feature Card Styles */
  .feature-card {
    @apply bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200;
  }

  .feature-icon {
    @apply flex items-center justify-center h-12 w-12 rounded-full mb-4;
  }

  .feature-title {
    @apply text-lg font-semibold text-gray-800 mb-2;
  }

  .feature-description {
    @apply text-gray-600;
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.6s ease-out forwards;
  }

  .animate-slide-up {
    animation: slideUp 0.6s ease-out forwards;
  }

  .delay-100 {
    animation-delay: 0.1s;
  }

  .delay-200 {
    animation-delay: 0.2s;
  }

  .delay-300 {
    animation-delay: 0.3s;
  }

  .delay-500 {
    animation-delay: 0.5s;
  }
</style>