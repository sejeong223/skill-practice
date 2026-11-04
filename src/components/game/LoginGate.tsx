"use client";
import type { ReactNode } from "react";
import { useGameAuth } from "../../auth/AuthProvider";
export function LoginGate({ children }: { children: ReactNode }) {
  const { state, signIn } = useGameAuth();
  if (state.status === "signed-in") return <>{children}</>;
  const waiting = state.status === "initializing" || state.status === "signing-in";
  return <main className="flex min-h-screen items-center justify-center bg-stone-950 p-6 text-stone-100">
    <section className="w-full max-w-md rounded-3xl border border-amber-200/20 bg-stone-900 p-8 text-center" aria-labelledby="login-title">
      <p className="mb-3 text-sm text-amber-200">짧은 다리의 역습</p>
      <h1 id="login-title" className="mb-4 text-2xl font-bold">전설의 왕갈비뼈를 찾아서</h1>
      <p className="mb-6 text-stone-300">조직 계정으로 로그인하고 이어서 모험하세요.</p>
      {state.error && <p role="alert" className="mb-4 text-amber-200">{state.error}</p>}
      {waiting ? <p role="status">{state.status === "initializing" ? "로그인 확인 중…" : "Microsoft 로그인으로 이동 중…"}</p> :
        <button type="button" onClick={() => void signIn()} className="rounded-xl bg-amber-200 px-6 py-3 font-bold text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
          {state.status === "reauth-required" ? "다시 로그인" : "Microsoft 계정으로 로그인"}
        </button>}
    </section>
  </main>;
}
