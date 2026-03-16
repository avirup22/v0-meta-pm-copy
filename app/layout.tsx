import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/contexts/auth-context'
import { MabelModeProvider } from '@/contexts/mabel-mode-context'
import { AppSidebar } from '@/components/app-sidebar'
import { MabelModeToggle } from '@/components/mabel-mode-toggle'
import './globals.css'

const _jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400","500","600","700","800"] });
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: 'MetaPM – Project Manager',
  description: 'Manage all your projects in one place with MetaPM.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png',  media: '(prefers-color-scheme: dark)'  },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_jakarta.variable} ${_jetbrainsMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <MabelModeProvider>
            <div className="flex h-screen overflow-hidden">
              <AppSidebar />
              <main className="flex-1 overflow-y-auto bg-background relative">
                <div className="absolute top-4 left-4 z-50">
                  <MabelModeToggle />
                </div>
                {children}
              </main>
            </div>
          </MabelModeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
