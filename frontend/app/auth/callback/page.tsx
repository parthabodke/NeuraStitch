// frontend/app/auth/callback/page.tsx
'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShieldAlert, CheckCircle } from 'lucide-react'
import posthog from 'posthog-js'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setStatus('error')
      setErrorMsg('No authorization code was returned from Google.')
      return
    }

    async function exchangeCode() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const response = await fetch(`${backendUrl}/api/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        })

        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.detail || 'Failed to exchange authorization token with backend.')
        }

        const data = await response.json()
        
        // Save auth metadata to browser storage
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user_email', data.user.email)
        localStorage.setItem('user_id', data.user.id)
        localStorage.setItem('is_premium', String(data.user.is_premium))

        // Identify user in PostHog
        try {
          posthog.identify(data.user.id, {
            email: data.user.email,
            is_premium: data.user.is_premium
          })
        } catch (phError) {
          console.error("Failed to identify user in PostHog:", phError)
        }

        setStatus('success')
        
        // Smooth transition redirect
        setTimeout(() => {
          router.push('/paid')
        }, 1200)

      } catch (err: any) {
        console.error('Google OAuth Exchange Error:', err)
        setStatus('error')
        setErrorMsg(err.message || 'An unexpected error occurred during Google authentication.')
      }
    }

    exchangeCode()
  }, [searchParams, router])

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden bg-[#070b13]">
      {/* Background Glowing Layers */}
      <div className="glowing-bg-layer" />
      <div className="glowing-bg-layer-secondary" />

      {/* Glassmorphic Panel */}
      <div className="w-full max-w-md p-8 rounded-2xl glass-panel relative z-10 border border-slate-800 text-center shadow-2xl">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center space-y-6 py-6">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
              <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Securing Session</h2>
              <p className="text-slate-400 text-sm">Exchanging credentials and establishing your encrypted secure tunnel...</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center justify-center space-y-6 py-6 animate-pulse">
            <div className="relative p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle className="w-16 h-16" />
              <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Access Granted</h2>
              <p className="text-slate-400 text-sm">Session initialized. Redirecting you to the workspace...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center space-y-6 py-6">
            <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-16 h-16" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Authentication Failed</h2>
              <p className="text-rose-400/80 text-sm mb-6">{errorMsg}</p>
              <button 
                onClick={() => router.push('/')}
                className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all border border-slate-700"
              >
                Return to Portal
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function GoogleAuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#070b13]">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
