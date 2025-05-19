<!-- src/lib/components/Dashboard/Forms/PartnerForm.svelte -->
<script lang="ts">
  import type { Database } from '../../../types/supabase';
  type PartnerRow = Database['public']['Tables']['partners']['Row'];
  
  import { onMount, tick, afterUpdate } from 'svelte';
  import { formatDateForInput, getMonthName } from '$lib/utils/helpers';
  import { formatCurrency } from '$lib/utils/formatters';
  import { PKR_RATE } from '$lib/utils/revenue';
  import Icon from '../../Icon.svelte';

  export let partner: Partial<PartnerRow> | null = null;
  export let formAction: string;
  export let submitButtonText: string = 'Submit';
  export let serverErrors: { errors?: Record<string, string>, data?: Record<string, any>, message?: string, success?: boolean, action?:string } | null = null;

  // Form state variables
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

  // Revenue section
  let availableRevenuePeriods: string[] = [];
  let selectedRevenuePeriodForEdit = '';
  let revenuePeriodInputValue = '';
  let revenueRateUSD: number | '' = '';
  let paymentStatus = 'pending';

  let pkrHelpText = `PKR auto-calculated (Rate: ${PKR_RATE}).`;
  let revenueHelpBlockHTML = '';

  // --- Form Population and Reset Logic ---
  async function initializeOrRepopulateForm() {
    await tick(); // Ensure DOM elements (if any bound here, though not directly) are ready & props settled

    // Prioritize repopulating from serverErrors.data if a form submission failed
    // Otherwise, use the `partner` prop (for edit mode) or default to empty (for add mode)
    const sourceData = serverErrors?.data || partner || {};

    name = sourceData.name ?? '';
    mobile = sourceData.mobile ?? '';
    email = sourceData.email ?? '';
    address = sourceData.address ?? '';
    webmoney = sourceData.webmoney ?? '';
    multi_account_no = sourceData.multi_account_no ?? '';
    adstera_link = sourceData.adstera_link ?? '';
    adstera_email_link = sourceData.adstera_email_link ?? '';
    adstera_api_key = sourceData.adstera_api_key ?? '';
    
    account_creation_str = sourceData.account_creation ? formatDateForInput(sourceData.account_creation) : '';
    account_start_str = sourceData.account_start ? formatDateForInput(sourceData.account_start) : '';

    // Revenue section pre-fill / repopulation
    // Use `partner` for existing revenue periods, but `serverErrors.data` for values if submitted
    const monthlyDataSource = partner?.monthly_revenue || {}; // For dropdown options in edit mode
    if (partner && partner.id) { // Only populate dropdown if we are truly in an edit context (partner.id exists)
        const monthlyDataActual = (monthlyDataSource || {}) as Record<string, any>;
        availableRevenuePeriods = Object.keys(monthlyDataActual).sort().reverse();
    } else {
        availableRevenuePeriods = [];
    }
    
    // `revenuePeriodInputValue` should primarily reflect what was LAST submitted or typed
    // or if editing an existing period selected from dropdown.
    // If `serverErrors.data` has these fields, they represent the user's last attempt.
    revenuePeriodInputValue = sourceData.revenuePeriod || ''; // From input type="month" submission
    selectedRevenuePeriodForEdit = sourceData.revenuePeriodFromSelect || // From select submission
                                   (partner?.id && availableRevenuePeriods.includes(revenuePeriodInputValue) ? revenuePeriodInputValue : ''); // if input matches existing

    // If form is being repopulated from `serverErrors.data` that came from *this form's* submission:
    if (serverErrors?.data && (serverErrors.action === formAction) ) {
        revenueRateUSD = serverErrors.data.revenueRateUSD !== undefined ? serverErrors.data.revenueRateUSD : '';
        paymentStatus = serverErrors.data.paymentStatus || 'pending';
         // if selectedRevenuePeriodForEdit was also part of form data it would be set above from sourceData
    }
    // Else, if in edit mode (partner.id exists) and a period is selected/derived for editing:
    else if (partner && partner.id && (selectedRevenuePeriodForEdit || revenuePeriodInputValue)) {
        handleRevenuePeriodSelectionForEdit(); // Will use selected or input value to populate rate/status
    }
    // Else (add mode, or edit mode with no revenue section interaction yet / no default period):
    else {
        revenueRateUSD = '';
        paymentStatus = 'pending';
        // revenuePeriodInputValue remains as set from sourceData (likely '')
    }
    updateRevenueHelpBlockText();
  }

  export function resetForm() {
    name = ''; mobile = ''; email = ''; address = ''; webmoney = ''; multi_account_no = '';
    adstera_link = ''; adstera_email_link = ''; adstera_api_key = '';
    account_creation_str = ''; account_start_str = '';

    availableRevenuePeriods = []; selectedRevenuePeriodForEdit = '';
    revenuePeriodInputValue = ''; revenueRateUSD = ''; paymentStatus = 'pending';

    // Clear client-side validation flags
    nameInvalid = false; mobileInvalid = false; emailInvalid = false;
    revenueRateUSDInvalid = false; revenuePeriodInputInvalid = false;

    serverErrors = null; // Clear any passed server errors locally for this instance.
                        // The parent's `form` store will be reset on next action.

    updateRevenueHelpBlockText();
    console.log('[PartnerForm.svelte] Form fields reset.');
  }

  onMount(() => {
    console.log('[PartnerForm.svelte] Mounted. Partner Prop:', partner, "ServerErrors:", serverErrors);
    if (!partner && !serverErrors?.data) { // If truly a fresh "Add" form, not repopulating from error
      resetForm();
    } else {
      initializeOrRepopulateForm();
    }
  });

  // Watch for prop changes to re-initialize/repopulate
  // Use a more robust way to detect actual change if objects are mutable.
  let prevPartnerId: string | null | undefined = partner?.id;
  let prevServerErrorsAction: string | null | undefined = serverErrors?.action;

  afterUpdate(() => {
    if (partner?.id !== prevPartnerId) { // Partner object for editing has changed
        console.log('[PartnerForm.svelte] Partner prop changed, re-populating.');
        initializeOrRepopulateForm();
        prevPartnerId = partner?.id;
    }
    if (serverErrors && serverErrors.action && serverErrors.action !== prevServerErrorsAction) { // Server errors for this form
        console.log('[PartnerForm.svelte] ServerErrors prop changed, re-populating with server data.');
        initializeOrRepopulateForm();
        prevServerErrorsAction = serverErrors.action;
    } else if (!serverErrors && prevServerErrorsAction) { // Server errors cleared
        prevServerErrorsAction = null;
        // If form was for "add" and it succeeded, parent calls resetForm().
        // If form was for "edit" and it succeeded, modal usually closes.
    }
  });


  function handleRevenuePeriodSelectionForEdit() {
    // This is called when the <select> for existing periods (in edit mode) changes.
    // It populates the revenueRateUSD, paymentStatus, and revenuePeriodInputValue.
    revenuePeriodInputValue = selectedRevenuePeriodForEdit; // Keep month input in sync
    const sourceForMonthlyData = serverErrors?.data?.monthly_revenue || partner?.monthly_revenue || {};
    const monthlyData = sourceForMonthlyData as Record<string, any>;

    if (selectedRevenuePeriodForEdit && monthlyData[selectedRevenuePeriodForEdit]) {
      const entry = monthlyData[selectedRevenuePeriodForEdit];
      revenueRateUSD = entry.usd ?? '';
      paymentStatus = entry.status ?? 'pending';
    } else { // No period selected or no data for it (e.g. "-- Select --" or new period entry)
      revenueRateUSD = '';
      paymentStatus = 'pending';
    }
    updateRevenueHelpBlockText();
  }

  function handleManualRevenuePeriodInputChange() {
    // This is called when the <input type="month" name="revenuePeriod"> changes.
    // It should try to sync with `selectedRevenuePeriodForEdit` if a dropdown is visible.
    if (partner?.id && availableRevenuePeriods.includes(revenuePeriodInputValue)) {
        selectedRevenuePeriodForEdit = revenuePeriodInputValue; // Sync dropdown
        handleRevenuePeriodSelectionForEdit(); // This will load data for the period
    } else {
        // User is typing a new period, or it's "Add mode".
        // Clear `selectedRevenuePeriodForEdit` as it's not from the existing list.
        selectedRevenuePeriodForEdit = '';
        // If user types a new period, clear the rate/status as they'll need to enter new data.
        revenueRateUSD = '';
        paymentStatus = 'pending';
    }
    updateRevenueHelpBlockText();
  }

  function updateRevenueHelpBlockText() {
    let helpHtml = `<span class="text-xs text-gray-500">${pkrHelpText}`;
    const periodToConsider = revenuePeriodInputValue || selectedRevenuePeriodForEdit;
    const currentDataForHelp = serverErrors?.data || partner;

    if (partner?.id && periodToConsider && (currentDataForHelp?.monthly_revenue as Record<string, any>)?.[periodToConsider]) {
        const entry = (currentDataForHelp.monthly_revenue as Record<string, any>)[periodToConsider];
        helpHtml += ` Editing for <strong>${getMonthName(periodToConsider)}</strong>. Current: ${formatCurrency(entry.usd ?? 0)} (${entry.status || 'N/A'}). Clearing USD amount will delete this period's entry.`;
    } else if (periodToConsider) {
        helpHtml += ` Adding new data for <strong>${getMonthName(periodToConsider)}</strong>.`;
    } else {
        helpHtml += ` Select or enter period (YYYY-MM) to add/update specific monthly revenue.`;
    }
    helpHtml += '</span>';
    revenueHelpBlockHTML = helpHtml;
  }

  $: if (typeof revenueRateUSD !== 'undefined' || typeof revenuePeriodInputValue !== 'undefined' || typeof selectedRevenuePeriodForEdit !== 'undefined') {
    updateRevenueHelpBlockText();
  }

  const getError = (fieldName: string) => serverErrors?.errors?.[fieldName] || null;

  // Client-side validation flags
  let nameInvalid = false;
  let mobileInvalid = false;
  let emailInvalid = false;
  let revenueRateUSDInvalid = false;
  let revenuePeriodInputInvalid = false;

  // Individual validation functions
  function validateName() { nameInvalid = !(name && name.trim().length > 0); }
  function validateMobile() { mobileInvalid = !(mobile && mobile.trim().length > 0); }
  function validateEmail() { emailInvalid = !(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())); }
  function validateRevenueRateUSD() { revenueRateUSDInvalid = !(revenueRateUSD === '' || (typeof revenueRateUSD === 'number' && revenueRateUSD >= 0)); }
  function validateRevenuePeriodInput() {
    // Period is invalid if a rate is entered/cleared AND the period input itself is empty.
    revenuePeriodInputInvalid = !!((revenueRateUSD !== '' || (typeof revenueRateUSD === 'number' && revenueRateUSD === 0) /* explicitly 0 is also an entry */) && !revenuePeriodInputValue);
  }

</script>

<div class="max-w-7xl mx-auto">
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <!-- Form Header -->
    <div class="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-800">
          {#if partner && partner.id}
            Edit Partner
          {:else}
            Add New Partner
          {/if}
        </h2>
        {#if serverErrors?.message}
          <div class="px-4 py-2 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">
            {serverErrors.message}
          </div>
        {/if}
      </div>
    </div>

    <form method="POST" action={formAction} class="divide-y divide-gray-200">
      <!-- Partner Information Section -->
      <div class="px-6 py-5 space-y-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900 flex items-center">
            <Icon name="user" className="h-5 w-5 text-blue-500 mr-2" />
            Partner Details
          </h3>
          <p class="mt-1 text-sm text-gray-500">Basic information about the partner.</p>
        </div>

        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <!-- Name -->
          <div class="sm:col-span-2">
            <label for="form-name-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 required-label">
             
              Full Name
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-name-{partner?.id || 'add'}"
                name="name"
                bind:value={name}
                on:blur={validateName}
                required
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={nameInvalid || !!getError('name')}
                placeholder="John Doe"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="user" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {#if nameInvalid && !getError('name')}
              <p class="mt-2 text-sm text-red-600">Name is required.</p>
            {/if}
            {#if getError('name')}
              <p class="mt-2 text-sm text-red-600">{getError('name')}</p>
            {/if}
          </div>

          <!-- Mobile -->
          <div class="sm:col-span-2">
            <label for="form-mobile-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 required-label">
              Mobile
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-mobile-{partner?.id || 'add'}"
                name="mobile"
                bind:value={mobile}
                on:blur={validateMobile}
                required
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={mobileInvalid || !!getError('mobile')}
                placeholder="+1234567890"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="phone" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {#if mobileInvalid && !getError('mobile')}
              <p class="mt-2 text-sm text-red-600">Mobile is required.</p>
            {/if}
            {#if getError('mobile')}
              <p class="mt-2 text-sm text-red-600">{getError('mobile')}</p>
            {/if}
          </div>

          <!-- Email -->
          <div class="sm:col-span-2">
            <label for="form-email-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 required-label">
              Email
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-email-{partner?.id || 'add'}"
                name="email"
                type="email"
                bind:value={email}
                on:blur={validateEmail}
                required
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={emailInvalid || !!getError('email')}
                placeholder="partner@example.com"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="envelope" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {#if emailInvalid && !getError('email')}
              <p class="mt-2 text-sm text-red-600">Valid email is required.</p>
            {/if}
            {#if getError('email')}
              <p class="mt-2 text-sm text-red-600">{getError('email')}</p>
            {/if}
          </div>

          <!-- Address -->
          <div class="sm:col-span-2">
            <label for="form-address-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Address
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-address-{partner?.id || 'add'}"
                name="address"
                bind:value={address}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={!!getError('address')}
                placeholder="123 Main St"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="mapPin" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {#if getError('address')}
              <p class="mt-2 text-sm text-red-600">{getError('address')}</p>
            {/if}
          </div>

          <!-- Webmoney -->
          <div class="sm:col-span-2">
            <label for="form-webmoney-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Webmoney
            </label>
             <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-webmoney-{partner?.id || 'add'}"
                name="webmoney"
                bind:value={webmoney}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="currencyDollar" className="h-4 w-4 inline-block mr-1 text-gray-500" />
              </div>
            </div>
          </div>

          <!-- Multi Account No -->
          <div class="sm:col-span-2">
            <label for="form-multi_account_no-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Multi Account No
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-multi_account_no-{partner?.id || 'add'}"
                name="multi_account_no"
                bind:value={multi_account_no}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="currencyDollar" className="h-4 w-4 inline-block mr-1 text-gray-500" />
              </div>
            </div>
          </div>

          <!-- Adsterra Link -->
          <div class="sm:col-span-2">
            <label for="form-adstera_link-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Adsterra Link
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-adstera_link-{partner?.id || 'add'}"
                name="adstera_link"
                type="url"
                bind:value={adstera_link}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://..."
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="link" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <!-- Adsterra Email Link -->
          <div class="sm:col-span-2">
            <label for="form-adstera_email_link-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Adsterra Email
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-adstera_email_link-{partner?.id || 'add'}"
                name="adstera_email_link"
                type="url"
                bind:value={adstera_email_link}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://..."
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="link" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <!-- Adsterra API Key -->
          <div class="sm:col-span-2">
            <label for="form-adstera_api_key-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Adsterra API Key
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-adstera_api_key-{partner?.id || 'add'}"
                name="adstera_api_key"
                bind:value={adstera_api_key}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="api_key_..."
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="key" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <!-- Account Creation Date -->
          <div class="sm:col-span-2">
            <label for="form-account_creation-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Creation Date
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-account_creation-{partner?.id || 'add'}"
                name="account_creation"
                type="datetime-local"
                bind:value={account_creation_str}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="calendar" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <!-- Account Start Date -->
          <div class="sm:col-span-2">
            <label for="form-account_start-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-account_start-{partner?.id || 'add'}"
                name="account_start"
                type="datetime-local"
                bind:value={account_start_str}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="calendar" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Revenue Section -->
      <div class="px-6 py-5 space-y-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900 flex items-center">
            <Icon name="currencyDollar" className="h-5 w-5 text-blue-500 mr-2" />
            {#if partner && partner.id}Update/Add Revenue for Period{:else}Revenue Entry (Optional){/if}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            {#if partner && partner.id}
              Update existing revenue periods or add new ones.
            {:else}
              Add revenue information for this partner (can be added later).
            {/if}
          </p>
        </div>

        {#if partner && partner.id && availableRevenuePeriods.length > 0}
          <div class="sm:col-span-6">
            <label for="form-selectRevenuePeriodForEdit-{partner.id}" class="block text-sm font-medium text-gray-700">
              <Icon name="chevronDown" className="h-4 w-4 inline-block mr-1 text-gray-500" />
              Select Existing Period to Update/View
            </label>
            <div class="mt-1 relative">
              <select
                id="form-selectRevenuePeriodForEdit-{partner.id}"
                bind:value={selectedRevenuePeriodForEdit}
                on:change={handleRevenuePeriodSelectionForEdit}
                class="form-select block w-full pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">-- Select Period or Add New Below --</option>
                {#each availableRevenuePeriods as periodOpt (periodOpt)}
                  <option value={periodOpt}>{getMonthName(periodOpt)}</option>
                {/each}
              </select>
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="calendar" class="h-5 w-5 text-gray-400" />
              </div>
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Icon name="chevronDown" class="h-5 w-5 text-gray-400" />
              </div>
            </div>
            <p class="mt-2 text-sm text-gray-500 italic">
              The "Revenue Period" input below is the one that will be submitted. Use it to enter a new period or override your selection.
            </p>
          </div>
        {/if}

        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <!-- Revenue Period -->
          <div class="sm:col-span-2">
            <label for="form-revenuePeriod-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Revenue Period (YYYY-MM)
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-revenuePeriod-{partner?.id || 'add'}"
                name="revenuePeriod"
                type="month"
                bind:value={revenuePeriodInputValue}
                on:input={handleManualRevenuePeriodInputChange}
                on:blur={validateRevenuePeriodInput}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={revenuePeriodInputInvalid || !!getError('revenuePeriod')}
                placeholder="YYYY-MM"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="calendar" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {#if revenuePeriodInputInvalid && !getError('revenuePeriod')}
              <p class="mt-2 text-sm text-red-600">Period (YYYY-MM) required if rate is entered.</p>
            {/if}
            {#if getError('revenuePeriod')}
              <p class="mt-2 text-sm text-red-600">{getError('revenuePeriod')}</p>
            {/if}
          </div>

          <!-- Revenue Rate USD -->
          <div class="sm:col-span-2">
            <label for="form-revenueRateUSD-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Manual Revenue (USD)
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-revenueRateUSD-{partner?.id || 'add'}"
                name="revenueRateUSD"
                type="number"
                step="0.01"
                min="0"
                bind:value={revenueRateUSD}
                on:blur={validateRevenueRateUSD}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={revenueRateUSDInvalid || !!getError('revenueRateUSD')}
                placeholder="e.g., 15.50"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="currencyDollar" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div class="mt-1 min-h-[2.25rem] leading-tight">{@html revenueHelpBlockHTML}</div>
            {#if revenueRateUSDInvalid && !getError('revenueRateUSD')}
              <p class="mt-2 text-sm text-red-600">Must be a non-negative number.</p>
            {/if}
            {#if getError('revenueRateUSD')}
              <p class="mt-2 text-sm text-red-600">{getError('revenueRateUSD')}</p>
            {/if}
          </div>

          <!-- Payment Status -->
          <div class="sm:col-span-2">
            <label for="form-paymentStatus-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Payment Status (for Period)
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <select
                id="form-paymentStatus-{partner?.id || 'add'}"
                name="paymentStatus"
                bind:value={paymentStatus}
                class="form-select block w-full pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="pending">Pending / Update Soon</option>
                <option value="received">Received</option>
                <option value="not_received">Not Received</option>
              </select>
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="informationCircle" className="h-5 w-5 text-gray-400" />
              </div>
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Icon name="chevronDown" className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Footer -->
      <div class="px-6 py-4 bg-gray-50 text-right">
        <button
          type="submit"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <Icon name="check" class="h-5 w-5 mr-2" />
          {submitButtonText}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .required-label:after {
    content: " *";
    color: #ef4444;
  }
  
  .form-input, .form-select {
    transition: all 0.2s ease;
  }
  
  .form-input:focus, .form-select:focus {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }
  
  .form-input.border-red-500, .form-select.border-red-500 {
    border-color: #ef4444;
  }
  
  .form-input.border-red-500:focus, .form-select.border-red-500:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }
</style>