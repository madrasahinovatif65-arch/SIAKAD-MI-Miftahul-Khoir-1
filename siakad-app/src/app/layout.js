import { Inter } from "next/font/google";
import "./globals.css";
import EyeCareMode from "@/components/EyeCareMode";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Inovatif+",
  description: "Madrasah Inovatif MI Miftahul Khoir 1 Karangrejo",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192-v2.png",
  },
  themeColor: "#064e3b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SIAKAD",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white font-[family-name:var(--font-inter)]">
        <AuthProvider>
          <EyeCareMode>
            {children}
            <div id="root-portal"></div>
          </EyeCareMode>
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('Service Worker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
