<!-- src/lib/components/Dashboard/Forms/PartnerForm.svelte (Style Fix) -->
<script lang="ts">
  import type { Database } from '../../../types/supabase';
  type PartnerRow = Database['public']['Tables']['partners']['Row'];

  import { onMount } from 'svelte';
  import { getMonthName } from '$lib/utils/helpers';
  import { PKR_RATE } from '$lib/utils/revenue';

  export let partner: Partial<PartnerRow> | null = null;
  export let formAction: string;
  export let submitButtonText: string = 'Submit';
  export let serverErrors: Record<string, string> | null = null;

  let name = partner?.name ?? '';
  let mobile = partner?.mobile ?? '';
  let email = partner?.email ?? '';
  let address = partner?.address ?? '';
  let webmoney = partner?.webmoney ?? '';
  let multi_account_no = partner?.multi_account_no ?? '';
  let adstera_link = partner?.adstera_link ?? '';
  let adstera_email_link = partner?.adstera_email_link ?? '';
  let adstera_api_key = partner?.adstera_api_key ?? '';
  let account_creation_str = partner?.account_creation ? new Date(partner.account_creation).toISOString().slice(0, 16) : '';
  let account_start_str = partner?.account_start ? new Date(partner.account_start).toISOString().slice(0, 16) : '';

  let revenuePeriod = '';
  let revenueRateUSD: number | '' = '';
  let paymentStatus = 'pending';

  let pkrHelpText = `PKR auto-calculated (Rate: ${PKR_RATE}).`;
  let revenueHelpBlockHTML = ''; // Renamed to avoid conflict with block element

  function updateRevenueHelp() {
    let helpHtml = `<span class="text-xs text-gray-500">${pkrHelpText}`;
    if (revenuePeriod) {
      helpHtml += ` Adding data for ${getMonthName(revenuePeriod)}.`;
    } else {
      helpHtml += ` Select period to add revenue data.`;
    }
    helpHtml += '</span>';
    revenueHelpBlockHTML = helpHtml;
  }

  onMount(() => {
    updateRevenueHelp();
  });

  $: if(revenuePeriod !== undefined) updateRevenueHelp(); // Check against undefined to trigger on mount too

  const getError = (fieldName: string) => serverErrors?.[fieldName] || null;

  // Basic client-side validation flags
  // (This simplified client-side validation is mostly for immediate UX. Server is truth.)
  let nameInvalid = false;
  let mobileInvalid = false;
  let emailInvalid = false;
  let revenueRateInvalid = false;
  let revenuePeriodInvalid = false;

  function validateName() { nameInvalid = !(!!name && String(name).trim().length > 0); }
  function validateMobile() { mobileInvalid = !(!!mobile && String(mobile).trim().length > 0); }
  function validateEmail() { emailInvalid = !(!!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))); }
  function validateRevenueRate() { revenueRateInvalid = !(revenueRateUSD === '' || (typeof revenueRateUSD === 'number' && revenueRateUSD >= 0)); }
  function validateRevenuePeriod() { revenuePeriodInvalid = !!(revenueRateUSD !== '' && !revenuePeriod); }

</script>

<form method="POST" action={formAction} class="space-y-8">
  <fieldset class="border p-4 pt-2 rounded-md shadow-sm bg-white">
    <legend class="text-base font-medium text-gray-700 px-1">Partner Information</legend>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mt-4">
      <!-- Name -->
      <div class="form-group">
        <label for="addName" class="block text-sm font-medium text-gray-700 mb-1 required-label">Full Name</label>
        <input id="addName" name="name" bind:value={name} on:blur={validateName} required
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={nameInvalid && !getError('name')}
               placeholder="John Doe">
        {#if nameInvalid && !getError('name')} <span class="text-xs text-red-600 mt-1 block">Name is required.</span> {/if}
        {#if getError('name')} <span class="text-xs text-red-600 mt-1 block">{getError('name')}</span> {/if}
      </div>
      <!-- Mobile -->
      <div class="form-group">
        <label for="addMobile" class="block text-sm font-medium text-gray-700 mb-1 required-label">Mobile</label>
        <input id="addMobile" name="mobile" bind:value={mobile} on:blur={validateMobile} required
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={mobileInvalid && !getError('mobile')}
               placeholder="+1234567890">
        {#if mobileInvalid && !getError('mobile')} <span class="text-xs text-red-600 mt-1 block">Mobile is required.</span> {/if}
        {#if getError('mobile')} <span class="text-xs text-red-600 mt-1 block">{getError('mobile')}</span> {/if}
      </div>
      <!-- Email -->
      <div class="form-group">
        <label for="addEmail" class="block text-sm font-medium text-gray-700 mb-1 required-label">Email</label>
        <input id="addEmail" name="email" type="email" bind:value={email} on:blur={validateEmail} required
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={emailInvalid && !getError('email')}
               placeholder="partner@example.com">
        {#if emailInvalid && !getError('email')} <span class="text-xs text-red-600 mt-1 block">Valid email is required.</span> {/if}
        {#if getError('email')} <span class="text-xs text-red-600 mt-1 block">{getError('email')}</span> {/if}
      </div>
      <!-- Address -->
      <div class="form-group">
        <label for="addAddress" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input id="addAddress" name="address" bind:value={address}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={!!getError('address')}
               placeholder="123 Main St">
        {#if getError('address')} <span class="text-xs text-red-600 mt-1 block">{getError('address')}</span> {/if}
      </div>
      <!-- Webmoney -->
      <div class="form-group">
        <label for="addWebmoney" class="block text-sm font-medium text-gray-700 mb-1">Webmoney</label>
        <input id="addWebmoney" name="webmoney" bind:value={webmoney}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
      <!-- Multi Acc No -->
      <div class="form-group">
        <label for="addMultiAccountNo" class="block text-sm font-medium text-gray-700 mb-1">Multi Acc No</label>
        <input id="addMultiAccountNo" name="multi_account_no" bind:value={multi_account_no}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
      <!-- Adstera Link -->
      <div class="form-group">
        <label for="addAdsteraLink" class="block text-sm font-medium text-gray-700 mb-1">Adstera Link</label>
        <input id="addAdsteraLink" name="adstera_link" type="url" bind:value={adstera_link}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               placeholder="https://...">
      </div>
      <!-- Adstera Email Link -->
      <div class="form-group">
        <label for="addAdsteraEmailLink" class="block text-sm font-medium text-gray-700 mb-1">Adstera Email</label>
        <input id="addAdsteraEmailLink" name="adstera_email_link" type="url" bind:value={adstera_email_link}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               placeholder="https://...">
      </div>
      <!-- Adstera API Key -->
      <div class="form-group">
        <label for="addAdsteraApiKey" class="block text-sm font-medium text-gray-700 mb-1">Adstera API Key</label>
        <input id="addAdsteraApiKey" name="adstera_api_key" bind:value={adstera_api_key}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               placeholder="api_key_...">
      </div>
      <!-- Account Creation Date -->
      <div class="form-group">
        <label for="addAccountCreation" class="block text-sm font-medium text-gray-700 mb-1">Creation Date</label>
        <input id="addAccountCreation" name="account_creation" type="datetime-local" bind:value={account_creation_str}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
      <!-- Account Start Date -->
      <div class="form-group">
        <label for="addAccountStart" class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input id="addAccountStart" name="account_start" type="datetime-local" bind:value={account_start_str}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
    </div>
  </fieldset>

  <fieldset class="border p-4 pt-2 rounded-md shadow-sm bg-white">
    <legend class="text-base font-medium text-gray-700 px-1">Revenue Entry for a Specific Period (Optional)</legend>
    <p class="mt-1 mb-3 text-xs text-gray-500 italic">If adding specific revenue, select period and enter USD amount.</p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 mt-4">
      <!-- Revenue Period -->
      <div class="form-group">
        <label for="addRevenuePeriod" class="block text-sm font-medium text-gray-700 mb-1">Revenue Period</label>
        <input id="addRevenuePeriod" name="revenuePeriod" type="month" bind:value={revenuePeriod}
               on:blur={validateRevenuePeriod}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={revenuePeriodInvalid && !getError('revenuePeriod')}
               placeholder="YYYY-MM">
        {#if revenuePeriodInvalid && !getError('revenuePeriod')} <span class="text-xs text-red-600 mt-1 block">Period required if rate entered.</span> {/if}
        {#if getError('revenuePeriod')} <span class="text-xs text-red-600 mt-1 block">{getError('revenuePeriod')}</span> {/if}
      </div>
      <!-- Revenue Rate (USD) -->
      <div class="form-group">
        <label for="addRevenueRate" class="block text-sm font-medium text-gray-700 mb-1">Manual Revenue (USD)</label>
        <input id="addRevenueRate" name="revenueRateUSD" type="number" step="0.01" min="0"
               bind:value={revenueRateUSD} on:blur={validateRevenueRate}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={revenueRateInvalid && !getError('revenueRateUSD')}
               placeholder="e.g., 15.50">
        <div class="mt-1">{@html revenueHelpBlockHTML}</div>
        {#if revenueRateInvalid && !getError('revenueRateUSD')} <span class="text-xs text-red-600 mt-1 block">Must be a non-negative number.</span> {/if}
        {#if getError('revenueRateUSD')} <span class="text-xs text-red-600 mt-1 block">{getError('revenueRateUSD')}</span> {/if}
      </div>
      <!-- Payment Status -->
      <div class="form-group">
        <label for="addPaymentStatus" class="block text-sm font-medium text-gray-700 mb-1">Payment Status (for Period)</label>
        <select id="addPaymentStatus" name="paymentStatus" bind:value={paymentStatus}
                class="form-select mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
          <option value="pending">Pending / Update Soon</option>
          <option value="received">Received</option>
          <option value="not_received">Not Received</option>
        </select>
      </div>
    </div>
  </fieldset>

  <div class="pt-2">
    <button type="submit"
            class="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
      {submitButtonText}
    </button>
  </div>
</form>

<!--
  The <style> block is removed as most styling is now done with utility classes.
  The `@tailwindcss/forms` plugin handles base styling for `form-input` and `form-select`.
  Custom styles like `required-label::after` for the red asterisk would be global or in app.css.
-->
<style> /* Or just <style> if not using postcss specific features here */
  /* Add a global style for the red asterisk on required labels if not already present */
  .required-label::after {
    content: '*';
    color: #ef4444;
    /* Alternatively, use a hardcoded color: color: #ef4444; */
    margin-left: 0.125rem;
    font-weight: 600;
  }

  /* Ensure Tailwind form plugin base styles are applied or explicitly add them if needed */
  .form-input, .form-select {
    /* These are typically provided by @tailwindcss/forms. If not, add base styles here. */
    /* Example of base styles if plugin isn't fully effective or for override */
    /* appearance: none; */
    /* background-color: #fff; */
    /* border-color: theme('colors.gray.300'); */
    /* border-width: 1px; */
    /* border-radius: 0.375rem; */
    /* padding-top: 0.5rem; */
    /* padding-right: 0.75rem; */
    /* padding-bottom: 0.5rem; */
    /* padding-left: 0.75rem; */
  }
</style>