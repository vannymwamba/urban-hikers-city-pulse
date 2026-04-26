import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BroadcastCard } from './BroadcastCard'
import type { Broadcast, Node, Partner } from '../types'

interface FlashRotationInlineProps {
  broadcasts:  Broadcast[]
  currentNode: Node | null
  intervalMs?: number   // default 3000
  onSelect: (broadcast: Broadcast) => void
  onConfirm?: (id: string) => void
  onShareEvent: (broadcast: Broadcast) => void
  onManage?: (broadcast: Broadcast) => void
  partnersMap: Record<string, Partner>
  canManageBroadcast: (b: Broadcast) => boolean
}

export function FlashRotationInline({
  broadcasts,
  currentNode,
  intervalMs = 3000,
  onSelect,
  onConfirm,
  onShareEvent,
  onManage,
  partnersMap,
  canManageBroadcast
}: FlashRotationInlineProps) {

  const [activeIdx, setActiveIdx] = useState(0)
  const [progress,  setProgress]  = useState(100)
  const [isPaused,  setIsPaused]  = useState(false)

  const pausedRef   = useRef(false)
  const progressRef = useRef(100)
  const timerRef    = useRef<any>(null)
  const fuseRef     = useRef<any>(null)

  // Sort: sponsored first → live → soonest
  const sorted = [...broadcasts].sort((a, b) => {
    if (a.is_sponsored && !b.is_sponsored) return -1
    if (!a.is_sponsored && b.is_sponsored) return  1
    return 0
  })

  const total = sorted.length

  const startFuse = () => {
    if (fuseRef.current) clearInterval(fuseRef.current)
    progressRef.current = 100
    setProgress(100)
    fuseRef.current = setInterval(() => {
      if (pausedRef.current) return
      progressRef.current = Math.max(
        0,
        progressRef.current - (100 / (intervalMs / 50))
      )
      setProgress(progressRef.current)
    }, 50)
  }

  const advance = () => {
    if (pausedRef.current) return
    setActiveIdx(i => (i + 1) % total)
    startFuse()
  }

  useEffect(() => {
    startFuse()
    timerRef.current = setInterval(advance, intervalMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (fuseRef.current) clearInterval(fuseRef.current)
    }
  }, [total, intervalMs])

  const goTo = (idx: number) => {
    setActiveIdx(idx)
    startFuse()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(advance, intervalMs)
  }

  const handlePause = () => {
    pausedRef.current = true
    setIsPaused(true)
  }
  const handleResume = () => {
    pausedRef.current = false
    setIsPaused(false)
  }

  const item = sorted[activeIdx]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Rotating card */}
      <div
        style={{ position: 'relative', borderRadius: 20, overflow: 'hidden' }}
        onMouseDown={handlePause}
        onMouseUp={handleResume}
        onMouseLeave={handleResume}
        onTouchStart={handlePause}
        onTouchEnd={handleResume}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={item?.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{   opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <BroadcastCard
              item={item}
              idx={activeIdx}
              currentNode={currentNode}
              onSelect={onSelect}
              onConfirm={onConfirm}
              onShareEvent={onShareEvent}
              onManage={onManage}
              partner={partnersMap[item.partnerId || item.partner_id || '']}
              variant="peek"
              canManage={canManageBroadcast(item)}
            />
          </motion.div>
        </AnimatePresence>

        {/* FUSE bar — overlaid at bottom of card */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 2,
          background: 'rgba(255,255,255,0.1)',
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.08, ease: 'linear' }}
            style={{
              height: '100%',
              background: progress < 20 ? '#E24B4A' : '#FFE01A',
            }}
          />
        </div>

        {/* Pause indicator */}
        {isPaused && (
          <div style={{
            position: 'absolute',
            top: 12, right: 12,
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', gap: 3 }}>
              <div style={{ width: 3, height: 10,
                            background: '#fff', borderRadius: 2 }}/>
              <div style={{ width: 3, height: 10,
                            background: '#fff', borderRadius: 2 }}/>
            </div>
          </div>
        )}
      </div>

      {/* Dot + counter navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 4px 0',
      }}>

        {/* Dot indicators */}
        <div style={{ display: 'flex', gap: 4 }}>
          {sorted.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              style={{
                width:       idx === activeIdx ? 20 : 5,
                height:      3,
                borderRadius: 2,
                background:  idx === activeIdx ? '#FFE01A' : '#e0e0e0',
                border:      'none',
                padding:     0,
                cursor:      'pointer',
                transition:  'all 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Counter */}
        <span style={{
          fontSize: 9,
          color: '#aaa',
          letterSpacing: '0.1em',
          fontFamily: "'Space Mono', monospace",
        }}>
          {activeIdx + 1} / {total}
        </span>

      </div>

    </div>
  )
}
