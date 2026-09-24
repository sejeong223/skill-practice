import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "짧은 다리의 역습: 전설의 왕갈비뼈를 찾아서",
  description: "코기의 생일을 훔쳐 간 냥아치 연합을 쫓는 억까 플랫폼 게임",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
