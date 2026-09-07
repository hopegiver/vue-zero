export interface AuthConfig {
  enabled: boolean
  loginPage: string
  tokenKey: string
}

// JWT payload는 base64url(RFC 7519)이라 '-'/'_'가 섞이면 atob()가 그대로 실패한다.
function b64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
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
      const payload = JSON.parse(b64urlDecode(token.split('.')[1]))
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
