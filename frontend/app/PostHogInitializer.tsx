'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

export default function PostHogInitializer() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
    if (key) {
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        capture_pageview: true,
        loaded: (ph) => {
          if (process.env.NODE_ENV === 'development') {
            ph.debug()
          }
        }
      })
      console.log("INFO: PostHog client initialized for frontend telemetry tracking.")
    }
  }, [])

  return null
}
