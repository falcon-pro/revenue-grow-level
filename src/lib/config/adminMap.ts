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
   admin_identifier3: {
    name: 'Naila',
    initials: 'NA',
  },
  admin_identifier3: {
    name: 'Moshin',
    initials: 'NA',
  },
  // Add more admins as needed
};
