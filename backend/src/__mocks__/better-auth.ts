export const betterAuth = jest.fn().mockReturnValue({});
export const prismaAdapter = jest.fn();
export const openAPI = jest.fn();
export const bearer = jest.fn();
export const admin = jest.fn();

// Mock for better-auth/plugins/access (all better-auth/* routes here via moduleNameMapper)
export const createAccessControl = jest.fn().mockReturnValue({
  newRole: jest.fn().mockReturnValue({}),
});
