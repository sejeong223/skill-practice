import { InteractionRequiredAuthError, type IPublicClientApplication } from "@azure/msal-browser";
import { getMsalClient, loadAuthConfig, silentRedirectUri, tokenScopes, type AuthConfig } from "./msal";
export type AuthStatus = "initializing" | "signed-out" | "signing-in" | "signed-in" | "reauth-required" | "error";
export interface AuthState { status: AuthStatus; accountKey: string | null; error: string | null }
export interface GameAuth {
  state: AuthState; signIn(): Promise<void>; signOut(): Promise<void>;
  getAccessToken(forceRefresh?: boolean): Promise<string>; requireReauthentication(): void;
}
export class AuthController {
  private state: AuthState = { status: "initializing", accountKey: null, error: null };
  private listeners = new Set<() => void>();
  private initialization?: Promise<void>;
  private client?: IPublicClientApplication;
  private config?: AuthConfig;
  private epoch = 0;
  constructor(private readonly configLoader = loadAuthConfig, private readonly clientLoader = getMsalClient) {}
  getSnapshot = (): AuthState => this.state;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  private set(state: AuthState) { this.state = state; this.listeners.forEach(listener => listener()); }
  initialize = (): Promise<void> => this.initialization ??= (async () => {
    try {
      this.config = this.configLoader(); this.client = await this.clientLoader(this.config);
      const account = this.client.getActiveAccount();
      this.set({ status: account ? "signed-in" : "signed-out", accountKey: account ? account.homeAccountId + ":" + account.tenantId : null, error: null });
    } catch { this.set({ status: "error", accountKey: null, error: "로그인을 준비하지 못했습니다. 연결과 앱 설정을 확인한 뒤 다시 시도해 주세요." }); }
  })();
  signIn = async (): Promise<void> => {
    if (this.state.status === "signing-in" || this.state.status === "initializing") return;
    if (!this.client || !this.config) { this.initialization = undefined; await this.initialize(); }
    if (!this.client || !this.config) return;
    this.epoch++;
    this.set({ status: "signing-in", accountKey: null, error: null });
    try { await this.client.loginRedirect({ scopes: tokenScopes(this.config), prompt: "select_account" }); }
    catch { this.set({ status: "signed-out", accountKey: null, error: "로그인이 취소되었거나 연결에 실패했습니다. 다시 로그인해 주세요." }); }
  };
  requireReauthentication = (): void => this.set({ ...this.state, status: "reauth-required", error: "로그인을 다시 확인해 주세요." });
  getAccessToken = async (forceRefresh = false): Promise<string> => {
    const client = this.client, config = this.config, account = client?.getActiveAccount(), epoch = this.epoch;
    if (!client || !config || !account || account.tenantId.toLowerCase() !== config.tenantId || this.state.status !== "signed-in") throw new Error("로그인이 필요합니다.");
    try {
      const result = await client.acquireTokenSilent({ account, scopes: tokenScopes(config), forceRefresh, redirectUri: silentRedirectUri(config) });
      if (epoch !== this.epoch || client.getActiveAccount()?.homeAccountId !== account.homeAccountId ||
          client.getActiveAccount()?.tenantId !== account.tenantId) throw new DOMException("계정이 변경되었습니다.", "AbortError");
      if (!result.accessToken) throw new Error("액세스 토큰을 받지 못했습니다.");
      return result.accessToken;
    } catch (error) {
      if (epoch === this.epoch && (error instanceof InteractionRequiredAuthError ||
          error instanceof Error && error.name === "InteractionRequiredAuthError")) this.requireReauthentication();
      throw error;
    }
  };
  signOut = async (): Promise<void> => {
    const client = this.client, account = client?.getActiveAccount();
    this.epoch++;
    this.set({ status: "signed-out", accountKey: null, error: null });
    if (!client) return;
    client.setActiveAccount(null);
    try { await client.logoutRedirect({ account: account ?? undefined, postLogoutRedirectUri: this.config?.redirectUri }); }
    catch { this.set({ status: "signed-out", accountKey: null, error: "앱에서 로그아웃했습니다. Microsoft 로그아웃 연결을 다시 확인해 주세요." }); }
  };
}
