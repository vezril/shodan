import type { ReactNode } from "react";

export const metadata = {
  title: "shodan — recon console",
  description: "Self-hosted WiFi recon console (cockpit)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
