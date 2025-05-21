import { adminMap } from '$lib/config/adminMap';
import type { AdminMeta } from '$lib/config/adminMap';

export function getAdminName(admin: { id: string; name?: string }): string {
  return adminMap[admin.id]?.name || admin.name || admin.id;
}

export function getAdminInitials(admin: { id: string; name?: string }): string {
  if (adminMap[admin.id]) {
    return adminMap[admin.id].initials;
  }

  if (admin.name) {
    return admin.name
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  return admin.id.charAt(0).toUpperCase();
}
