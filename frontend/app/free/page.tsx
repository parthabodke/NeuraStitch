// frontend/app/free/page.tsx
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
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Folder
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

import { db, getLocalPathToNode, type LocalNode, type LocalSession } from '../../lib/db'
import { encryptKey, decryptKey } from '../../lib/crypto'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// --- Custom React Flow Node Component ---
const CustomNode = ({ data }: any) => {
  const isSummary = data.role === 'system_summary'
  const isInteraction = data.role === 'interaction'

  if (isSummary) {
    return (
      <div className="p-4 rounded-xl border w-[350px] text-left glass-panel transition-all shadow-xl hover:scale-[1.02] border-amber-500/30 bg-amber-950/20">
        <Handle type="target" position={Position.Top} className="!bg-slate-500" />
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
          {data.isActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
              Active
            </span>
          )}
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

export default function FreePlayground() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'settings'>('sessions')
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const [stage, setStage] = useState<'wallet' | 'playground'>('wallet')
  
  // BYOK Credentials Keys
  const [openaiKey, setOpenaiKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [openrouterKey, setOpenrouterKey] = useState('')

  // Encrypted Local Storage PIN States
  const [isLocked, setIsLocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [unlockedPin, setUnlockedPin] = useState('')
  const [promptCreatePin, setPromptCreatePin] = useState(false)
  const [createPin, setCreatePin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')



  // Concealed visual eye flags
  const [showOpenai, setShowOpenai] = useState(false)
  const [showGemini, setShowGemini] = useState(false)
  const [showGroq, setShowGroq] = useState(false)
  const [showOpenrouter, setShowOpenrouter] = useState(false)

  // Sessions States
  const [sessions, setSessions] = useState<LocalSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [activeModel, setActiveModel] = useState('gemini-2.5-flash')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isSyncingModels, setIsSyncingModels] = useState(false)

  // Conversation Tree States
  const [activeBranchId, setActiveBranchId] = useState('main')
  const [activeLeafNodeId, setActiveLeafNodeId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedAssistantText, setStreamedAssistantText] = useState('')
  
  // Dual View States
  const [viewMode, setViewMode] = useState<'chat' | 'graph'>('graph')
  const [activePathMessages, setActivePathMessages] = useState<LocalNode[]>([])
  
  const loadActivePath = useCallback(async () => {
    if (!activeSessionId) {
      setActivePathMessages([])
      return
    }
    if (!activeLeafNodeId) {
      const sessionNodes = await db.nodes.where('session_id').equals(activeSessionId).sortBy('timestamp')
      if (sessionNodes.length > 0) {
        const latest = sessionNodes[sessionNodes.length - 1]
        setActiveLeafNodeId(latest.id)
        return
      }
      setActivePathMessages([])
      return
    }
    const path = await getLocalPathToNode(activeLeafNodeId)
    setActivePathMessages(path)
  }, [activeSessionId, activeLeafNodeId])

  useEffect(() => {
    loadActivePath()
  }, [activeSessionId, activeLeafNodeId, loadActivePath])

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

  // --- Initialize Local Sessions & Credentials ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isEncrypted = localStorage.getItem('NS_KEYS_ENCRYPTED') === 'true'
      if (isEncrypted) {
        setIsLocked(true)
      } else {
        setOpenaiKey(localStorage.getItem('NS_OPENAI_KEY') || '')
        setGeminiKey(localStorage.getItem('NS_GEMINI_KEY') || '')
        setGroqKey(localStorage.getItem('NS_GROQ_KEY') || '')
        setOpenrouterKey(localStorage.getItem('NS_OPENROUTER_KEY') || '')
      }
      loadLocalSessions()
    }
  }, [])

  const handleUnlock = async (enteredPin: string) => {
    try {
      const encOpenai = localStorage.getItem('NS_OPENAI_KEY') || ''
      const encGemini = localStorage.getItem('NS_GEMINI_KEY') || ''
      const encGroq = localStorage.getItem('NS_GROQ_KEY') || ''
      const encOpenrouter = localStorage.getItem('NS_OPENROUTER_KEY') || ''
      
      const decryptedOpenai = encOpenai ? await decryptKey(encOpenai, enteredPin) : ''
      const decryptedGemini = encGemini ? await decryptKey(encGemini, enteredPin) : ''
      const decryptedGroq = encGroq ? await decryptKey(encGroq, enteredPin) : ''
      const decryptedOpenrouter = encOpenrouter ? await decryptKey(encOpenrouter, enteredPin) : ''

      setOpenaiKey(decryptedOpenai)
      setGeminiKey(decryptedGemini)
      setGroqKey(decryptedGroq)
      setOpenrouterKey(decryptedOpenrouter)
      
      setUnlockedPin(enteredPin)
      setIsLocked(false)
      setPinError('')
      setPin('')
    } catch (err) {
      setPinError('Incorrect PIN. Please try again.')
    }
  }

  const handleCreateAndProceed = async () => {
    if (!/^\d{4}$/.test(createPin)) {
      setPinError("PIN must be exactly 4 digits.")
      return
    }
    if (createPin !== confirmPin) {
      setPinError("PINs do not match.")
      return
    }
    try {
      const encOpenai = await encryptKey(openaiKey, createPin)
      const encGemini = await encryptKey(geminiKey, createPin)
      const encGroq = await encryptKey(groqKey, createPin)
      const encOpenrouter = await encryptKey(openrouterKey, createPin)
      
      localStorage.setItem('NS_OPENAI_KEY', encOpenai)
      localStorage.setItem('NS_GEMINI_KEY', encGemini)
      localStorage.setItem('NS_GROQ_KEY', encGroq)
      localStorage.setItem('NS_OPENROUTER_KEY', encOpenrouter)
      localStorage.setItem('NS_KEYS_ENCRYPTED', 'true')
      
      setUnlockedPin(createPin)
      setPromptCreatePin(false)
      setPinError('')
      
      fetchAvailableModels({
        openai: openaiKey,
        gemini: geminiKey,
        groq: groqKey,
        openrouter: openrouterKey
      })
      setStage('playground')
    } catch (err) {
      setPinError("Failed to encrypt and save keys.")
    }
  }

  const loadLocalSessions = async () => {
    const list = await db.sessions.orderBy('last_active').reverse().toArray()
    setSessions(list)
    if (list.length > 0) {
      setActiveSessionId(list[0].id)
    } else {
      // Create automatic default session on first load
      const defaultSession = {
        id: `sess-${Math.random().toString(36).substring(2, 9)}`,
        title: 'New Local Session',
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      }
      await db.sessions.add(defaultSession)
      setSessions([defaultSession])
      setActiveSessionId(defaultSession.id)
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
        const models = data.models || []
        setAvailableModels(models)
        if (keysPayload.groq && models.includes('llama-3.1-8b-instant')) {
          setActiveModel('llama-3.1-8b-instant')
        } else if (models.length > 0 && !models.includes(activeModel)) {
          setActiveModel(models[0])
        }
      }
    } catch (e) {
      console.error("Failed to query models from router:", e)
    } finally {
      setIsSyncingModels(false)
    }
  }

  // --- Proceed into visual playground sandbox ---
  const handleProceed = async () => {
    if (unlockedPin) {
      try {
        const encOpenai = await encryptKey(openaiKey, unlockedPin)
        const encGemini = await encryptKey(geminiKey, unlockedPin)
        const encGroq = await encryptKey(groqKey, unlockedPin)
        const encOpenrouter = await encryptKey(openrouterKey, unlockedPin)
        
        localStorage.setItem('NS_OPENAI_KEY', encOpenai)
        localStorage.setItem('NS_GEMINI_KEY', encGemini)
        localStorage.setItem('NS_GROQ_KEY', encGroq)
        localStorage.setItem('NS_OPENROUTER_KEY', encOpenrouter)
        localStorage.setItem('NS_KEYS_ENCRYPTED', 'true')
        
        fetchAvailableModels({
          openai: openaiKey,
          gemini: geminiKey,
          groq: groqKey,
          openrouter: openrouterKey
        })
        setStage('playground')
      } catch (err) {
        showToast("Failed to encrypt and save keys.", "error")
      }
    } else {
      setPromptCreatePin(true)
    }
  }

  // --- Create New Session ---
  const handleCreateSession = async () => {
    const newSession = {
      id: `sess-${Math.random().toString(36).substring(2, 9)}`,
      title: `Conversation ${sessions.length + 1}`,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    }
    await db.sessions.add(newSession)
    setSessions([newSession, ...sessions])
    setActiveSessionId(newSession.id)
    setActiveLeafNodeId(null)
    setActiveBranchId('main')
  }

  // --- Delete Session ---
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Delete this local session and all its conversation branches?")) {
      await db.sessions.delete(id)
      await db.nodes.where('session_id').equals(id).delete()
      const list = sessions.filter(s => s.id !== id)
      setSessions(list)
      if (activeSessionId === id && list.length > 0) {
        setActiveSessionId(list[0].id)
      } else if (list.length === 0) {
        handleCreateSession()
      }
    }
  }

  // --- Node Branching Callback ---
  const handleBranchNode = useCallback((nodeId: string) => {
    setActiveLeafNodeId(nodeId)
    // Spawn a new visual branch UUID
    const branchName = `branch-${Math.random().toString(36).substring(2, 6)}`
    setActiveBranchId(branchName)
    showToast("Active parent node set! Next prompt will branch dynamically.", "info")
  }, [])

  // --- Redraw visual canvas using client IndexedDB nodes tree layout ---
  const renderFlowGraph = useCallback(async () => {
    if (!activeSessionId) return

    const localNodes = await db.nodes.where('session_id').equals(activeSessionId).sortBy('timestamp')
    if (localNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const nodeMap = new Map(localNodes.map(n => [n.id, n]))
    
    // 1. Group nodes into Visual Interactions (Paired)
    const dbChildren = new Map<string, any[]>()
    localNodes.forEach(n => {
      if (n.parent_node_id) {
        if (!dbChildren.has(n.parent_node_id)) {
          dbChildren.set(n.parent_node_id, [])
        }
        dbChildren.get(n.parent_node_id)!.push(n)
      }
    })

    const pairedIds = new Set<string>()
    const visualItems: any[] = []

    localNodes.forEach(n => {
      if (pairedIds.has(n.id)) return

      if (n.role === 'user') {
        const children = dbChildren.get(n.id) || []
        let assistantChild = null
        for (const child of children) {
          if (child.role === 'assistant') {
            assistantChild = child
            break
          }
        }

        if (assistantChild) {
          pairedIds.add(n.id)
          pairedIds.add(assistantChild.id)
          visualItems.push({
            id: assistantChild.id, // Visual completed interaction ID
            db_user_id: n.id,
            db_assistant_id: assistantChild.id,
            role: 'interaction',
            user_content: n.content,
            user_model: n.model_used || 'Unknown',
            user_timestamp: n.timestamp,
            assistant_content: assistantChild.content,
            assistant_model: assistantChild.model_used || 'Unknown',
            assistant_timestamp: assistantChild.timestamp,
            parent_node_id: n.parent_node_id,
            is_condensed: assistantChild.is_condensed,
            branch_id: assistantChild.branch_id
          })
        } else {
          // Unpaired user node (streaming or aborted)
          pairedIds.add(n.id)
          visualItems.push({
            id: n.id,
            db_user_id: n.id,
            db_assistant_id: null,
            role: 'interaction',
            user_content: n.content,
            user_model: n.model_used || 'Unknown',
            user_timestamp: n.timestamp,
            assistant_content: null,
            assistant_model: null,
            assistant_timestamp: null,
            parent_node_id: n.parent_node_id,
            is_condensed: n.is_condensed,
            branch_id: n.branch_id
          })
        }
      } else if (n.role === 'system_summary') {
        pairedIds.add(n.id)
        visualItems.push({
          id: n.id,
          db_user_id: null,
          db_assistant_id: null,
          role: 'system_summary',
          content: n.content,
          timestamp: n.timestamp,
          parent_node_id: n.parent_node_id,
          is_condensed: n.is_condensed,
          branch_id: n.branch_id
        })
      } else if (n.role === 'assistant') {
        // Orphaned assistant fallback
        pairedIds.add(n.id)
        visualItems.push({
          id: n.id,
          db_user_id: null,
          db_assistant_id: n.id,
          role: 'interaction',
          user_content: '[Orphaned Assistant Response]',
          user_model: 'System',
          user_timestamp: n.timestamp,
          assistant_content: n.content,
          assistant_model: n.model_used || 'Unknown',
          assistant_timestamp: n.timestamp,
          parent_node_id: n.parent_node_id,
          is_condensed: n.is_condensed,
          branch_id: n.branch_id
        })
      }
    })

    // 2. Map Database message ID to Visual Card ID
    const dbToVisualId = new Map<string, string>()
    visualItems.forEach(item => {
      if (item.db_user_id) dbToVisualId.set(item.db_user_id, item.id)
      if (item.db_assistant_id) dbToVisualId.set(item.db_assistant_id, item.id)
      if (item.role === 'system_summary') dbToVisualId.set(item.id, item.id)
    })

    const visualParentMap = new Map<string, string | null>()
    visualItems.forEach(item => {
      const pId = item.parent_node_id
      if (pId && dbToVisualId.has(pId)) {
        visualParentMap.set(item.id, dbToVisualId.get(pId)!)
      } else {
        visualParentMap.set(item.id, null)
      }
    })

    // 3. Build adjacency lists and identify roots for paired items
    const visualAdj = new Map<string, string[]>()
    const visualRoots: string[] = []
    const visualMap = new Map<string, any>(visualItems.map(item => [item.id, item]))

    visualItems.forEach(item => {
      const item_id = item.id
      const p_id = visualParentMap.get(item_id)
      if (!p_id || !visualMap.has(p_id)) {
        visualRoots.push(item_id)
      } else {
        if (!visualAdj.has(p_id)) {
          visualAdj.set(p_id, [])
        }
        visualAdj.get(p_id)!.push(item_id)
      }
    })

    // 4. Calculate depth (Y coordinate) for paired cards
    const depthMap = new Map<string, number>()
    const getDepth = (item_id: string): number => {
      if (depthMap.has(item_id)) return depthMap.get(item_id)!
      const p_id = visualParentMap.get(item_id)
      if (!p_id || !visualMap.has(p_id)) {
        depthMap.set(item_id, 0)
        return 0
      }
      const d = getDepth(p_id) + 1
      depthMap.set(item_id, d)
      return d
    }

    visualItems.forEach(item => getDepth(item.id))

    // 5. Compute X coordinates post-order centering on visual items
    const xCoords = new Map<string, number>()
    let leafCounter = 0

    const computeX = (item_id: string): number => {
      const children = visualAdj.get(item_id) || []
      if (children.length === 0) {
        const x = leafCounter * 480
        leafCounter += 1
        xCoords.set(item_id, x)
        return x
      }

      let sumX = 0
      children.forEach(childId => {
        sumX += computeX(childId)
      })

      const averageX = sumX / children.length
      xCoords.set(item_id, averageX)
      return averageX
    }

    visualRoots.forEach(r_id => computeX(r_id))

    // 6. Format into React Flow nodes and edges
    const reactNodes: any[] = []
    const reactEdges: any[] = []

    visualItems.forEach(item => {
      const item_id = item.id
      const d = depthMap.get(item_id) || 0
      const xPos = xCoords.get(item_id) || 0
      const yPos = d * 340

      reactNodes.push({
        id: item_id,
        type: 'customNode',
        position: { x: xPos, y: yPos },
        data: {
          ...item,
          onBranch: handleBranchNode,
          isActive: item_id === activeLeafNodeId
        }
      })

      const p_id = visualParentMap.get(item_id)
      if (p_id) {
        reactEdges.push({
          id: `edge-${p_id}-${item_id}`,
          source: p_id,
          target: item_id,
          animated: true,
          style: { stroke: item.role === 'system_summary' ? '#a855f7' : '#3b82f6', strokeWidth: 2 }
        })
      }
    })

    setNodes(reactNodes)
    setEdges(reactEdges)
  }, [activeSessionId, activeLeafNodeId, handleBranchNode, setNodes, setEdges])

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

  // --- Trigger Redraw on Session / Branch Change ---
  useEffect(() => {
    if (activeSessionId && stage === 'playground') {
      renderFlowGraph()
    }
  }, [activeSessionId, stage, renderFlowGraph])

  // --- Chat Submission and Stateless SSE Router Streaming ---
  const handleSend = async () => {
    if (!input.trim() || isStreaming || !activeSessionId) return

    setIsStreaming(true)
    const userMessageContent = input.trim()
    setInput('')

    // 1. Create and write User Message node in local IndexedDB
    const userNodeId = `node-${Math.random().toString(36).substring(2, 9)}`
    const userNode: LocalNode = {
      id: userNodeId,
      session_id: activeSessionId,
      branch_id: activeBranchId,
      parent_node_id: activeLeafNodeId,
      role: 'user',
      content: userMessageContent,
      model_used: activeModel,
      timestamp: new Date().toISOString(),
      is_condensed: false
    }

    await db.nodes.add(userNode)
    await db.sessions.update(activeSessionId, { last_active: new Date().toISOString() })
    
    // Instantly redraw UI to reflect the User Node
    await renderFlowGraph()

    // 2. Traverses local path from root to our new User Node to construct full stateless history
    const activePath = await getLocalPathToNode(userNodeId)
    const compiledMessages = activePath.map(n => ({
      role: n.role === 'system_summary' ? 'system' : n.role,
      content: n.content
    }))

    // 3. Request stateless tokens streaming from FastAPI
    setStreamedAssistantText('')
    try {
      const response = await fetch(`${BACKEND_URL}/chat/stateless?active_model=${activeModel}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenAI-Key': openaiKey,
          'X-Gemini-Key': geminiKey,
          'X-Groq-Key': groqKey,
          'X-Openrouter-Key': openrouterKey
        },
        body: JSON.stringify(compiledMessages)
      })

      if (!response.body) throw new Error("Stateless stream returned blank body.")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantTextAccumulated = ''

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

      // 4. Save generated reply in Local IndexedDB
      const assistantNodeId = `node-${Math.random().toString(36).substring(2, 9)}`
      const assistantNode: LocalNode = {
        id: assistantNodeId,
        session_id: activeSessionId,
        branch_id: activeBranchId,
        parent_node_id: userNodeId, // Child of the user node!
        role: 'assistant',
        content: assistantTextAccumulated.trim(),
        model_used: activeModel,
        timestamp: new Date().toISOString(),
        is_condensed: false
      }

      await db.nodes.add(assistantNode)
      
      // Update our current leaf node pointer
      setActiveLeafNodeId(assistantNodeId)
      
      // Final Redraw to render the complete thread branch
      await renderFlowGraph()

    } catch (e: any) {
      console.error(e)
      showToast(`API Streaming Outage: ${e.message}`, "error")
    } finally {
      setIsStreaming(false)
      setStreamedAssistantText('')
    }
  }

  // --- Form View ---
  if (isLocked) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[#070b13] px-4 overflow-hidden animate-fade-in">
        <div className="glowing-bg-layer" />
        <div className="glowing-bg-layer-secondary" />

        <div className="w-full max-w-md p-8 rounded-2xl glass-panel relative z-10 shadow-2xl text-center border border-slate-800">
          <div className="flex flex-col items-center justify-center space-y-6 py-6">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Key className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-2">Vault Locked</h2>
              <p className="text-slate-400 text-sm">Your API credentials are encrypted. Enter your 4-digit PIN to unlock them.</p>
            </div>
            
            <div className="w-full max-w-xs space-y-4">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ''); // Numeric only
                  setPin(val);
                  if (val.length === 4) {
                    handleUnlock(val);
                  }
                }}
                placeholder="••••"
                className="w-full text-center px-4 py-3 rounded-xl glass-input text-white text-xl font-bold tracking-widest outline-none border border-slate-800 focus:border-indigo-500/50"
              />
              
              {pinError && (
                <p className="text-rose-400 text-xs font-semibold animate-pulse">{pinError}</p>
              )}

              <button
                onClick={() => handleUnlock(pin)}
                className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
              >
                Unlock Wallet
              </button>

              <button
                onClick={() => {
                  if (confirm("Resetting will delete all saved API keys. Are you sure?")) {
                    localStorage.removeItem('NS_OPENAI_KEY');
                    localStorage.removeItem('NS_GEMINI_KEY');
                    localStorage.removeItem('NS_GROQ_KEY');
                    localStorage.removeItem('NS_OPENROUTER_KEY');
                    localStorage.removeItem('NS_KEYS_ENCRYPTED');
                    setIsLocked(false);
                    setUnlockedPin('');
                    setPin('');
                    setPinError('');
                    setOpenaiKey('');
                    setGeminiKey('');
                    setGroqKey('');
                    setOpenrouterKey('');
                  }
                }}
                className="text-xs text-slate-500 hover:text-slate-300 underline block mx-auto mt-2"
              >
                Forgot PIN / Reset Wallet
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (promptCreatePin) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[#070b13] px-4 overflow-hidden animate-fade-in">
        <div className="glowing-bg-layer" />
        <div className="glowing-bg-layer-secondary" />

        <div className="w-full max-w-md p-8 rounded-2xl glass-panel relative z-10 shadow-2xl border border-slate-800">
          <div className="flex flex-col items-center justify-center space-y-6 py-6 text-center">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Key className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-2">Secure Your Keys</h2>
              <p className="text-slate-400 text-sm">Please create a 4-digit PIN to encrypt your keys locally in this browser.</p>
            </div>

            <div className="w-full max-w-xs space-y-4 text-left">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Create 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={createPin}
                  onChange={(e) => setCreatePin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center px-4 py-2.5 rounded-xl glass-input text-white text-lg font-bold tracking-widest outline-none border border-slate-800 focus:border-indigo-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Confirm PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center px-4 py-2.5 rounded-xl glass-input text-white text-lg font-bold tracking-widest outline-none border border-slate-800 focus:border-indigo-500/50"
                />
              </div>

              {pinError && (
                <p className="text-rose-400 text-xs font-semibold text-center animate-pulse">{pinError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPromptCreatePin(false)}
                  className="w-1/2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAndProceed}
                  className="w-1/2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Encrypt & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Local credentials Wallet</h2>
          </div>

          <p className="text-xs text-slate-400 mb-8 leading-relaxed">
            Configure your private model API credentials. Keys are saved securely in your browser's local state. We run a pure <strong>Local-First free platform</strong>; no server storage is utilized.
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
              className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all mt-8"
            >
              <Sparkles className="w-4 h-4" />
              Save Keys & Enter Playground
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Main Playground Canvas View ---
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
              <h1 className="text-sm font-bold text-white tracking-wide">NeuraStitch Free Playground</h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-semibold uppercase">LOCAL-FIRST</span>
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

          <button
            onClick={() => setStage('wallet')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition text-xs font-semibold flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            Wallet
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
                className={`p-2.5 rounded-xl transition cursor-pointer ${sidebarTab === 'sessions' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                title="Local Sessions"
              >
                <Folder className="w-4 h-4" />
              </button>
              
              {/* Settings Tab */}
              <button 
                onClick={() => { setSidebarTab('settings'); setSidebarOpen(true); }} 
                className={`p-2.5 rounded-xl transition cursor-pointer ${sidebarTab === 'settings' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                title="Playground Parameters"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-[10px] text-slate-600 font-mono tracking-widest uppercase rotate-90 select-none pb-4">
              Local
            </div>
          </div>

          {/* Expanded Content Drawer (Right side of sidebar) */}
          {sidebarOpen && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden w-64 animate-fade-in">
              
              {/* SESSIONS TAB */}
              {sidebarTab === 'sessions' && (
                <div className="flex-grow flex flex-col overflow-hidden">
                  <button
                    onClick={handleCreateSession}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 mb-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Create Local Session
                  </button>

                  <div className="flex-grow overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Local Sessions List</h3>
                    {sessions.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic p-3 text-center">
                        No active sessions.
                      </div>
                    ) : (
                      sessions.map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setActiveSessionId(s.id)
                            setActiveLeafNodeId(null)
                            setActiveBranchId('main')
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition ${
                            activeSessionId === s.id ? 'border-indigo-500/30 bg-indigo-950/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="text-xs font-bold text-slate-200 truncate">{s.title}</span>
                            <span className="text-[9px] text-slate-500 font-mono truncate">{s.id}</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="p-1 text-slate-600 hover:text-red-400 hover:bg-white/5 rounded transition cursor-pointer"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}



              {/* SETTINGS TAB */}
              {sidebarTab === 'settings' && (
                <div className="flex-grow flex flex-col overflow-hidden space-y-4">
                  <div className="mb-2 border-b border-white/5 pb-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-indigo-400" />
                      Parameters Settings
                    </h3>
                  </div>

                  {/* Active Model Selector */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Active Model</label>
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                      <select
                        value={activeModel}
                        onChange={(e) => setActiveModel(e.target.value)}
                        className="bg-transparent text-xs text-slate-200 border-none outline-none font-mono cursor-pointer w-full"
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
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Active Session ID</label>
                    <input
                      type="text"
                      value={activeSessionId}
                      onChange={(e) => {
                        setActiveSessionId(e.target.value)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-white text-[11px] font-mono outline-none focus:border-indigo-500/50"
                    />
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
                    <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Brain className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Start a new local branch</h3>
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
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                Streaming stateless tokens
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
    </div>
  )
}
