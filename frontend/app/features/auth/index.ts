/**
 * circuit.rocks — auth feature barrel.
 *
 * CANONICAL barrel shape for a feature: export the pages (so the router can
 * import them), the context/provider, the public hooks, the shared
 * `meQueryOptions` (router `beforeLoad` guards), and the zod schemas + types.
 */

// Pages (imported by the router)
export { LoginPage } from "./pages/login-page";
export { RegisterPage } from "./pages/register-page";
export { LogoutPage } from "./pages/logout-page";

// Context
export { AuthProvider, useAuth } from "./auth-context";

// API (meQueryOptions is reused by the router's beforeLoad guards)
export { meQueryOptions, getMe, login, register, logout } from "./api/auth.api";

// Hooks
export { useMe } from "./hooks/use-me";
export { useLogin } from "./hooks/use-login";
export { useRegister } from "./hooks/use-register";
export { useLogout } from "./hooks/use-logout";

// Schemas + types
export {
  roleSchema,
  userSchema,
  meResponseSchema,
  authResponseSchema,
  loginSchema,
  registerSchema,
  isStaff,
  type Role,
  type User,
  type MeResponse,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
} from "./types/auth.types";
