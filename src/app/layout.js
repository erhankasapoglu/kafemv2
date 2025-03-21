// src/app/layout.js
import "./globals.css";
import Sidebar from "./sidebar";
import Providers from "./providers";

export const metadata = {
  title: "Kafem",
  description: "Kafem - Masa/Sipariş Yönetimi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-red-900">
        <Providers>
          <Sidebar>{children}</Sidebar>
        </Providers>
      </body>
    </html>
  );
}
