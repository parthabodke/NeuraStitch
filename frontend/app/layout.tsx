import './globals.css'
import type { Metadata } from 'next'
import SentryInitializer from './SentryInitializer'
import PostHogInitializer from './PostHogInitializer'

export const metadata: Metadata = {
  title: 'NeuraStitch AI - Stateful Context Bridge',
  description: 'Hot-swap AI models mid-conversation without losing long-term memories.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen relative overflow-x-hidden">
        <SentryInitializer />
        <PostHogInitializer />
        {/* Glow backgrounds */}
        <div className="glowing-bg-layer" />
        <div className="glowing-bg-layer-secondary" />
        {children}
      </body>
    </html>
  )
}
