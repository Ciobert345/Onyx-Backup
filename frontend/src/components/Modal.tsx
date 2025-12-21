import { PropsWithChildren } from 'react'

export default function Modal({ open, onClose, title, children }: PropsWithChildren<{ open: boolean, onClose: ()=>void, title?: string }>) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="glass w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-lg">{title}</h3>
          <button onClick={onClose} className="text-text-secondary">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
