export interface AdminMeta {
  name: string;
  initials: string;
}

export const adminMap: Record<string, AdminMeta> = {
  admin_identifier1: {
    name: 'Muhammad Fahim',
    initials: 'MF',
  },
  admin_identifier2: {
    name: 'Muhammad Rashid',
    initials: 'MR',
  },
  // Add more admins as needed
};
