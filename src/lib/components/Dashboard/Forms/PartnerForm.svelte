<!-- src/lib/components/Dashboard/Forms/PartnerForm.svelte -->
<script lang="ts">
  import type { Database } from '../../../types/supabase'; // Adjust path
  type PartnerRow = Database['public']['Tables']['partners']['Row'];

  import { onMount, tick } from 'svelte';
  import { formatDateForInput, getMonthName } from '$lib/utils/helpers'; // Moved formatDateForInput here
  import { formatCurrency } from '$lib/utils/formatters'; // Corrected: formatCurrency is in formatters
  import { PKR_RATE } from '$lib/utils/revenue';

  export let partner: Partial<PartnerRow> | null = null;
  export let formAction: string;
  export let submitButtonText: string = 'Submit';
  export let serverErrors: Record<string, any> | null = null;

  let name = '';
  let mobile = '';
  let email = '';
  let address = '';
  let webmoney = '';
  let multi_account_no = '';
  let adstera_link = '';
  let adstera_email_link = '';
  let adstera_api_key = '';
  let account_creation_str = '';
  let account_start_str = '';

  let availableRevenuePeriods: string[] = [];
  let selectedRevenuePeriodForEdit = '';
  let revenuePeriodInputValue = ''; // For <input type="month">
  let revenueRateUSD: number | '' = '';
  let paymentStatus = 'pending';

  let pkrHelpText = `PKR auto-calculated (Rate: ${PKR_RATE}).`;
  let revenueHelpBlockHTML = '';

  async function populateFormFields() {
    await tick();
    const initialData = serverErrors?.data || partner;

    name = initialData?.name ?? '';
    mobile = initialData?.mobile ?? '';
    email = initialData?.email ?? '';
    address = initialData?.address ?? '';
    webmoney = initialData?.webmoney ?? '';
    multi_account_no = initialData?.multi_account_no ?? '';
    adstera_link = initialData?.adstera_link ?? '';
    adstera_email_link = initialData?.adstera_email_link ?? '';
    adstera_api_key = initialData?.adstera_api_key ?? '';
    account_creation_str = initialData?.account_creation ? formatDateForInput(initialData.account_creation) : '';
    account_start_str = initialData?.account_start ? formatDateForInput(initialData.account_start) : '';

    const sourceForRevenue = serverErrors?.data || partner;
    if (partner?.id && sourceForRevenue?.monthly_revenue) {
      const monthlyData = sourceForRevenue.monthly_revenue as Record<string, any>;
      availableRevenuePeriods = Object.keys(monthlyData).sort().reverse();
      selectedRevenuePeriodForEdit = serverErrors?.data?.revenuePeriodFromSelect || (availableRevenuePeriods.length > 0 ? availableRevenuePeriods[0] : '');
    } else {
      availableRevenuePeriods = []; selectedRevenuePeriodForEdit = '';
    }
    revenuePeriodInputValue = serverErrors?.data?.revenuePeriod || '';
    if (serverErrors?.data?.revenuePeriod) {
        revenuePeriodInputValue = serverErrors.data.revenuePeriod;
        revenueRateUSD = serverErrors.data.revenueRateUSD !== undefined ? serverErrors.data.revenueRateUSD : '';
        paymentStatus = serverErrors.data.paymentStatus || 'pending';
    } else if (selectedRevenuePeriodForEdit) {
        handleRevenuePeriodSelectionForEdit();
    } else {
        revenueRateUSD = serverErrors?.data?.revenueRateUSD !== undefined ? serverErrors.data.revenueRateUSD : '';
        paymentStatus = serverErrors?.data?.paymentStatus || 'pending';
    }
    updateRevenueHelpBlockText();
  }

  onMount(() => { populateFormFields(); });
  $: if (partner) { populateFormFields(); }
  $: if (serverErrors?.data) { populateFormFields(); }

  function handleRevenuePeriodSelectionForEdit() {
    revenuePeriodInputValue = selectedRevenuePeriodForEdit;
    const currentPartnerData = serverErrors?.data || partner;
    if (currentPartnerData?.monthly_revenue && selectedRevenuePeriodForEdit) {
      const monthlyData = currentPartnerData.monthly_revenue as Record<string, any>;
      const entry = monthlyData[selectedRevenuePeriodForEdit];
      if (entry) { revenueRateUSD = entry.usd ?? ''; paymentStatus = entry.status ?? 'pending'; }
      else { revenueRateUSD = ''; paymentStatus = 'pending'; }
    } else if (!selectedRevenuePeriodForEdit) { revenueRateUSD = ''; paymentStatus = 'pending'; }
    updateRevenueHelpBlockText();
  }

  function handleManualRevenuePeriodInputChange() {
    if (availableRevenuePeriods.includes(revenuePeriodInputValue)) {
        selectedRevenuePeriodForEdit = revenuePeriodInputValue;
        handleRevenuePeriodSelectionForEdit();
    } else {
        selectedRevenuePeriodForEdit = ''; revenueRateUSD = ''; paymentStatus = 'pending';
    }
    updateRevenueHelpBlockText();
  }

  function updateRevenueHelpBlockText() {
    let helpHtml = `<span class="text-xs text-gray-500">${pkrHelpText}`;
    const periodForDisplay = revenuePeriodInputValue || selectedRevenuePeriodForEdit;
    const currentPartnerData = serverErrors?.data || partner;
    if (partner?.id && periodForDisplay && (currentPartnerData?.monthly_revenue as Record<string, any>)?.[periodForDisplay]) {
        const entry = (currentPartnerData?.monthly_revenue as Record<string, any>)[periodForDisplay];
        helpHtml += ` Editing for <strong>${getMonthName(periodForDisplay)}</strong>. Current: ${formatCurrency(entry.usd ?? 0)} (${entry.status || 'N/A'}). Clearing amount will delete entry.`;
    } else if (periodForDisplay) {
        helpHtml += ` Adding data for <strong>${getMonthName(periodForDisplay)}</strong>.`;
    } else {
        helpHtml += ` Select or enter period (YYYY-MM) to add/update revenue.`;
    }
    helpHtml += '</span>';
    revenueHelpBlockHTML = helpHtml;
  }

  $: if(revenueRateUSD !== undefined || revenuePeriodInputValue !== undefined || selectedRevenuePeriodForEdit !== undefined) {
    updateRevenueHelpBlockText();
  }

  const getError = (fieldName: string) => serverErrors?.errors?.[fieldName] || null;

  let nameInvalid = false;
  let mobileInvalid = false;
  let emailInvalid = false;
  let revenueRateUSDInvalid = false; // Renamed for clarity
  let revenuePeriodInputInvalid = false; // Renamed for clarity

  function validateName() { nameInvalid = !(!!name && String(name).trim().length > 0); }
  function validateMobile() { mobileInvalid = !(!!mobile && String(mobile).trim().length > 0); }
  function validateEmail() { emailInvalid = !(!!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))); }
  function validateRevenueRateUSD() { revenueRateUSDInvalid = !(revenueRateUSD === '' || (typeof revenueRateUSD === 'number' && revenueRateUSD >= 0)); }
  function validateRevenuePeriodInput() { revenuePeriodInputInvalid = !!(revenueRateUSD !== '' && !revenuePeriodInputValue); }

</script>

<form method="POST" action={formAction} class="space-y-8">
  <fieldset class="border p-4 pt-2 rounded-md shadow-sm bg-white">
    <legend class="text-base font-medium text-gray-700 px-1">Partner Information</legend>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mt-4">
      <!-- Name -->
      <div class="form-group">
        <label for="form-name-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1 required-label">Full Name</label>
        <input id="form-name-{partner?.id || 'add'}" name="name" bind:value={name} on:blur={validateName} required
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={nameInvalid || !!getError('name')}
               placeholder="John Doe">
        {#if nameInvalid && !getError('name')} <span class="text-xs text-red-600 mt-1 block">Name is required.</span> {/if}
        {#if getError('name')} <span class="text-xs text-red-600 mt-1 block">{getError('name')}</span> {/if}
      </div>
      <!-- Mobile -->
      <div class="form-group">
        <label for="form-mobile-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1 required-label">Mobile</label>
        <input id="form-mobile-{partner?.id || 'add'}" name="mobile" bind:value={mobile} on:blur={validateMobile} required
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={mobileInvalid || !!getError('mobile')}
               placeholder="+1234567890">
        {#if mobileInvalid && !getError('mobile')} <span class="text-xs text-red-600 mt-1 block">Mobile is required.</span> {/if}
        {#if getError('mobile')} <span class="text-xs text-red-600 mt-1 block">{getError('mobile')}</span> {/if}
      </div>
      <!-- Email -->
      <div class="form-group">
        <label for="form-email-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1 required-label">Email</label>
        <input id="form-email-{partner?.id || 'add'}" name="email" type="email" bind:value={email} on:blur={validateEmail} required
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={emailInvalid || !!getError('email')}
               placeholder="partner@example.com">
        {#if emailInvalid && !getError('email')} <span class="text-xs text-red-600 mt-1 block">Valid email is required.</span> {/if}
        {#if getError('email')} <span class="text-xs text-red-600 mt-1 block">{getError('email')}</span> {/if}
      </div>
      <!-- Address -->
      <div class="form-group">
        <label for="form-address-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input id="form-address-{partner?.id || 'add'}" name="address" bind:value={address}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={!!getError('address')}
               placeholder="123 Main St">
        {#if getError('address')} <span class="text-xs text-red-600 mt-1 block">{getError('address')}</span> {/if}
      </div>
      <!-- Webmoney -->
      <div class="form-group">
        <label for="form-webmoney-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Webmoney</label>
        <input id="form-webmoney-{partner?.id || 'add'}" name="webmoney" bind:value={webmoney}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
      <!-- Multi Acc No -->
      <div class="form-group">
        <label for="form-multi_account_no-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Multi Acc No</label>
        <input id="form-multi_account_no-{partner?.id || 'add'}" name="multi_account_no" bind:value={multi_account_no}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
      <!-- Adstera Link -->
      <div class="form-group">
        <label for="form-adstera_link-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Adstera Link</label>
        <input id="form-adstera_link-{partner?.id || 'add'}" name="adstera_link" type="url" bind:value={adstera_link}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               placeholder="https://...">
      </div>
      <!-- Adstera Email Link -->
      <div class="form-group">
        <label for="form-adstera_email_link-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Adstera Email</label>
        <input id="form-adstera_email_link-{partner?.id || 'add'}" name="adstera_email_link" type="url" bind:value={adstera_email_link}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               placeholder="https://...">
      </div>
      <!-- Adstera API Key -->
      <div class="form-group">
        <label for="form-adstera_api_key-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Adstera API Key</label>
        <input id="form-adstera_api_key-{partner?.id || 'add'}" name="adstera_api_key" bind:value={adstera_api_key}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               placeholder="api_key_...">
      </div>
      <!-- Account Creation Date -->
      <div class="form-group">
        <label for="form-account_creation-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Creation Date</label>
        <input id="form-account_creation-{partner?.id || 'add'}" name="account_creation" type="datetime-local" bind:value={account_creation_str}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
      <!-- Account Start Date -->
      <div class="form-group">
        <label for="form-account_start-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input id="form-account_start-{partner?.id || 'add'}" name="account_start" type="datetime-local" bind:value={account_start_str}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
      </div>
    </div>
  </fieldset>

  <fieldset class="border p-4 pt-2 rounded-md shadow-sm bg-white">
    <legend class="text-base font-medium text-gray-700 px-1">
      {#if partner && partner.id}Update/Add Revenue for Period{:else}Revenue Entry (Optional){/if}
    </legend>

    {#if partner && partner.id && availableRevenuePeriods.length > 0}
      <div class="my-3">
        <label for="form-selectRevenuePeriodForEdit-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">
          Select Existing Period to Update/View
        </label>
        <select id="form-selectRevenuePeriodForEdit-{partner?.id || 'add'}"
                bind:value={selectedRevenuePeriodForEdit}
                on:change={handleRevenuePeriodSelectionForEdit}
                class="form-select mt-1 block w-full md:w-2/3 lg:w-1/2 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
          <option value="">-- Select Period to Edit or Add New Below --</option>
          {#each availableRevenuePeriods as periodOpt}
            <option value={periodOpt}>{getMonthName(periodOpt)}</option>
          {/each}
        </select>
      </div>
      <p class="text-sm text-gray-500 mb-3 italic">
          Or, enter a new period in "Revenue Period (YYYY-MM)" below to add a new monthly entry.
          The "Revenue Period (YYYY-MM)" input below takes precedence for submission if filled.
      </p>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 mt-2">
      <!-- Revenue Period -->
      <div class="form-group">
        <label for="form-revenuePeriod-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Revenue Period (YYYY-MM)</label>
        <input id="form-revenuePeriod-{partner?.id || 'add'}" name="revenuePeriod" type="month"
               bind:value={revenuePeriodInputValue}
               on:input={handleManualRevenuePeriodInputChange}
               on:blur={validateRevenuePeriodInput}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={revenuePeriodInputInvalid || !!getError('revenuePeriod')}
               placeholder="YYYY-MM">
        {#if revenuePeriodInputInvalid && !getError('revenuePeriod')} <span class="text-xs text-red-600 mt-1 block">Period required if rate entered.</span> {/if}
        {#if getError('revenuePeriod')} <span class="text-xs text-red-600 mt-1 block">{getError('revenuePeriod')}</span> {/if}
      </div>
      <!-- Revenue Rate (USD) -->
      <div class="form-group">
        <label for="form-revenueRateUSD-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Manual Revenue (USD)</label>
        <input id="form-revenueRateUSD-{partner?.id || 'add'}" name="revenueRateUSD" type="number" step="0.01" min="0"
               bind:value={revenueRateUSD}
               on:blur={validateRevenueRateUSD}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={revenueRateUSDInvalid || !!getError('revenueRateUSD')}
               placeholder="e.g., 15.50">
        <div class="mt-1 min-h-[1.5rem]">{@html revenueHelpBlockHTML}</div>
        {#if revenueRateUSDInvalid && !getError('revenueRateUSD')} <span class="text-xs text-red-600 mt-1 block">Must be a non-negative number.</span> {/if}
        {#if getError('revenueRateUSD')} <span class="text-xs text-red-600 mt-1 block">{getError('revenueRateUSD')}</span> {/if}
      </div>
      <!-- Payment Status -->
      <div class="form-group">
        <label for="form-paymentStatus-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Payment Status (for Period)</label>
        <select id="form-paymentStatus-{partner?.id || 'add'}" name="paymentStatus" bind:value={paymentStatus}
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

<!-- Global style for .required-label::after should be in app.css -->

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