// frontend/app/paid/page.tsx
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { 
  Key, 
  Send, 
  Sparkles, 
  Trash2, 
  Brain, 
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  GitBranch,
  Settings,
  Plus,
  CloudLightning,
  UploadCloud,
  DownloadCloud
} from 'lucide-react'
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Handle,
  Position
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { db, type LocalNode } from '../../lib/db'

const BACKEND_URL = 'http://localhost:8000'

// --- Custom React Flow Node Component ---
const CustomNode = ({ data }: any) => {
  const isSummary = data.role === 'system_summary'
  const isInteraction = data.role === 'interaction'

  if (isSummary) {
    return (
      <div className="p-4 rounded-xl border w-[350px] text-left glass-panel transition-all shadow-xl hover:scale-[1.02] border-amber-500/40 bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
        <Handle type="target" position={Position.Top} className="!bg-slate-500" />
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Topic Card
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Static</span>
        </div>
        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[180px] overflow-y-auto pr-1.5 custom-scrollbar italic font-serif text-amber-100/90">
          {data.content}
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
      </div>
    )
  }

  // Unified Interaction Node (Double Pane)
  return (
    <div className="rounded-xl border w-[360px] text-left glass-panel transition-all shadow-2xl hover:scale-[1.01] border-slate-700/50 bg-[#0c1220]/80 overflow-hidden">
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      
      {/* Top Panel - User Query */}
      <div className="p-4 bg-blue-950/20 border-b border-white/5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            User Query
          </span>
        </div>
        <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
          {data.user_content}
        </div>
      </div>

      {/* Bottom Panel - Assistant Response */}
      <div className="p-4 bg-purple-950/10">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
            AI Assistant
          </span>
          <span className="text-[9px] text-slate-500 font-mono">
            {data.assistant_model || data.user_model}
          </span>
        </div>
        
        {data.assistant_content ? (
          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
            {data.assistant_content}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 text-indigo-400 text-xs animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Thinking/Streaming response...</span>
          </div>
        )}
      </div>

      {/* Control Actions & Footer */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-950/40 border-t border-white/5">
        <button
          onClick={() => data.onBranch(data.id)}
          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition"
        >
          <GitBranch className="w-3 h-3" />
          Branch Here
        </button>
        <span className="text-[8px] text-slate-600 font-mono">
          {data.user_timestamp ? new Date(data.user_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  )
}

const nodeTypes = {
  customNode: CustomNode
}

export default function PaidPlayground() {
  const [stage, setStage] = useState<'wallet' | 'playground'>('wallet')
  
  // BYOK Credentials Keys
  const [openaiKey, setOpenaiKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [openrouterKey, setOpenrouterKey] = useState('')

  // Concealed visual eye flags
  const [showOpenai, setShowOpenai] = useState(false)
  const [showGemini, setShowGemini] = useState(false)
  const [showGroq, setShowGroq] = useState(false)
  const [showOpenrouter, setShowOpenrouter] = useState(false)

  // Sessions States
  const [sessionId, setSessionId] = useState('session-default')
  const [activeModel, setActiveModel] = useState('gemini-2.5-flash')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isSyncingModels, setIsSyncingModels] = useState(false)
  const [k, setK] = useState(4)
  const [lastN, setLastN] = useState(4)

  // Conversation Tree States
  const [activeBranchId, setActiveBranchId] = useState('main')
  const [activeLeafNodeId, setActiveLeafNodeId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedAssistantText, setStreamedAssistantText] = useState('')
  const [isCloudSyncing, setIsCloudSyncing] = useState(false)
  
  // Dual View States
  const [viewMode, setViewMode] = useState<'chat' | 'graph'>('chat')
  const [activePathMessages, setActivePathMessages] = useState<any[]>([])

  // React Flow viewports state hooks
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // --- Initialize Session ID & Credentials ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('NS_SESSION_ID') || `session-${Math.random().toString(36).substring(2, 7)}`
      setSessionId(savedSession)
      localStorage.setItem('NS_SESSION_ID', savedSession)

      setOpenaiKey(localStorage.getItem('NS_OPENAI_KEY') || '')
      setGeminiKey(localStorage.getItem('NS_GEMINI_KEY') || '')
      setGroqKey(localStorage.getItem('NS_GROQ_KEY') || '')
      setOpenrouterKey(localStorage.getItem('NS_OPENROUTER_KEY') || '')
    }
  }, [])

  // --- Fetch Available Models from local/dynamic keys ---
  const fetchAvailableModels = async (keysPayload: any) => {
    setIsSyncingModels(true)
    try {
      const res = await fetch(`${BACKEND_URL}/models`, {
        method: 'GET',
        headers: {
          'X-OpenAI-Key': keysPayload.openai,
          'X-Gemini-Key': keysPayload.gemini,
          'X-Groq-Key': keysPayload.groq,
          'X-Openrouter-Key': keysPayload.openrouter
        }
      })
      if (res.ok) {
        const data = await res.json()
        setAvailableModels(data.models || [])
        if (data.models && data.models.length > 0 && !data.models.includes(activeModel)) {
          setActiveModel(data.models[0])
        }
      }
    } catch (e) {
      console.error("Failed to query models from router:", e)
    } finally {
      setIsSyncingModels(false)
    }
  }

  // --- Proceed into visual playground sandbox ---
  const handleProceed = () => {
    localStorage.setItem('NS_OPENAI_KEY', openaiKey)
    localStorage.setItem('NS_GEMINI_KEY', geminiKey)
    localStorage.setItem('NS_GROQ_KEY', groqKey)
    localStorage.setItem('NS_OPENROUTER_KEY', openrouterKey)
    
    fetchAvailableModels({
      openai: openaiKey,
      gemini: geminiKey,
      groq: groqKey,
      openrouter: openrouterKey
    })
    
    setStage('playground')
  }

  // --- Node Branching Callback ---
  const handleBranchNode = useCallback((nodeId: string) => {
    setActiveLeafNodeId(nodeId)
    const branchName = `branch-${Math.random().toString(36).substring(2, 6)}`
    setActiveBranchId(branchName)
    alert(`Cloud active parent node set! Next prompt will branch dynamically in Neon Postgres.`)
  }, [])

  // --- Fetch visual tree coordinates from Neon backend ---
  const renderFlowGraph = useCallback(async () => {
    if (!sessionId) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/session/tree?session_id=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        
        // Inject the branch callback into visual node payload
        const updatedNodes = data.nodes.map((n: any) => ({
          ...n,
          data: {
            ...n.data,
            onBranch: handleBranchNode
          }
        }))
        
        setNodes(updatedNodes)
        setEdges(data.edges || [])
        
        // Set the active leaf node to the latest generated assistant node automatically if not set
        if (!activeLeafNodeId && data.nodes.length > 0) {
          const interactionNodes = data.nodes.filter((n: any) => n.data.role === 'interaction')
          if (interactionNodes.length > 0) {
            setActiveLeafNodeId(interactionNodes[interactionNodes.length - 1].id)
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch visual tree coordinates:", e)
    }
  }, [sessionId, activeLeafNodeId, handleBranchNode, setNodes, setEdges])

  // --- Update streaming text inside the active visual node locally ---
  useEffect(() => {
    if (isStreaming && streamedAssistantText) {
      setNodes(prevNodes => prevNodes.map(n => {
        if (n.data.role === 'interaction' && !n.data.db_assistant_id) {
          return {
            ...n,
            data: {
              ...n.data,
              assistant_content: streamedAssistantText
            }
          }
        }
        return n
      }))
    }
  }, [streamedAssistantText, isStreaming, setNodes])

  // --- Reconstruct standard vertical active path messages locally from React Flow states ---
  useEffect(() => {
    if (nodes.length === 0) {
      setActivePathMessages([])
      return
    }

    let leafId = activeLeafNodeId
    if (!leafId) {
      const interactionNodes = nodes.filter((n: any) => n.data.role === 'interaction')
      if (interactionNodes.length > 0) {
        leafId = interactionNodes[interactionNodes.length - 1].id
      }
    }

    if (!leafId) {
      setActivePathMessages([])
      return
    }

    // Build parent map from edges
    const parentMap = new Map<string, string>()
    edges.forEach((e: any) => {
      parentMap.set(e.target, e.source)
    })

    // Walk upstream
    const pathIds: string[] = []
    let currentId = leafId
    const visited = new Set<string>()

    while (currentId) {
      if (visited.has(currentId)) break
      visited.add(currentId)
      currentId = parentMap.get(currentId) || ''
    }

    pathIds.reverse()

    // Map IDs back to user/assistant chat bubble objects
    const nodesMap = new Map<string, any>(nodes.map((n: any) => [n.id, n]))
    const compiledPath: any[] = []

    pathIds.forEach(id => {
      const node = nodesMap.get(id)
      if (node) {
        const data = node.data
        if (data.role === 'system_summary') {
          compiledPath.push({
            id: data.id,
            role: 'system_summary',
            content: data.content,
            timestamp: data.timestamp
          })
        } else {
          compiledPath.push({
            id: data.db_user_id || `u-${data.id}`,
            role: 'user',
            content: data.user_content,
            model_used: data.user_model,
            timestamp: data.user_timestamp
          })
          if (data.assistant_content) {
            compiledPath.push({
              id: data.db_assistant_id || data.id,
              role: 'assistant',
              content: data.assistant_content,
              model_used: data.assistant_model,
              timestamp: data.assistant_timestamp
            })
          }
        }
      }
    })

    setActivePathMessages(compiledPath)
  }, [nodes, edges, activeLeafNodeId])

  // --- Fetch context graph on Mount/Session change ---
  useEffect(() => {
    if (sessionId && stage === 'playground') {
      renderFlowGraph()
    }
  }, [sessionId, stage, renderFlowGraph])

  // --- Manual Reset Action ---
  const handleManualReset = async () => {
    if (confirm("Wipe all relational and vector memories on the Cloud databases?")) {
      try {
        await fetch(`${BACKEND_URL}/reset?session_id=${sessionId}`, { method: 'POST' })
        setNodes([])
        setEdges([])
        setActiveLeafNodeId(null)
        setActiveBranchId('main')
        alert("Cloud databases successfully wiped!")
      } catch (e) {
        alert("Reset failed.")
      }
    }
  }

  // --- Premium Cloud Sync: Push local nodes to Neon Cloud ---
  const handleCloudPushSync = async () => {
    setIsCloudSyncing(true)
    try {
      const localNodes = await db.nodes.where('session_id').equals(sessionId).toArray()
      if (localNodes.length === 0) {
        alert("IndexedDB is empty for this session. Nothing to push.")
        return
      }

      const res = await fetch(`${BACKEND_URL}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Openrouter-Key': openrouterKey
        },
        body: JSON.stringify({
          session_id: sessionId,
          nodes: localNodes
        })
      })

      if (res.ok) {
        alert("IndexedDB branches successfully synced to Neon Postgres and Qdrant Cloud!")
        await renderFlowGraph()
      } else {
        alert("Cloud Push failed.")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsCloudSyncing(false)
    }
  }

  // --- Premium Cloud Sync: Pull trees from Neon Cloud to local IndexedDB ---
  const handleCloudPullSync = async () => {
    setIsCloudSyncing(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/sync/pull?session_id=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.nodes && data.nodes.length > 0) {
          // Clear and rewrite browser local database nodes
          await db.nodes.where('session_id').equals(sessionId).delete()
          for (const n of data.nodes) {
            await db.nodes.add(n)
          }
          alert(`Pulled ${data.nodes.length} message nodes successfully into browser IndexedDB!`)
        } else {
          alert("No cloud nodes found for this session.")
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsCloudSyncing(false)
    }
  }

  // --- Chat Submission and Cloud-Synced Streaming ---
  const handleSend = async () => {
    if (!input.trim() || isStreaming || !sessionId) return

    setIsStreaming(true)
    const userMessageContent = input.trim()
    setInput('')

    // We do NOT save local nodes immediately; instead, we post to the /chat API,
    // which writes the user message node to Neon Postgres, embeds to Qdrant,
    // runs RAG, and streams the assistant tokens back!
    setStreamedAssistantText('')
    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenAI-Key': openaiKey,
          'X-Gemini-Key': geminiKey,
          'X-Groq-Key': groqKey,
          'X-Openrouter-Key': openrouterKey
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_message: userMessageContent,
          active_model: activeModel,
          parent_node_id: activeLeafNodeId,
          branch_id: activeBranchId,
          k: k,
          last_n: lastN
        })
      })

      if (!response.body) throw new Error("Cloud stream returned blank body.")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantTextAccumulated = ''

      // Redraw UI instantly to fetch and display the User Node created by FastAPI
      await renderFlowGraph()

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6))
              if (data.chunk) {
                assistantTextAccumulated += data.chunk
                setStreamedAssistantText(assistantTextAccumulated)
              } else if (data.error) {
                assistantTextAccumulated += `\n[ERROR: ${data.error}]`
                setStreamedAssistantText(assistantTextAccumulated)
              }
            } catch (err) {
              // Ignore partial parsing boundaries
            }
          }
        }
      }
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6))
          if (data.chunk) {
            assistantTextAccumulated += data.chunk
            setStreamedAssistantText(assistantTextAccumulated)
          } else if (data.error) {
            assistantTextAccumulated += `\n[ERROR: ${data.error}]`
            setStreamedAssistantText(assistantTextAccumulated)
          }
        } catch (err) {
          // Ignore
        }
      }

      // Sync the visual graph viewport to render both the User Node and the final generated Assistant Node
      await renderFlowGraph()

      // Reset leaf node pointer to the new latest assistant node
      const dbRes = await fetch(`${BACKEND_URL}/api/session/tree?session_id=${sessionId}`)
      if (dbRes.ok) {
        const data = await dbRes.json()
        if (data.nodes.length > 0) {
          const assistNodes = data.nodes.filter((n: any) => n.data.role === 'assistant')
          if (assistNodes.length > 0) {
            setActiveLeafNodeId(assistNodes[assistNodes.length - 1].id)
          }
        }
      }

    } catch (e: any) {
      console.error(e)
      alert(`API Streaming Outage: ${e.message}`)
    } finally {
      setIsStreaming(false)
      setStreamedAssistantText('')
    }
  }

  // --- Form View ---
  if (stage === 'wallet') {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[#070b13] px-4 overflow-hidden">
        <div className="glowing-bg-layer" />
        <div className="glowing-bg-layer-secondary" />

        <div className="w-full max-w-xl p-8 rounded-2xl glass-panel relative z-10 animate-fade-in shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Key className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Premium Cloud Credentials Wallet</h2>
          </div>

          <p className="text-xs text-slate-400 mb-8 leading-relaxed">
            Configure your model API credentials. In <strong>Premium Cloud Sync</strong>, your visual conversation trees, vectors, and Topic Card Summaries are dynamically index-saved to our hosted Postgres and Qdrant servers.
          </p>

          <div className="space-y-6">
            {/* OpenRouter Key */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">OpenRouter API Key (Highly Recommended)</label>
              <div className="relative">
                <input
                  type={showOpenrouter ? 'text' : 'password'}
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                />
                <button type="button" onClick={() => setShowOpenrouter(!showOpenrouter)} className="absolute right-3.5 top-3 text-slate-500 hover:text-white transition">
                  {showOpenrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* OpenAI Key */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">OpenAI API Key</label>
              <div className="relative">
                <input
                  type={showOpenai ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                />
                <button type="button" onClick={() => setShowOpenai(!showOpenai)} className="absolute right-3.5 top-3 text-slate-500 hover:text-white transition">
                  {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Gemini Key */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Gemini API Key</label>
              <div className="relative">
                <input
                  type={showGemini ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                />
                <button type="button" onClick={() => setShowGemini(!showGemini)} className="absolute right-3.5 top-3 text-slate-500 hover:text-white transition">
                  {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Groq Key */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Groq API Key</label>
              <div className="relative">
                <input
                  type={showGroq ? 'text' : 'password'}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                />
                <button type="button" onClick={() => setShowGroq(!showGroq)} className="absolute right-3.5 top-3 text-slate-500 hover:text-white transition">
                  {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleProceed}
              className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/20 transition-all mt-8"
            >
              <Sparkles className="w-4 h-4" />
              Save Keys & Enter Cloud Platform
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Main Cloud Playground Canvas View ---
  return (
    <div className="relative h-screen flex flex-col bg-[#070b13] overflow-hidden select-none">
      
      {/* HEADER NAVBAR */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 glass-panel z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">NeuraStitch Premium Platform</h1>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[9px] font-semibold uppercase">CLOUD-SYNCED</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Branch: {activeBranchId}</span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle Switcher */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setViewMode('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'chat'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chat View
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'graph'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Graph Explorer
            </button>
          </div>
          
          {/* Active Model Selector */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value)}
              className="bg-transparent text-xs text-slate-200 border-none outline-none font-mono cursor-pointer"
            >
              {availableModels.length > 0 ? (
                availableModels.map(m => <option key={m} value={m} className="bg-[#0b0f19]">{m}</option>)
              ) : (
                <>
                  <option value="gemini-2.5-flash" className="bg-[#0b0f19]">gemini-2.5-flash</option>
                  <option value="gpt-4o-mini" className="bg-[#0b0f19]">gpt-4o-mini</option>
                  <option value="llama-3.1-8b-instant" className="bg-[#0b0f19]">llama-3.1-8b-instant</option>
                </>
              )}
            </select>
          </div>

          {/* Sync Controllers Testing Buttons */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
            <CloudLightning className={`w-3.5 h-3.5 ${isCloudSyncing ? 'text-purple-400 animate-bounce' : 'text-slate-500'}`} />
            <button onClick={handleCloudPushSync} className="text-[10px] text-slate-300 hover:text-white font-bold flex items-center gap-1">
              <UploadCloud className="w-3 h-3 text-indigo-400" /> Push
            </button>
            <span className="text-slate-700">|</span>
            <button onClick={handleCloudPullSync} className="text-[10px] text-slate-300 hover:text-white font-bold flex items-center gap-1">
              <DownloadCloud className="w-3 h-3 text-purple-400" /> Pull
            </button>
          </div>

          <button
            onClick={() => setStage('wallet')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition text-xs font-semibold flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            Wallet
          </button>

          {/* Reset Action */}
          <button
            onClick={handleManualReset}
            className="p-2 rounded-xl bg-white/5 hover:bg-red-950/20 border border-white/5 text-slate-400 hover:text-red-400 transition text-xs font-semibold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Wipe Cloud
          </button>
        </div>
      </header>

      {/* CORE WORKSPACE SECTION */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR - CLOUD DETAILS PANEL */}
        <aside className="w-72 border-r border-white/5 glass-panel flex flex-col p-4 z-10">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Cloud Session Parameters</h2>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Session ID</label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => {
                  setSessionId(e.target.value)
                  localStorage.setItem('NS_SESSION_ID', e.target.value)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-white text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">RAG Neighbors (K)</label>
              <input
                type="number"
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
                min="1"
                max="10"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-white text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">History Sliders (Last N)</label>
              <input
                type="number"
                value={lastN}
                onChange={(e) => setLastN(Number(e.target.value))}
                min="1"
                max="10"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Quick Info On Topic Condensation */}
          <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-950/5 text-slate-400 text-[10px] leading-relaxed">
            <span className="text-amber-400 font-bold flex items-center gap-1.5 uppercase mb-1.5">
              <Brain className="w-3.5 h-3.5" />
              Context Condensation Active
            </span>
            If the branch exceeds 8 raw messages, the backend Condenser will automatically summarize the oldest 4 turns into an chronological <strong>Topic Card</strong> (manifesting in gold on the tree!), pruning the raw database turns and Qdrant vector spaces to save token costs.
          </div>
        </aside>

        {/* REACT FLOW TREE CANVAS or SEQUENTIAL CHAT VIEW */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          {viewMode === 'graph' ? (
            <div className="flex-1 bg-[#05070c]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={1.5}
              >
                <Background color="#1f2937" gap={16} size={1} />
                <Controls className="!bg-slate-900 !border-white/5 !text-white" />
              </ReactFlow>
            </div>
          ) : (
            // Premium scrolling chat bubble interface
            <div className="flex-1 overflow-y-auto px-6 py-8 bg-[#05070c] space-y-6 scrollbar-thin">
              <div className="max-w-3xl mx-auto space-y-6">
                {activePathMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                      <Brain className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Start a new cloud branch</h3>
                    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                      Type your prompt below to start a brand new conversation branch. You can switch to the Graph Explorer at any time to visualize or fork branches!
                    </p>
                  </div>
                ) : (
                  activePathMessages.map((msg) => {
                    const isUser = msg.role === 'user'
                    const isSummary = msg.role === 'system_summary'
                    
                    if (isSummary) {
                      return (
                        <div key={msg.id} className="p-4 rounded-xl border border-amber-500/10 bg-amber-950/5 text-amber-300/90 text-xs italic font-serif leading-relaxed max-w-2xl mx-auto">
                          <span className="font-sans font-bold uppercase tracking-wider text-[9px] text-amber-400 block mb-1">Topic Card Summary</span>
                          {msg.content}
                        </div>
                      )
                    }

                    return (
                      <div key={msg.id} className={`flex flex-col space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                          <span>{msg.role === 'user' ? 'User' : msg.model_used || 'Assistant'}</span>
                          <span>•</span>
                          <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                        <div className={`p-4 rounded-2xl max-w-xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser 
                            ? 'bg-indigo-600/20 border border-indigo-500/20 text-slate-100 rounded-tr-none' 
                            : 'bg-slate-900/60 border border-white/5 text-slate-200 rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    )
                  })
                )}

                {/* Virtual streaming assistant node */}
                {isStreaming && streamedAssistantText && (
                  <div className="flex flex-col space-y-1.5 items-start animate-fade-in">
                    <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                      <span>{activeModel}</span>
                      <span>•</span>
                      <span className="text-indigo-400">Streaming...</span>
                    </div>
                    <div className="p-4 rounded-2xl max-w-xl text-sm leading-relaxed whitespace-pre-wrap bg-slate-900/60 border border-indigo-500/20 text-slate-200 rounded-tl-none shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                      {streamedAssistantText}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STREAMING STATUS PANEL */}
          {isStreaming && viewMode === 'graph' && (
            <div className="absolute top-4 left-4 max-w-md p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 glass-panel shadow-2xl z-10 animate-pulse">
              <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5 uppercase mb-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Streaming Cloud Tokens
              </span>
              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {streamedAssistantText || '...' }
              </p>
            </div>
          )}

          {/* INPUT FORM PANEL */}
          <div className="p-6 border-t border-white/5 glass-panel z-10">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type your prompt here... Enter branches visually using the nodes above."
                  className="w-full pl-4 pr-12 py-3.5 rounded-xl glass-input text-white text-sm"
                  disabled={isStreaming}
                />
                <button
                  onClick={handleSend}
                  className="absolute right-3 top-3 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                  disabled={isStreaming}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

        </main>

      </div>
    </div>
  )
}
