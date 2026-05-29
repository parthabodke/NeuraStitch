// frontend/app/page.tsx
'use client'

import React from 'react'
import Link from 'next/link'
import { 
  Sparkles, 
  Brain, 
  Database,
  ArrowRight,
  ShieldAlert,
  GitBranch,
  CloudLightning,
  Laptop
} from 'lucide-react'

export default function HomePortal() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden bg-[#070b13]">
      {/* Background Glowing Layers */}
      <div className="glowing-bg-layer" />
      <div className="glowing-bg-layer-secondary" />

      {/* Hero Header */}
      <div className="text-center max-w-3xl mb-12 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          The Future of Stateful Agent Memory
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent mb-6">
          NeuraStitch AI
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          The decoupled memory fabric and visual version-control canvas for enterprise AI agents. Plug in your own keys and explore infinite branches of thought.
        </p>
      </div>

      {/* Dual Playgrounds Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full z-10 px-2">
        
        {/* FREE TIER CARD */}
        <div className="group relative flex flex-col justify-between p-8 rounded-2xl glass-panel hover:border-indigo-500/30 transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Laptop className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                100% Free
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              B2C Free Playground
              <GitBranch className="w-5 h-5 text-indigo-400" />
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              A local-first, zero-privacy-risk sandbox. Your visual context tree paths and chat logs are stored entirely in your browser's IndexedDB. Calls are routed statelessly—no server database writes ever occur.
            </p>
            <ul className="space-y-2 mb-8 text-xs text-slate-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Saves visual conversation trees locally (IndexedDB)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Stateless SSE Token Streaming (/chat/stateless)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Dynamic credentials key wallet (BYOK)
              </li>
            </ul>
          </div>
          <Link href="/free" className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all">
            Enter Free Playground
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* PAID TIER CARD */}
        <div className="group relative flex flex-col justify-between p-8 rounded-2xl glass-panel hover:border-purple-500/30 transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <CloudLightning className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-semibold uppercase tracking-wider">
                Premium Sync
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              B2C Premium & Enterprise
              <Brain className="w-5 h-5 text-purple-400" />
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Cloud-synced memory virtualization. Syncs your visual branching trees dynamically into our cloud database, runs semantic similarity vectors in Qdrant, and operates the background Topic Condenser.
            </p>
            <ul className="space-y-2 mb-8 text-xs text-slate-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Neon Serverless PostgreSQL Database Syncing
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Automatic Topic Condenser Compaction & RAG
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Qdrant Cloud vector search integration
              </li>
            </ul>
          </div>
          <Link href="/paid" className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/20 transition-all">
            Enter Premium Platform
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="mt-16 text-center text-xs text-slate-600 z-10 flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5" />
        NeuraStitch AI Platform • Phase 1 Simulation Gateway
      </div>
    </div>
  )
}
