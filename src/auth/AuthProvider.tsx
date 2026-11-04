"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AuthController, type GameAuth } from "./AuthController";
const Context = createContext<GameAuth | null>(null);
export function AuthProvider({ children, controller: supplied }: { children: ReactNode; controller?: AuthController }) {
  const [controller] = useState(() => supplied ?? new AuthController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.initialize(); }, [controller]);
  return <Context.Provider value={{ state, signIn: controller.signIn, signOut: controller.signOut,
    getAccessToken: controller.getAccessToken, requireReauthentication: controller.requireReauthentication }}>{children}</Context.Provider>;
}
export function useGameAuth(): GameAuth {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider가 필요합니다.");
  return auth;
}
