import { PropsWithChildren } from 'react'

export default function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`glass p-3 md:p-4 ${className}`}>{children}</div>
}
