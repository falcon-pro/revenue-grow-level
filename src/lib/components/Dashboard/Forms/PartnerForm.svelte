<!-- src/lib/components/Dashboard/Forms/PartnerForm.svelte -->
<script lang="ts">
  import type { Database } from '../../../types/supabase';
  type PartnerRow = Database['public']['Tables']['partners']['Row'];

  import { onMount, tick, afterUpdate } from 'svelte';
  import { formatDateForInput, getMonthName } from '$lib/utils/helpers';
  import { formatCurrency } from '$lib/utils/formatters';
  import { PKR_RATE } from '$lib/utils/revenue';
  import Icon from '../../Icon.svelte'; // Assuming Icon.svelte is at src/lib/components/Icon.svelte

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
  let apify_accounts: number | '' = ''; // <<< --- NEW FIELD STATE ---
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

  async function initializeOrRepopulateForm() {
    await tick();
    const sourceData = serverErrors?.data || partner || {};

    name = sourceData.name ?? '';
    mobile = sourceData.mobile ?? '';
    email = sourceData.email ?? '';
    address = sourceData.address ?? '';
    webmoney = sourceData.webmoney ?? '';
    multi_account_no = sourceData.multi_account_no ?? '';
    apify_accounts = sourceData.apify_accounts !== undefined && sourceData.apify_accounts !== null ? Number(sourceData.apify_accounts) : ''; // <<< --- NEW FIELD ---
    adstera_link = sourceData.adstera_link ?? '';
    adstera_email_link = sourceData.adstera_email_link ?? '';
    adstera_api_key = sourceData.adstera_api_key ?? '';
    account_creation_str = sourceData.account_creation ? formatDateForInput(sourceData.account_creation) : '';
    account_start_str = sourceData.account_start ? formatDateForInput(sourceData.account_start) : '';

    const monthlyDataSource = partner?.monthly_revenue || {};
    if (partner?.id) {
        const monthlyDataActual = (monthlyDataSource || {}) as Record<string, any>;
        availableRevenuePeriods = Object.keys(monthlyDataActual).sort().reverse();
    } else {
        availableRevenuePeriods = [];
    }
    revenuePeriodInputValue = sourceData.revenuePeriod || '';
    selectedRevenuePeriodForEdit = sourceData.revenuePeriodFromSelect ||
                                   (partner?.id && availableRevenuePeriods.includes(revenuePeriodInputValue) ? revenuePeriodInputValue : '');
    if (serverErrors?.data && (serverErrors.action === formAction) ) {
        revenueRateUSD = serverErrors.data.revenueRateUSD !== undefined ? serverErrors.data.revenueRateUSD : '';
        paymentStatus = serverErrors.data.paymentStatus || 'pending';
    } else if (partner?.id && (selectedRevenuePeriodForEdit || revenuePeriodInputValue)) {
        handleRevenuePeriodSelectionForEdit();
    } else {
        revenueRateUSD = ''; paymentStatus = 'pending';
    }
    updateRevenueHelpBlockText();
  }

  export function resetForm() {
    name = ''; mobile = ''; email = ''; address = ''; webmoney = ''; multi_account_no = '';
    apify_accounts = ''; // <<< --- NEW FIELD RESET ---
    adstera_link = ''; adstera_email_link = ''; adstera_api_key = '';
    account_creation_str = ''; account_start_str = '';
    availableRevenuePeriods = []; selectedRevenuePeriodForEdit = '';
    revenuePeriodInputValue = ''; revenueRateUSD = ''; paymentStatus = 'pending';
    nameInvalid = false; mobileInvalid = false; emailInvalid = false;
    apifyAccountsInvalid = false; // <<< --- NEW VALIDATION FLAG ---
    revenueRateUSDInvalid = false; revenuePeriodInputInvalid = false;
    serverErrors = null;
    updateRevenueHelpBlockText();
    console.log('[PartnerForm.svelte] Form fields reset.');
  }

  onMount(() => { if (!partner && !serverErrors?.data) { resetForm(); } else { initializeOrRepopulateForm(); }});
  let prevPartnerId: string | null | undefined = partner?.id;
  let prevServerErrorsAction: string | null | undefined = serverErrors?.action;
  afterUpdate(() => { if (partner?.id !== prevPartnerId) { initializeOrRepopulateForm(); prevPartnerId = partner?.id; } if (serverErrors && serverErrors.action && serverErrors.action !== prevServerErrorsAction) { initializeOrRepopulateForm(); prevServerErrorsAction = serverErrors.action; } else if (!serverErrors && prevServerErrorsAction) { prevServerErrorsAction = null; }});

  function handleRevenuePeriodSelectionForEdit() { revenuePeriodInputValue = selectedRevenuePeriodForEdit; const currentPartnerData = serverErrors?.data || partner; if (currentPartnerData?.monthly_revenue && selectedRevenuePeriodForEdit) { const monthlyData = currentPartnerData.monthly_revenue as Record<string, any>; const entry = monthlyData[selectedRevenuePeriodForEdit]; if (entry) { revenueRateUSD = entry.usd ?? ''; paymentStatus = entry.status ?? 'pending'; } else { revenueRateUSD = ''; paymentStatus = 'pending'; } } else if (!selectedRevenuePeriodForEdit) { revenueRateUSD = ''; paymentStatus = 'pending'; } updateRevenueHelpBlockText(); }
  function handleManualRevenuePeriodInputChange() { if (partner?.id && availableRevenuePeriods.includes(revenuePeriodInputValue)) { selectedRevenuePeriodForEdit = revenuePeriodInputValue; handleRevenuePeriodSelectionForEdit(); } else { selectedRevenuePeriodForEdit = ''; revenueRateUSD = ''; paymentStatus = 'pending'; } updateRevenueHelpBlockText(); }
  function updateRevenueHelpBlockText() { let helpHtml = `<span class="text-xs text-gray-500">${pkrHelpText}`; const periodToConsider = revenuePeriodInputValue || selectedRevenuePeriodForEdit; const currentDataForHelp = serverErrors?.data || partner; if (partner?.id && periodToConsider && (currentDataForHelp?.monthly_revenue as Record<string, any>)?.[periodToConsider]) { const entry = (currentDataForHelp.monthly_revenue as Record<string, any>)[periodToConsider]; helpHtml += ` Editing for <strong>${getMonthName(periodToConsider)}</strong>. Current: ${formatCurrency(entry.usd ?? 0)} (${entry.status || 'N/A'}). Clearing USD amount will delete this period's entry.`; } else if (periodToConsider) { helpHtml += ` Adding new data for <strong>${getMonthName(periodToConsider)}</strong>.`; } else { helpHtml += ` Select or enter period (YYYY-MM) to add/update specific monthly revenue.`; } helpHtml += '</span>'; revenueHelpBlockHTML = helpHtml; }
  $: if (typeof revenueRateUSD !== 'undefined' || typeof revenuePeriodInputValue !== 'undefined' || typeof selectedRevenuePeriodForEdit !== 'undefined') { updateRevenueHelpBlockText(); }
  const getError = (fieldName: string) => serverErrors?.errors?.[fieldName] || null;

  let nameInvalid = false; let mobileInvalid = false; let emailInvalid = false;
  let apifyAccountsInvalid = false; // <<< --- NEW VALIDATION FLAG ---
  let revenueRateUSDInvalid = false; let revenuePeriodInputInvalid = false;

  function validateName() { nameInvalid = !(name && name.trim().length > 0); }
  function validateMobile() { mobileInvalid = !(mobile && mobile.trim().length > 0); }
  function validateEmail() { emailInvalid = !(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())); }
  function validateApifyAccounts() { // <<< --- NEW VALIDATION FUNCTION ---
    apifyAccountsInvalid = !(apify_accounts === '' || (typeof apify_accounts === 'number' && apify_accounts >= 0 && Number.isInteger(apify_accounts)));
  }
  function validateRevenueRateUSD() { revenueRateUSDInvalid = !(revenueRateUSD === '' || (typeof revenueRateUSD === 'number' && revenueRateUSD >= 0)); }
  function validateRevenuePeriodInput() { revenuePeriodInputInvalid = !!((revenueRateUSD !== '' || (typeof revenueRateUSD === 'number' && revenueRateUSD === 0) ) && !revenuePeriodInputValue); }
</script>

<div class="mx-auto">
  <div class="bg-white shadow rounded-lg overflow-hidden">
    {#if !partner || !partner.id}
    <div class="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-800">Add New Partner</h2>
        {#if serverErrors?.message && serverErrors.action === formAction}
          <div class="px-4 py-2 rounded-md {serverErrors.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'} border {serverErrors.success ? 'border-green-200' : 'border-red-200'} text-sm">
            {serverErrors.message}
          </div>
        {/if}
      </div>
    </div>
    {/if}

    <form method="POST" action={formAction} class="divide-y divide-gray-200">
      <div class="h-100 overflow-auto">
      <div class="px-6 py-5 space-y-6">
        <div> 
          <h3 class="text-lg font-medium text-gray-900 flex items-center"> <Icon name="user" className="h-5 w-5 text-blue-500 mr-2" /> Partner Details </h3> <p class="mt-1 text-sm text-gray-500">Basic information about the partner.</p> </div>
        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div class="sm:col-span-2"> <label for="form-name-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 required-label"> Full Name </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-name-{partner?.id || 'add'}" name="name" bind:value={name} on:blur={validateName} required class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" class:border-red-500={nameInvalid || !!getError('name')} placeholder="John Doe" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="user" className="h-5 w-5 text-gray-400" /> </div> </div> {#if nameInvalid && !getError('name')} <p class="mt-2 text-sm text-red-600">Name is required.</p> {/if} {#if getError('name')} <p class="mt-2 text-sm text-red-600">{getError('name')}</p> {/if} </div>
          <div class="sm:col-span-2"> <label for="form-mobile-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 required-label"> Mobile </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-mobile-{partner?.id || 'add'}" name="mobile" bind:value={mobile} on:blur={validateMobile} required class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" class:border-red-500={mobileInvalid || !!getError('mobile')} placeholder="+1234567890" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="phone" className="h-5 w-5 text-gray-400" /> </div> </div> {#if mobileInvalid && !getError('mobile')} <p class="mt-2 text-sm text-red-600">Mobile is required.</p> {/if} {#if getError('mobile')} <p class="mt-2 text-sm text-red-600">{getError('mobile')}</p> {/if} </div>
          <div class="sm:col-span-2"> <label for="form-email-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700 required-label"> Email </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-email-{partner?.id || 'add'}" name="email" type="email" bind:value={email} on:blur={validateEmail} required class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" class:border-red-500={emailInvalid || !!getError('email')} placeholder="partner@example.com" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="envelope" className="h-5 w-5 text-gray-400" /> </div> </div> {#if emailInvalid && !getError('email')} <p class="mt-2 text-sm text-red-600">Valid email is required.</p> {/if} {#if getError('email')} <p class="mt-2 text-sm text-red-600">{getError('email')}</p> {/if} </div>
          <div class="sm:col-span-2"> <label for="form-address-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Address </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-address-{partner?.id || 'add'}" name="address" bind:value={address} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" class:border-red-500={!!getError('address')} placeholder="123 Main St" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="mapPin" className="h-5 w-5 text-gray-400" /> </div> </div> {#if getError('address')} <p class="mt-2 text-sm text-red-600">{getError('address')}</p> {/if} </div>
          <div class="sm:col-span-2"> <label for="form-webmoney-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Webmoney </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-webmoney-{partner?.id || 'add'}" name="webmoney" bind:value={webmoney} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="currencyDollar" className="h-4 w-4 inline-block mr-1 text-gray-500" /> </div> </div> </div>
          <div class="sm:col-span-2"> <label for="form-multi_account_no-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Multi Acc No </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-multi_account_no-{partner?.id || 'add'}" name="multi_account_no" bind:value={multi_account_no} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="currencyDollar" className="h-4 w-4 inline-block mr-1 text-gray-500" /> </div> </div> </div>
          <div class="sm:col-span-2"> <label for="form-account_creation-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Creation Date </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-account_creation-{partner?.id || 'add'}" name="account_creation" type="datetime-local" bind:value={account_creation_str} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="calendar" className="h-5 w-5 text-gray-400" /> </div> </div> </div>
          <div class="sm:col-span-2"> <label for="form-account_start-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Start Date </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-account_start-{partner?.id || 'add'}" name="account_start" type="datetime-local" bind:value={account_start_str} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="calendar" className="h-5 w-5 text-gray-400" /> </div> </div> </div>
          
          <!-- <<< --- NEW APIFY ACCOUNTS FIELD (After Start Date, adjust sm:col-span if needed) --- >>> -->
          <div class="sm:col-span-2">
            <label for="form-apify_accounts-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">
              Apify Accounts
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="form-apify_accounts-{partner?.id || 'add'}"
                name="apify_accounts"
                type="number"
                min="0"
                step="1"
                bind:value={apify_accounts}
                on:blur={validateApifyAccounts}
                class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={apifyAccountsInvalid || !!getError('apify_accounts')}
                placeholder="e.g., 5"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="adjustmentsHorizontal" className="h-5 w-5 text-gray-400" /> 
              </div>
            </div>
            {#if apifyAccountsInvalid && !getError('apify_accounts')}
              <p class="mt-2 text-sm text-red-600">Must be a whole non-negative number.</p>
            {/if}
            {#if getError('apify_accounts')}
              <p class="mt-2 text-sm text-red-600">{getError('apify_accounts')}</p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Adsterra Information Section -->
      <div class="px-6 py-5 space-y-6">
        <div> <h3 class="text-lg font-medium text-gray-900 flex items-center"> <Icon name="globeAlt" className="h-5 w-5 text-blue-500 mr-2" /> Adsterra Details </h3> <p class="mt-1 text-sm text-gray-500">Adsterra specific information and API key.</p> </div>
        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div class="sm:col-span-2"> <label for="form-adstera_link-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Adsterra Link </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-adstera_link-{partner?.id || 'add'}" name="adstera_link" type="url" bind:value={adstera_link} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="https://..." /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="link" className="h-5 w-5 text-gray-400" /> </div> </div> </div>
          <div class="sm:col-span-2"> <label for="form-adstera_email_link-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Adsterra Email </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-adstera_email_link-{partner?.id || 'add'}" name="adstera_email_link" type="url" bind:value={adstera_email_link} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="https://..." /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="link" className="h-5 w-5 text-gray-400" /> </div> </div> </div>
          <div class="sm:col-span-2"> <label for="form-adstera_api_key-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700"> Adsterra API Key </label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-adstera_api_key-{partner?.id || 'add'}" name="adstera_api_key" bind:value={adstera_api_key} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="api_key_..." /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="key" className="h-5 w-5 text-gray-400" /> </div> </div> </div>
        </div>
      </div>

      <!-- Revenue Section -->
      <div class="px-6 py-5 space-y-6">
         <div> <h3 class="text-lg font-medium text-gray-900 flex items-center"> <Icon name="currencyDollar" className="h-5 w-5 text-blue-500 mr-2" /> {#if partner && partner.id}Update/Add Revenue for Period{:else}Revenue Entry (Optional){/if} </h3> <p class="mt-1 text-sm text-gray-500">{#if partner && partner.id}Update existing revenue or add for new periods.{:else}Add revenue for this partner.{/if}</p> </div>
        {#if partner && partner.id && availableRevenuePeriods.length > 0}
          <div class="sm:col-span-6"> <label for="form-selectRevenuePeriodForEdit-{partner.id}" class="block text-sm font-medium text-gray-700"> Select Existing Period </label> <div class="mt-1 relative"> <select id="form-selectRevenuePeriodForEdit-{partner.id}" bind:value={selectedRevenuePeriodForEdit} on:change={handleRevenuePeriodSelectionForEdit} class="form-select block w-full pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"> <option value="">-- Select or Add New Below --</option> {#each availableRevenuePeriods as periodOpt (periodOpt)} <option value={periodOpt}>{getMonthName(periodOpt)}</option> {/each} </select> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="calendar" className="h-5 w-5 text-gray-400" /> </div> <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"> <Icon name="chevronDown" className="h-5 w-5 text-gray-400" /> </div> </div> <p class="mt-2 text-sm text-gray-500 italic">Input in "Revenue Period" below overrides selection for submission.</p> </div>
        {/if}
        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div class="sm:col-span-2"> <label for="form-revenuePeriod-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">Revenue Period (YYYY-MM)</label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-revenuePeriod-{partner?.id || 'add'}" name="revenuePeriod" type="month" bind:value={revenuePeriodInputValue} on:input={handleManualRevenuePeriodInputChange} on:blur={validateRevenuePeriodInput} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" class:border-red-500={revenuePeriodInputInvalid || !!getError('revenuePeriod')} placeholder="YYYY-MM" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="calendar" className="h-5 w-5 text-gray-400" /> </div> </div> {#if revenuePeriodInputInvalid && !getError('revenuePeriod')} <p class="mt-2 text-sm text-red-600">Period required if rate entered.</p> {/if} {#if getError('revenuePeriod')} <p class="mt-2 text-sm text-red-600">{getError('revenuePeriod')}</p> {/if} </div>
          <div class="sm:col-span-2"> <label for="form-revenueRateUSD-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">Manual Revenue (USD)</label> <div class="mt-1 relative rounded-md shadow-sm"> <input id="form-revenueRateUSD-{partner?.id || 'add'}" name="revenueRateUSD" type="number" step="0.01" min="0" bind:value={revenueRateUSD} on:blur={validateRevenueRateUSD} class="form-input block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" class:border-red-500={revenueRateUSDInvalid || !!getError('revenueRateUSD')} placeholder="e.g., 15.50" /> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="currencyDollar" className="h-5 w-5 text-gray-400" /> </div> </div> <div class="mt-1 min-h-[2.25rem] leading-tight">{@html revenueHelpBlockHTML}</div> {#if revenueRateUSDInvalid && !getError('revenueRateUSD')} <p class="mt-2 text-sm text-red-600">Non-negative number required.</p> {/if} {#if getError('revenueRateUSD')} <p class="mt-2 text-sm text-red-600">{getError('revenueRateUSD')}</p> {/if} </div>
          <div class="sm:col-span-2"> <label for="form-paymentStatus-{partner?.id || 'add'}" class="block text-sm font-medium text-gray-700">Payment Status</label> <div class="mt-1 relative rounded-md shadow-sm"> <select id="form-paymentStatus-{partner?.id || 'add'}" name="paymentStatus" bind:value={paymentStatus} class="form-select block w-full pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"> <option value="pending">Pending</option> <option value="received">Received</option> <option value="not_received">Not Received</option> </select> <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Icon name="informationCircle" className="h-5 w-5 text-gray-400" /> </div> <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"> <Icon name="chevronDown" className="h-5 w-5 text-gray-400" /> </div> </div> </div>
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