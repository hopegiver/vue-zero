export interface AuthConfig {
  enabled: boolean
  loginPage: string
  tokenKey: string
}

export class AuthGuard {
  private config: AuthConfig

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      loginPage: config.loginPage ?? '/login',
      tokenKey: config.tokenKey ?? 'token',
    }
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  /** localStorage token 존재 + 미만료 여부 */
  isAuthenticated(): boolean {
    try {
      const token = localStorage.getItem(this.config.tokenKey)
      if (!token) return false
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(this.config.tokenKey)
        return false
      }
      return true
    } catch {
      return false
    }
  }

  getLoginPage(): string {
    return this.config.loginPage
  }
}
