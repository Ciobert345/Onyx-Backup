import { PropsWithChildren } from 'react'

export default function Card({children, className=''}: PropsWithChildren<{className?: string}>) {
  return <div className={`glass p-4 md:p-6 ${className}`}>{children}</div>
}
