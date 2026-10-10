import { originalUsers } from '../demo-identities';

const originalKeys: Record<string, string> = {
  admin: 'admin',
  admin_backup: 'admin-backup',
  manager: 'manager',
  assetcenter: 'center',
  parcel: 'parcel',
  parcel2: 'parcel-enroll',
  head_maintenance: 'head',
  maintenance: 'tech-a',
  mech_bio1: 'tech-b',
  mech_bio2: 'tech-idle',
  deptstaff_icu: 'icu',
  deptstaff_icu2: 'icu-peer',
  deptstaff_er: 'er',
};
export const originalPresentationUsers = originalUsers.map((profile) => ({
  key: originalKeys[profile.userName] ?? profile.userName,
  profile,
}));
export const originalProfile = (key: string) =>
  originalPresentationUsers.find((user) => user.key === key)?.profile;

export const originalUserPreparation = [
  'Enroll 2FA for admin, admin_backup, assetcenter and parcel through the real authentication flow.',
  'Use parcel2 for first-enrollment demonstrations; use separate browser profiles and real trusted-browser cookies.',
  'Asset images use public sample URLs. Upload/attach real images only when presenting the upload feature; employee photos still require their protected image workflow. No image credentials, secrets, sessions or recovery codes are embedded in this manifest.',
  'Check SMTP/Mailpit and Gemini connectivity before presenting. Business fixtures do not prove frontend or external-service readiness.',
];
