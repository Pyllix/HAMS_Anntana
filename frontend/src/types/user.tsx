export type UserRole = "admin" | "pharmacist" | "nurse" | "doctor" | null

export interface User {
  id: string
  name: string
  email: string
}

export interface LoginPayload {
  user: User
  token: string
  role: UserRole
}

export  interface AuthState {
  user: User | null
  token: string | null
  role: UserRole
  isAuthenticated: boolean
  login: (userData: LoginPayload) => void
  logout: () => void
}