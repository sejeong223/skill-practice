"use client";
import { useEffect } from "react";
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
let response: Promise<void> | undefined;
export default function AuthRedirectPage() {
  useEffect(() => { response ??= broadcastResponseToMainFrame(); void response.catch(() => {}); }, []);
  return <p role="status">로그인 확인 중…</p>;
}
