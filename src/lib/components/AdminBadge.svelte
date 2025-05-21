<script lang="ts">
  import { getAdminName, getAdminInitials } from '$lib/utils/adminUtils';

  export let admin: { id: string; name?: string };
</script>

<div class="flex items-center space-x-4">
  <div class="hidden sm:flex flex-col text-right">
    <span class="text-sm font-medium text-gray-700">{getAdminName(admin)}</span>
    <span class="text-xs text-gray-500">Administrator</span>
  </div>

  <div class="relative group">
    <button class="flex items-center focus:outline-none">
      <div class="h-9 w-9 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 flex items-center justify-center text-white font-medium text-xs">
        {getAdminInitials(admin)}
      </div>
    </button>

    <!-- Dropdown Menu -->
    <div class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-opacity-5 focus:outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform group-hover:translate-y-0 translate-y-1">
      <div class="py-1">
        <form method="POST" action="/logout">
          <button type="submit" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
            <svg class="mr-2 h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </div>
  </div>
</div>
