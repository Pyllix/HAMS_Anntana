// Mock otplib v13 for tests
export const generateSecret = jest.fn(() => 'JBSWY3DPEHPK3PXP'.repeat(2));

export const generateURI = jest.fn(
  ({
    issuer,
    label,
    secret,
  }: {
    issuer: string;
    label: string;
    secret: string;
  }) =>
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`,
);

export const generate = jest.fn(() => Promise.resolve('123456'));

export const verify = jest.fn(({ token }: { token: string }) =>
  Promise.resolve({
    valid: token === '123456',
    delta: token === '123456' ? 0 : null,
  }),
);
