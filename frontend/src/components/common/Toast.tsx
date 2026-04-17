'use client';

import { useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  open: boolean;
  type?: ToastType;
  message: string;
  onClose?: () => void;
  autoCloseMs?: number;
}

const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-500',
  info: 'bg-slate-700',
};

export default function Toast({
  open,
  type = 'info',
  message,
  onClose,
  autoCloseMs = 3000,
}: ToastProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const timer = setTimeout(() => onClose(), autoCloseMs);
    return () => clearTimeout(timer);
  }, [open, onClose, autoCloseMs]);

  if (!open) return null;

  return (
    <div className="fixed top-4 right-4 z-[999999] max-w-sm" role="status" aria-live="polite">
      <div className={`${toastStyles[type]} text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-start gap-2`}>
        <span className="flex-1 whitespace-pre-line">{message}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
