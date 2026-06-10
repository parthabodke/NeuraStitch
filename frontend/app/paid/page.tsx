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
  DownloadCloud,
  Pin,
  Copy,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Folder,
  BookOpen
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
          <div className="flex items-center gap-2">
            {data.is_pinned && (
              <span className="flex items-center gap-0.5 text-purple-400" title="Pinned Context">
                <Pin className="w-3 h-3 fill-purple-400" />
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-mono">Static</span>
          </div>
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
    <div className={`rounded-xl border w-[360px] text-left glass-panel transition-all shadow-2xl hover:scale-[1.01] overflow-hidden ${
      data.isActive ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)] bg-[#0e1c2e]/90' : 'border-slate-700/50 bg-[#0c1220]/80'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      
      {/* Top Panel - User Query */}
      <div className="p-4 bg-blue-950/20 border-b border-white/5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            User Query
          </span>
          <div className="flex items-center gap-1.5">
            {data.isActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                Active Target
              </span>
            )}
            {data.is_pinned && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Pin className="w-2.5 h-2.5 fill-purple-400 animate-pulse" />
                Pinned
              </span>
            )}
          </div>
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
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => data.onBranch(data.id)}
            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition cursor-pointer"
          >
            <GitBranch className="w-3 h-3" />
            Branch Here
          </button>
          
          {data.onPin && (
            <button
              onClick={() => data.onPin(data.id, data.db_user_id, data.db_assistant_id, !!data.is_pinned)}
              className={`inline-flex items-center gap-1 text-[10px] font-bold transition cursor-pointer ${
                data.is_pinned 
                  ? 'text-purple-400 hover:text-purple-300' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Pin className="w-3 h-3" />
              {data.is_pinned ? 'Unpin' : 'Pin Context'}
            </button>
          )}

          {data.onExportJSON && (
            <button
              onClick={() => data.onExportJSON(data.id, data.db_user_id, data.db_assistant_id)}
              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 hover:font-bold transition cursor-pointer"
              title="Copy lineage to clipboard as Chat Completion JSON array"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy JSON
            </button>
          )}
        </div>
        
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'pins'>('sessions')

  const [stage, setStage] = useState<'wallet' | 'playground' | 'auth'>('auth')
  const [token, setToken] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')


  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const [settingsShareMemory, setSettingsShareMemory] = useState(true)
  const [settingsAboutUser, setSettingsAboutUser] = useState('')
  const [settingsResponseStyle, setSettingsResponseStyle] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [userProfile, setUserProfile] = useState<any>({
    biographical: {},
    professional: { skills: [] },
    interests: { likes: [], dislikes: [], topics: [] },
    other_notes: []
  })
  
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
  const [cloudSessions, setCloudSessions] = useState<{id: string, title: string, last_active: string | null}[]>([])
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
  const [viewMode, setViewMode] = useState<'chat' | 'graph'>('graph')
  const [activePathMessages, setActivePathMessages] = useState<any[]>([])

  // React Flow viewports state hooks
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([])

  // Helper to jump/focus React Flow or scroll Chat View to a specific node
  const handleJumpToNode = useCallback((nodeId: string) => {
    setActiveLeafNodeId(nodeId)
    setNodes(prev => prev.map(n => ({
      ...n,
      selected: n.id === nodeId
    })))
    
    setTimeout(() => {
      const graphEl = document.querySelector(`[data-id="${nodeId}"]`)
      if (graphEl) {
        graphEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        return
      }
      
      const chatEl = document.getElementById(nodeId)
      if (chatEl) {
        chatEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  }, [setNodes])

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setActiveLeafNodeId(node.id)
  }, [])

  // Sync active Leaf node state dynamically across React Flow nodes data
  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      data: {
        ...n.data,
        isActive: n.id === activeLeafNodeId
      }
    })))
  }, [activeLeafNodeId, setNodes])

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

      const savedToken = localStorage.getItem('token')
      if (savedToken) {
        setToken(savedToken)
        setStage('wallet')
      } else {
        setStage('auth')
      }
    }
  }, [])

  // --- Fetch Cloud Sessions List ---
  const fetchCloudSessions = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/session/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setCloudSessions(data)
        
        // Auto-select latest active session if the current one is default/empty
        const currentSaved = localStorage.getItem('NS_SESSION_ID')
        if (data.length > 0 && (!currentSaved || currentSaved === 'session-default')) {
          setSessionId(data[0].id)
          localStorage.setItem('NS_SESSION_ID', data[0].id)
        }
      }
    } catch (e) {
      console.error("Failed to fetch cloud sessions:", e)
    }
  }, [token])

  // --- Create New Cloud Session ---
  const handleCreateCloudSession = () => {
    const newId = `session-${Math.random().toString(36).substring(2, 9)}`
    setSessionId(newId)
    localStorage.setItem('NS_SESSION_ID', newId)
    setActiveLeafNodeId(null)
    setActiveBranchId('main')
    
    // Prepend a temporary session entry so it shows in the sidebar list immediately
    setCloudSessions(prev => [
      {
        id: newId,
        title: `New Session (${newId.substring(8, 13)})`,
        last_active: new Date().toISOString()
      },
      ...prev
    ])
  }

  // --- Delete Cloud Session ---
  const handleDeleteCloudSession = async (targetSessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Delete this cloud session and all its conversation branches?")) {
      try {
        const res = await fetch(`${BACKEND_URL}/reset?session_id=${targetSessionId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (res.ok) {
          const list = cloudSessions.filter(s => s.id !== targetSessionId)
          setCloudSessions(list)
          if (sessionId === targetSessionId) {
            if (list.length > 0) {
              setSessionId(list[0].id)
              localStorage.setItem('NS_SESSION_ID', list[0].id)
            } else {
              handleCreateCloudSession()
            }
          }
          showToast("Cloud session successfully deleted!", "success")
        } else {
          showToast("Delete failed.", "error")
        }
      } catch (err) {
        showToast("Error deleting cloud session.", "error")
      }
    }
  }

  // --- Fetch cloud sessions list when stage is playground ---
  useEffect(() => {
    if (stage === 'playground' && token) {
      fetchCloudSessions()
      fetchUserFacts()
    }
  }, [stage, token, fetchCloudSessions])

  // --- Fetch User Personalization Settings ---
  const fetchUserSettings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setSettingsShareMemory(data.share_profile_memory)
        setSettingsAboutUser(data.about_user)
        setSettingsResponseStyle(data.response_style)
      }
    } catch (e) {
      console.error("Failed to fetch user settings:", e)
    }
  }

  const fetchUserFacts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/facts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setUserProfile(data)
      }
    } catch (e) {
      console.error("Failed to fetch user profile:", e)
    }
  }

  const handleDeleteProfileItem = async (category: string, value: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/facts/item?category=${encodeURIComponent(category)}&value=${encodeURIComponent(value)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        fetchUserFacts()
        showToast(`"${value}" removed from memory vault.`, "success")
      } else {
        showToast("Failed to delete memory item.", "error")
      }
    } catch (e) {
      showToast("Error deleting memory item.", "error")
    }
  }

  const isProfileEmpty = () => {
    if (!userProfile) return true;
    const hasBio = Object.values(userProfile.biographical || {}).some(v => v);
    const hasProf = userProfile.professional?.role || userProfile.professional?.operating_system || (userProfile.professional?.skills?.length > 0);
    const hasInterests = (userProfile.interests?.likes?.length > 0) || (userProfile.interests?.dislikes?.length > 0) || (userProfile.interests?.topics?.length > 0);
    const hasOther = userProfile.other_notes?.length > 0;
    return !(hasBio || hasProf || hasInterests || hasOther);
  }

  // --- Trigger settings fetch when settings modal is opened ---
  useEffect(() => {
    if (token && showSettingsModal) {
      fetchUserSettings()
      fetchUserFacts()
    }
  }, [token, showSettingsModal])

  // --- Save User Settings ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          share_profile_memory: settingsShareMemory,
          about_user: settingsAboutUser,
          response_style: settingsResponseStyle
        })
      })
      if (res.ok) {
        showToast("Personalization settings saved successfully!", "success")
        setShowSettingsModal(false)
      } else {
        showToast("Failed to save settings.", "error")
      }
    } catch (e) {
      showToast("Error saving settings.", "error")
    } finally {
      setIsSavingSettings(false)
    }
  }

  // --- Authentication Sign Out ---
  const handleLogout = () => {
    if (confirm("Are you sure you want to log out from this session?")) {
      localStorage.removeItem('token')
      localStorage.removeItem('user_email')
      localStorage.removeItem('user_id')
      localStorage.removeItem('is_premium')
      setToken(null)
      setShowSettingsModal(false)
      setStage('auth')
    }
  }

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

  // --- Authentication Submit Handler ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    const url = authMode === 'login' ? `${BACKEND_URL}/api/auth/login` : `${BACKEND_URL}/api/auth/register`
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Authentication failed.')
      }
      
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user_email', data.user.email)
      localStorage.setItem('user_id', data.user.id)
      setToken(data.access_token)
      setStage('wallet')
    } catch (err: any) {
      setAuthError(err.message || 'Server error.')
    }
  }

  // --- Redirect to Google Identity OAuth endpoint ---
  const handleGoogleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1013778235222-placeholder.apps.googleusercontent.com'
    const redirectUri = 'http://localhost:3000/auth/callback'
    const scope = 'email profile'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scope)}`
    window.location.href = authUrl
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
    showToast("Active parent node set! Next prompt will branch dynamically.", "info")
  }, [])

  // --- Fetch visual tree coordinates from Neon backend ---
  const renderFlowGraph = useCallback(async () => {
    if (!sessionId) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/session/tree?session_id=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        
        // Inject the callbacks into visual node payload
        const updatedNodes = data.nodes.map((n: any) => ({
          ...n,
          data: {
            ...n.data,
            onBranch: handleBranchNode,
            onPin: handlePinNode,
            onExportJSON: handleExportJSON,
            isActive: n.id === activeLeafNodeId
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

  // --- Pin/Unpin Node Callback ---
  const handlePinNode = useCallback(async (visualNodeId: string, dbUserId: string | null, dbAssistantId: string | null, isCurrentlyPinned: boolean) => {
    const targetDbId = dbAssistantId || dbUserId
    if (!targetDbId) return
    
    try {
      const endpoint = isCurrentlyPinned ? 'unpin' : 'pin'
      const res = await fetch(`${BACKEND_URL}/api/message/${targetDbId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        renderFlowGraph()
        
        // Notify user if pin count reaches 3
        if (!isCurrentlyPinned) {
          const currentlyPinned = activePathMessages.filter(m => m.is_pinned).length
          if (currentlyPinned + 1 === 3) {
            showToast("⚠️ You have reached your limit of 3 pinned messages along this branch lineage.", "info")
          } else {
            showToast("Message pinned to active path.", "success")
          }
        } else {
          showToast("Message unpinned from active path.", "success")
        }
      } else {
        const errData = await res.json()
        showToast(errData.detail || `Failed to ${isCurrentlyPinned ? 'unpin' : 'pin'} message.`, "error")
      }
    } catch (e) {
      showToast("Error updating pin status.", "error")
    }
  }, [token, renderFlowGraph, activePathMessages])

  // --- Export node branch path as Chat Completion JSON Callback ---
  const handleExportJSON = useCallback(async (visualNodeId: string, dbUserId: string | null, dbAssistantId: string | null) => {
    const targetDbId = dbAssistantId || dbUserId
    if (!targetDbId) return
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/message/${targetDbId}/export-json`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const payload = await res.json()
        const formattedJSON = JSON.stringify(payload, null, 2)
        await navigator.clipboard.writeText(formattedJSON)
        showToast("Branch history JSON payload copied to clipboard!", "success")
      } else {
        showToast("Failed to export branch JSON.", "error")
      }
    } catch (e) {
      showToast("Error exporting JSON: " + e, "error")
    }
  }, [token])

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
      pathIds.push(currentId)
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
            timestamp: data.user_timestamp,
            is_pinned: !!data.user_is_pinned
          })
          if (data.assistant_content) {
            compiledPath.push({
              id: data.db_assistant_id || data.id,
              role: 'assistant',
              content: data.assistant_content,
              model_used: data.assistant_model,
              timestamp: data.assistant_timestamp,
              is_pinned: !!data.assistant_is_pinned
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
        await fetch(`${BACKEND_URL}/reset?session_id=${sessionId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        setNodes([])
        setEdges([])
        setActiveLeafNodeId(null)
        setActiveBranchId('main')
        showToast("Cloud databases successfully wiped!", "success")
      } catch (e) {
        showToast("Reset failed.", "error")
      }
    }
  }

  // --- Premium Cloud Sync: Push local nodes to Neon Cloud ---
  const handleCloudPushSync = async () => {
    setIsCloudSyncing(true)
    try {
      const localNodes = await db.nodes.where('session_id').equals(sessionId).toArray()
      if (localNodes.length === 0) {
        showToast("IndexedDB is empty for this session. Nothing to push.", "info")
        return
      }

      const res = await fetch(`${BACKEND_URL}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Openrouter-Key': openrouterKey,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          nodes: localNodes
        })
      })

      if (res.ok) {
        showToast("IndexedDB branches successfully synced to Neon Postgres and Qdrant Cloud!", "success")
        await renderFlowGraph()
      } else {
        showToast("Cloud Push failed.", "error")
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
      const res = await fetch(`${BACKEND_URL}/api/sync/pull?session_id=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.nodes && data.nodes.length > 0) {
          // Clear and rewrite browser local database nodes
          await db.nodes.where('session_id').equals(sessionId).delete()
          for (const n of data.nodes) {
            await db.nodes.add(n)
          }
          showToast(`Pulled ${data.nodes.length} message nodes successfully into browser IndexedDB!`, "success")
        } else {
          showToast("No cloud nodes found for this session.", "info")
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
          'X-Openrouter-Key': openrouterKey,
          'Authorization': `Bearer ${token}`
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
      const dbRes = await fetch(`${BACKEND_URL}/api/session/tree?session_id=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (dbRes.ok) {
        const data = await dbRes.json()
        if (data.nodes.length > 0) {
          const interactionNodes = data.nodes.filter((n: any) => n.data.role === 'interaction')
          if (interactionNodes.length > 0) {
            setActiveLeafNodeId(interactionNodes[interactionNodes.length - 1].id)
          }
        }
      }

      // Refresh cloud sessions list to reflect updated active state/timestamp
      fetchCloudSessions()

    } catch (e: any) {
      console.error(e)
      showToast(`API Streaming Outage: ${e.message}`, "error")
    } finally {
      setIsStreaming(false)
      setStreamedAssistantText('')
    }
  }

  // --- Authentication Gateway View ---
  if (stage === 'auth') {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[#070b13] px-4 overflow-hidden">
        <div className="glowing-bg-layer" />
        <div className="glowing-bg-layer-secondary" />

        <div className="w-full max-w-md p-8 rounded-2xl glass-panel relative z-10 animate-fade-in shadow-2xl border border-slate-800">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
              <Brain className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">Secure SaaS Gateway</h2>
            <p className="text-xs text-slate-400 mt-2">Access your multi-device synced cloud session workspace</p>
          </div>

          {authError && (
            <div className="p-3.5 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium animate-pulse">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                required
                className="w-full px-4 py-3 rounded-xl glass-input text-white text-xs font-sans border border-slate-800 bg-[#0d1222]/50 focus:border-indigo-500 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl glass-input text-white text-xs font-sans border border-slate-800 bg-[#0d1222]/50 focus:border-indigo-500 transition-all outline-none"
              />
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all mt-4 cursor-pointer"
            >
              {authMode === 'login' ? 'Access Workspace' : 'Initialize Account'}
            </button>
          </form>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase font-semibold">or</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="flex items-center justify-center gap-2.5 w-full py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all cursor-pointer hover:border-indigo-500/50 shadow-md"
          >
            <svg className="w-4 h-4 mr-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="mt-8 text-center text-xs text-slate-500">
            {authMode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button onClick={() => setAuthMode('register')} className="text-indigo-400 hover:underline font-semibold cursor-pointer">
                  Create Account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button onClick={() => setAuthMode('login')} className="text-indigo-400 hover:underline font-semibold cursor-pointer">
                  Sign In
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    )
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

          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:border-indigo-500/50"
            title="User Profile Settings"
          >
            <Settings className="w-3.5 h-3.5 animate-pulse" />
            Settings
          </button>
        </div>
      </header>

      {/* CORE WORKSPACE SECTION */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* COLLAPSIBLE CONTROL CENTER SIDEBAR */}
        <aside className={`border-r border-white/5 bg-[#090e1a]/95 backdrop-blur-md transition-all duration-300 ease-in-out z-20 flex flex-row overflow-hidden ${
          sidebarOpen ? 'w-80' : 'w-16'
        }`}>
          
          {/* Vertical Icon Strip (Left side of sidebar) */}
          <div className="w-16 border-r border-white/5 flex flex-col items-center py-4 justify-between bg-slate-950/20">
            <div className="flex flex-col gap-4 items-center w-full">
              {/* Sidebar toggle arrow */}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition cursor-pointer"
                title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
              
              <div className="h-[1px] w-8 bg-white/5 my-2" />
              
              {/* Sessions Tab */}
              <button 
                onClick={() => { setSidebarTab('sessions'); setSidebarOpen(true); }} 
                className={`p-2.5 rounded-xl transition cursor-pointer ${sidebarTab === 'sessions' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                title="Cloud Sessions"
              >
                <Folder className="w-4 h-4" />
              </button>
              
              {/* Pins Tab */}
              <button 
                onClick={() => { setSidebarTab('pins'); setSidebarOpen(true); }} 
                className={`p-2.5 rounded-xl transition cursor-pointer relative ${sidebarTab === 'pins' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                title="Pinned Context Nodes"
              >
                <Pin className="w-4 h-4" />
                {nodes.filter(n => n.data.is_pinned).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                )}
              </button>
            </div>
            
            <div className="text-[10px] text-slate-600 font-mono tracking-widest uppercase rotate-90 select-none pb-4">
              NStitch
            </div>
          </div>

          {/* Expanded Content Drawer (Right side of sidebar) */}
          {sidebarOpen && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden w-64 animate-fade-in">
              
              {/* SESSIONS TAB */}
              {sidebarTab === 'sessions' && (
                <div className="flex-grow flex flex-col overflow-hidden">
                  <button
                    onClick={handleCreateCloudSession}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 mb-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/20 text-purple-400 hover:text-purple-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Create Cloud Session
                  </button>

                  <div className="flex-grow overflow-y-auto space-y-2 mb-6 pr-1 custom-scrollbar">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Cloud Sessions List</h3>
                    {cloudSessions.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic p-3 text-center">
                        No active sessions.
                      </div>
                    ) : (
                      cloudSessions.map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSessionId(s.id)
                            localStorage.setItem('NS_SESSION_ID', s.id)
                            setActiveLeafNodeId(null)
                            setActiveBranchId('main')
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition ${
                            sessionId === s.id ? 'border-purple-500/30 bg-purple-950/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="text-xs font-bold text-slate-200 truncate">{s.title}</span>
                            <span className="text-[9px] text-slate-500 font-mono truncate">{s.id}</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteCloudSession(s.id, e)}
                            className="p-1 text-slate-600 hover:text-red-400 hover:bg-white/5 rounded transition cursor-pointer"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* PARAMETERS CONFIGURATION */}
                  <div className="border-t border-white/5 pt-4 space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Session Settings</h3>
                    
                    <div className="space-y-1">
                      <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Active Session ID</label>
                      <input
                        type="text"
                        value={sessionId}
                        onChange={(e) => {
                          setSessionId(e.target.value)
                          localStorage.setItem('NS_SESSION_ID', e.target.value)
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-white text-[11px] font-mono outline-none focus:border-purple-500/50"
                      />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-grow space-y-1">
                        <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider" title="RAG Neighbors (K)">RAG (K)</label>
                        <input
                          type="number"
                          value={k}
                          onChange={(e) => setK(Number(e.target.value))}
                          min="1"
                          max="10"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white text-xs font-mono"
                        />
                      </div>

                      <div className="flex-grow space-y-1">
                        <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider" title="History Sliders (Last N)">Last N</label>
                        <input
                          type="number"
                          value={lastN}
                          onChange={(e) => setLastN(Number(e.target.value))}
                          min="1"
                          max="10"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PINS TAB */}
              {sidebarTab === 'pins' && (
                <div className="flex-grow flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Pin className="w-3.5 h-3.5 text-purple-400" />
                      Pinned Context
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold">
                      {activePathMessages.filter(m => m.is_pinned).length} / 3 Path Pins
                    </span>
                  </div>

                  <div className="flex-grow overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {nodes.filter(n => n.data.is_pinned).length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic p-3 text-center">
                        No pinned nodes. Pin nodes on the canvas to save references.
                      </div>
                    ) : (
                      nodes.filter(n => n.data.is_pinned).map(n => {
                        const isSummary = n.data.role === 'system_summary';
                        const textContent = isSummary ? n.data.content : (n.data.user_content || n.data.assistant_content);
                        const roleLabel = isSummary ? 'Topic Summary' : (n.data.db_assistant_id ? 'AI Turn' : 'User Query');
                        
                        return (
                          <div 
                            key={n.id} 
                            onClick={() => handleJumpToNode(n.id)}
                            className="p-3 rounded-xl border border-purple-500/25 bg-[#0e1424]/80 hover:bg-[#121b30] hover:border-purple-500/40 cursor-pointer transition relative group shadow-md"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                isSummary ? 'bg-amber-500/20 text-amber-300' : 'bg-purple-500/20 text-purple-300'
                              }`}>
                                {roleLabel}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePinNode(n.id, n.data.db_user_id, n.data.db_assistant_id, true);
                                }}
                                className="p-1 rounded bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                                title="Unpin context"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                              {textContent}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
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
                onNodeClick={onNodeClick}
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
                        <div key={msg.id} className="p-4 rounded-xl border border-amber-500/10 bg-amber-950/5 text-amber-300/90 text-xs italic font-serif leading-relaxed max-w-2xl mx-auto relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-sans font-bold uppercase tracking-wider text-[9px] text-amber-400">Topic Card Summary</span>
                            {msg.is_pinned && (
                              <span className="flex items-center text-purple-400 gap-0.5 font-sans font-bold uppercase tracking-wider text-[9px]">
                                <Pin className="w-2.5 h-2.5 fill-purple-400" />
                                Pinned
                              </span>
                            )}
                          </div>
                          {msg.content}
                        </div>
                      )
                    }

                    return (
                      <div key={msg.id} className={`flex flex-col space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                          {msg.is_pinned && (
                            <span className="flex items-center text-purple-400 gap-0.5 font-bold mr-1">
                              <Pin className="w-2.5 h-2.5 fill-purple-400 animate-pulse" />
                              Pinned Context
                            </span>
                          )}
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

      {/* USER SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl rounded-2xl glass-panel border border-slate-800 p-6 shadow-2xl relative z-10 text-left bg-[#0c1220]/95 animate-fade-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Personalization Vault Settings</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Configure custom instructions and memory preferences</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSettings} className="space-y-6">
              
              {/* Share Facts Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/20">
                <div className="pr-4">
                  <h4 className="text-xs font-bold text-white mb-0.5">Share Profile Facts with AI</h4>
                  <p className="text-[10px] text-slate-500">Allows backend memory extraction tasks to run in the background and inject user details dynamically.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settingsShareMemory}
                    onChange={(e) => setSettingsShareMemory(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              {/* Text Area - What AI Should Know */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">What should the AI know about you to provide better responses?</label>
                <textarea
                  value={settingsAboutUser}
                  onChange={(e) => setSettingsAboutUser(e.target.value)}
                  placeholder="E.g., I am a Senior Frontend Engineer coding in TypeScript and React. I prefer clean code using Tailwind and standard CSS..."
                  className="w-full h-24 px-4 py-3 rounded-xl glass-input text-white text-xs font-sans border border-slate-800 bg-[#0d1222]/50 focus:border-indigo-500 transition-all outline-none resize-none"
                />
              </div>

              {/* Text Area - Response Style */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">How would you like the AI to respond?</label>
                <textarea
                  value={settingsResponseStyle}
                  onChange={(e) => setSettingsResponseStyle(e.target.value)}
                  placeholder="E.g., Be concise, direct, and bypass conversational filler. Provide complete code solutions without placeholders..."
                  className="w-full h-24 px-4 py-3 rounded-xl glass-input text-white text-xs font-sans border border-slate-800 bg-[#0d1222]/50 focus:border-indigo-500 transition-all outline-none resize-none"
                />
              </div>

              {/* Memory Vault Facts List */}
              <div className="space-y-4 border-t border-white/5 pt-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memory Vault (AI-Extracted Personalization Profile)</label>
                  <p className="text-[10px] text-slate-500 mt-1">AI automatically updates your profile details, likes, dislikes, and skills dynamically. You can review or delete individual items below.</p>
                </div>
                
                {isProfileEmpty() ? (
                  <div className="text-[11px] text-slate-500 italic p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/10 text-center">
                    No profile details extracted yet. Start chatting and the AI will build your personalized profile automatically!
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs">
                    
                    {/* Biographical Section */}
                    {Object.entries(userProfile.biographical || {}).some(([_, v]) => v) && (
                      <div className="space-y-1.5">
                        <h5 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Biographical</h5>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(userProfile.biographical || {}).map(([key, val]: any) => val && (
                            <div key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-semibold">
                              <span>{key.charAt(0).toUpperCase() + key.slice(1)}: {val}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProfileItem(`biographical.${key}`, val)}
                                className="hover:text-red-400 transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Professional Section */}
                    {(userProfile.professional?.role || userProfile.professional?.operating_system || (userProfile.professional?.skills?.length > 0)) && (
                      <div className="space-y-1.5">
                        <h5 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Professional Context</h5>
                        <div className="flex flex-wrap gap-2">
                          {userProfile.professional?.role && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold">
                              <span>Role: {userProfile.professional.role}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProfileItem("professional.role", userProfile.professional.role)}
                                className="hover:text-red-400 transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          {userProfile.professional?.operating_system && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold">
                              <span>OS: {userProfile.professional.operating_system}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProfileItem("professional.operating_system", userProfile.professional.operating_system)}
                                className="hover:text-red-400 transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          {(userProfile.professional?.skills || []).map((skill: string) => (
                            <div key={skill} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold">
                              <span>Skill: {skill}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProfileItem("professional.skills", skill)}
                                className="hover:text-red-400 transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Likes & Dislikes Section */}
                    {((userProfile.interests?.likes?.length > 0) || (userProfile.interests?.dislikes?.length > 0) || (userProfile.interests?.topics?.length > 0)) && (
                      <div className="space-y-3">
                        {userProfile.interests?.likes?.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Likes</h5>
                            <div className="flex flex-wrap gap-2">
                              {userProfile.interests.likes.map((like: string) => (
                                <div key={like} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                                  <span>{like}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProfileItem("interests.likes", like)}
                                    className="hover:text-red-400 transition cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {userProfile.interests?.dislikes?.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Dislikes</h5>
                            <div className="flex flex-wrap gap-2">
                              {userProfile.interests.dislikes.map((dislike: string) => (
                                <div key={dislike} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-semibold">
                                  <span>{dislike}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProfileItem("interests.dislikes", dislike)}
                                    className="hover:text-red-400 transition cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {userProfile.interests?.topics?.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Topics of Interest</h5>
                            <div className="flex flex-wrap gap-2">
                              {userProfile.interests.topics.map((topic: string) => (
                                <div key={topic} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-semibold">
                                  <span>{topic}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProfileItem("interests.topics", topic)}
                                    className="hover:text-red-400 transition cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Other Notes Section */}
                    {(userProfile.other_notes || []).length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Other Observations</h5>
                        <div className="space-y-2">
                          {userProfile.other_notes.map((note: string, idx: number) => (
                            <div key={idx} className="flex items-start justify-between gap-3 p-2 rounded-lg border border-slate-800 bg-[#070a13] text-slate-300 leading-relaxed text-[11px]">
                              <span>{note}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProfileItem("other_notes", note)}
                                className="p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2.5 px-4 rounded-xl bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 text-red-400 text-xs font-bold transition-all cursor-pointer"
                >
                  Log Out Session
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
      {/* Toast Notification Layer */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 ${
              t.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' 
                : t.type === 'error'
                ? 'bg-red-950/90 border-red-500/30 text-red-200'
                : 'bg-slate-900/90 border-slate-700/50 text-slate-200'
            }`}
          >
            <span className="text-xs font-sans font-medium leading-relaxed">{t.message}</span>
            <button 
              type="button"
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="ml-3 hover:text-white text-[10px] opacity-60 hover:opacity-100 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

    </div>
  )
}
