import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function PageModal({ children, onClose, blur = 'backdrop-blur-md', opacity = 'bg-black/60' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    // lock scroll
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  const node = (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${opacity} ${blur}`} onClick={handleBackdropClick}>
      {children}
    </div>
  )

  if (typeof document !== 'undefined') return createPortal(node, document.body)
  return node
}
