import { PublicClientApplication, type Configuration, type IPublicClientApplication } from "@azure/msal-browser";
export interface AuthConfig { tenantId: string; webClientId: string; apiClientId: string; redirectUri: string }
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function loadAuthConfig(env = {
  tenant: process.env.NEXT_PUBLIC_GAME_TENANT_ID, web: process.env.NEXT_PUBLIC_GAME_WEB_CLIENT_ID,
  api: process.env.NEXT_PUBLIC_GAME_API_CLIENT_ID, redirect: process.env.NEXT_PUBLIC_GAME_REDIRECT_URI,
}): AuthConfig {
  if (![env.tenant, env.web, env.api].every(id => id && guid.test(id) && !/^0{8}-/.test(id))) throw new Error("로그인 설정을 확인해 주세요.");
  let uri: URL;
  try { uri = new URL(env.redirect ?? ""); } catch { throw new Error("로그인 복귀 주소를 확인해 주세요."); }
  if (!(uri.protocol === "https:" || uri.href === "http://localhost:3000/") || uri.pathname !== "/" || uri.search || uri.hash || uri.username || uri.password ||
      typeof window !== "undefined" && window.location.origin !== uri.origin) throw new Error("로그인 복귀 주소를 확인해 주세요.");
  return { tenantId: env.tenant!.toLowerCase(), webClientId: env.web!.toLowerCase(), apiClientId: env.api!.toLowerCase(), redirectUri: uri.href };
}
export function gameMode(mode = process.env.NEXT_PUBLIC_GAME_MODE, environment = process.env.NODE_ENV): "local-dev" | "cloud" {
  return mode === "local-dev" && environment === "development" ? "local-dev" : "cloud";
}
export const tokenScopes = (config: AuthConfig) => ["api://" + config.apiClientId + "/access_as_user"];
export const silentRedirectUri = (config: AuthConfig) => new URL("auth/redirect/", config.redirectUri).href;
export function createMsalClientLoader(factory: (config: Configuration) => IPublicClientApplication = config => new PublicClientApplication(config)) {
  const clients = new Map<string, Promise<IPublicClientApplication>>();
  return (config: AuthConfig): Promise<IPublicClientApplication> => {
    const key = JSON.stringify(config);
    let promise = clients.get(key);
    if (!promise) {
      promise = (async () => {
        const client = factory({ auth: { clientId: config.webClientId, authority: "https://login.microsoftonline.com/" + config.tenantId,
          redirectUri: config.redirectUri, postLogoutRedirectUri: config.redirectUri }, cache: { cacheLocation: "sessionStorage" } });
        await client.initialize();
        const result = await client.handleRedirectPromise();
        const accounts = client.getAllAccounts().filter(a => a.tenantId.toLowerCase() === config.tenantId);
        const chosen = result?.account?.tenantId.toLowerCase() === config.tenantId ? result.account :
          client.getActiveAccount()?.tenantId.toLowerCase() === config.tenantId ? client.getActiveAccount() : accounts.length === 1 ? accounts[0] : null;
        client.setActiveAccount(chosen);
        return client;
      })();
      clients.set(key, promise);
      void promise.catch(() => clients.delete(key));
    }
    return promise;
  };
}
export const getMsalClient = createMsalClientLoader();
