// Mock otplib for testing
export const authenticator = {
  generate: jest.fn((secret: string) => {
    // Generate a deterministic mock token based on secret
    const hash = secret
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return String(hash % 1000000).padStart(6, '0');
  }),

  verify: jest.fn((token: string, secret: string) => {
    const expectedToken = authenticator.generate(secret);
    return token === expectedToken;
  }),

  generateSecret: jest.fn(() => {
    return 'JBSWY3DPEHPK3PXP'.repeat(2); // 32 chars
  }),

  keyuri: jest.fn((user: string, service: string, secret: string) => {
    return `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(user)}?secret=${secret}&issuer=${encodeURIComponent(service)}`;
  }),
};

export const totp = {
  generate: authenticator.generate,
  verify: authenticator.verify,
};
