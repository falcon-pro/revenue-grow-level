<!-- src/lib/components/Dashboard/Forms/PartnerForm.svelte -->
<script lang="ts">
  import type { Database } from '../../../types/supabase'; // Adjust path
  type PartnerRow = Database['public']['Tables']['partners']['Row'];
  // type PartnerInsert = Database['public']['Tables']['partners']['Insert'];

  import { onMount, tick } from 'svelte';
  import { formatDate, formatCurrency } from '$lib/utils/formatters'; // formatCurrency should be here
  import { getMonthName, formatDateForInput } from '$lib/utils/helpers'; // Added formatDateForInput
  import { PKR_RATE } from '$lib/utils/revenue'; // Added formatCurrency

  export let partner: Partial<PartnerRow> | null = null; // For pre-filling
  export let formAction: string;
  export let submitButtonText: string = 'Submit';
  export let serverErrors: Record<string, any> | null = null; // Can hold string or nested for field values

  // Form state
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

  // Revenue section state
  let availableRevenuePeriods: string[] = [];
  let selectedRevenuePeriodForEdit = ''; // For the <select> in edit mode
  let revenuePeriodInputValue = '';      // Bound to the <input type="month">, for YYYY-MM
  let revenueRateUSD: number | '' = '';
  let paymentStatus = 'pending';

  let pkrHelpText = `PKR auto-calculated (Rate: ${PKR_RATE}).`;
  let revenueHelpBlockHTML = '';

  async function populateFormFields() {
    await tick(); // Wait for Svelte to update DOM if partner prop just changed

    const initialData = serverErrors?.data || partner; // Prioritize data from failed submission if available

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

    // Revenue section pre-fill logic
    // `serverErrors.data` might contain `revenuePeriod`, `revenueRateUSD`, `paymentStatus`
    // from a previous submission attempt.
    const sourceForRevenue = serverErrors?.data || partner;

    if (partner && partner.id && sourceForRevenue?.monthly_revenue) { // Check partner.id for edit mode context
      const monthlyData = sourceForRevenue.monthly_revenue as Record<string, any>;
      availableRevenuePeriods = Object.keys(monthlyData).sort().reverse(); // Newest first
      
      // Default selected period: from server error, or latest existing, or empty
      selectedRevenuePeriodForEdit = serverErrors?.data?.revenuePeriodFromSelect || // if server returns a specific select value
                                     (availableRevenuePeriods.length > 0 ? availableRevenuePeriods[0] : '');
    } else {
      availableRevenuePeriods = [];
      selectedRevenuePeriodForEdit = '';
    }
    
    // `revenuePeriodInputValue` should be what the user manually types or from serverError if submitted
    revenuePeriodInputValue = serverErrors?.data?.revenuePeriod || '';

    // If `selectedRevenuePeriodForEdit` has a value (either from existing data or server error return),
    // then update revenueRateUSD and paymentStatus. This ensures `handleRevenuePeriodSelectionForEdit` runs.
    // If server returned data for revenuePeriod, revenueRateUSD, paymentStatus explicitly, use those.
    if(serverErrors?.data?.revenuePeriod) {
        revenuePeriodInputValue = serverErrors.data.revenuePeriod;
        revenueRateUSD = serverErrors.data.revenueRateUSD !== undefined ? serverErrors.data.revenueRateUSD : '';
        paymentStatus = serverErrors.data.paymentStatus || 'pending';
    } else if (selectedRevenuePeriodForEdit) {
        handleRevenuePeriodSelectionForEdit(); // This will populate based on selected an existing period
    } else {
        // Fresh add mode, or edit mode with no existing revenue periods
        revenueRateUSD = serverErrors?.data?.revenueRateUSD !== undefined ? serverErrors.data.revenueRateUSD : '';
        paymentStatus = serverErrors?.data?.paymentStatus || 'pending';
    }

    updateRevenueHelpBlockText(); // Initial call
  }

  onMount(() => {
    populateFormFields();
  });

  // Re-populate if the partner object itself changes (e.g. modal reopens with different partner)
  $: if (partner) {
    // console.log("PartnerForm: partner prop changed, repopulating.", partner);
    populateFormFields();
  }
  // Repopulate if serverErrors.data changes after a form submission error
  $: if (serverErrors?.data) {
    // console.log("PartnerForm: serverErrors.data changed, repopulating from server data.", serverErrors.data);
    populateFormFields();
  }


  function handleRevenuePeriodSelectionForEdit() {
    // When user *selects* from the dropdown (in edit mode)
    revenuePeriodInputValue = selectedRevenuePeriodForEdit; // Update the <input type="month">
    const currentPartnerData = serverErrors?.data || partner; // Prefer form data from failed submit

    if (currentPartnerData?.monthly_revenue && selectedRevenuePeriodForEdit) {
      const monthlyData = currentPartnerData.monthly_revenue as Record<string, any>;
      const entry = monthlyData[selectedRevenuePeriodForEdit];
      if (entry) {
        revenueRateUSD = entry.usd ?? '';
        paymentStatus = entry.status ?? 'pending';
      } else { // Period selected, but no data exists for it (e.g. selecting "add new" after populating dropdown)
        revenueRateUSD = '';
        paymentStatus = 'pending';
      }
    } else if (!selectedRevenuePeriodForEdit) { // E.g., "-- Select a period --" is chosen
        revenueRateUSD = '';
        paymentStatus = 'pending';
        // Keep revenuePeriodInputValue as is, user might type into it next
    }
    updateRevenueHelpBlockText();
  }

  // Handles when user types into the <input type="month"> directly
  function handleManualRevenuePeriodInputChange() {
    // selectedRevenuePeriodForEdit should clear or try to match if a dropdown exists
    if (availableRevenuePeriods.includes(revenuePeriodInputValue)) {
        selectedRevenuePeriodForEdit = revenuePeriodInputValue;
        handleRevenuePeriodSelectionForEdit(); // Will prefill from existing data
    } else {
        // User is typing a new, non-existing period. Clear rate/status.
        selectedRevenuePeriodForEdit = ''; // Deselect from dropdown
        revenueRateUSD = '';
        paymentStatus = 'pending';
    }
    updateRevenueHelpBlockText();
  }

  function updateRevenueHelpBlockText() {
    let helpHtml = `<span class="text-xs text-gray-500">${pkrHelpText}`;
    const periodForDisplay = revenuePeriodInputValue || selectedRevenuePeriodForEdit; // What's active
    const currentPartnerData = serverErrors?.data || partner; // Data context

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
  let revenueRateInvalid = false;
  let revenuePeriodInvalid = false;

  function validateName() { nameInvalid = !(!!name && String(name).trim().length > 0); }
  function validateMobile() { mobileInvalid = !(!!mobile && String(mobile).trim().length > 0); }
  function validateEmail() { emailInvalid = !(!!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))); }
  function validateRevenueRate() { revenueRateInvalid = !(revenueRateUSD === '' || (typeof revenueRateUSD === 'number' && revenueRateUSD >= 0)); }
  function validateRevenuePeriod() { revenuePeriodInvalid = !!(revenueRateUSD !== '' && !revenuePeriodInputValue); }

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
               on:blur={() => validateField('revenuePeriod', revenuePeriodInputValue)}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={revenuePeriodInvalid || !!getError('revenuePeriod')}
               placeholder="YYYY-MM">
        {#if revenuePeriodInvalid && !getError('revenuePeriod')} <span class="text-xs text-red-600 mt-1 block">Period required if rate entered.</span> {/if}
        {#if getError('revenuePeriod')} <span class="text-xs text-red-600 mt-1 block">{getError('revenuePeriod')}</span> {/if}
      </div>
      <!-- Revenue Rate (USD) -->
      <div class="form-group">
        <label for="form-revenueRateUSD-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 mb-1">Manual Revenue (USD)</label>
        <input id="form-revenueRateUSD-{partner?.id || 'add'}" name="revenueRateUSD" type="number" step="0.01" min="0"
               bind:value={revenueRateUSD}
               on:blur={() => validateField('revenueRateUSD', revenueRateUSD)}
               class="form-input mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
               class:border-red-500={revenueRateInvalid || !!getError('revenueRateUSD')}
               placeholder="e.g., 15.50">
        <div class="mt-1 min-h-[1.5rem]">{@html revenueHelpBlockHTML}</div>
        {#if revenueRateInvalid && !getError('revenueRateUSD')} <span class="text-xs text-red-600 mt-1 block">Must be a non-negative number.</span> {/if}
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