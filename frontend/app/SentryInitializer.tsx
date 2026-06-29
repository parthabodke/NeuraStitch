'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/react'

export default function SentryInitializer() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn) {
      Sentry.init({
        dsn: dsn,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        // Performance Monitoring
        tracesSampleRate: 1.0,
        // Session Replay
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      })
      console.log("INFO: Sentry client initialized for frontend error tracking.")
    }
  }, [])

  return null
}
