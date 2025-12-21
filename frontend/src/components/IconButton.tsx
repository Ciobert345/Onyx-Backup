import { ButtonHTMLAttributes } from 'react'

export default function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className='', ...rest } = props
  return (
    <button {...rest} className={`inline-flex items-center justify-center rounded-md border border-border bg-surface-2 hover:shadow-glow hover:bg-surface-3 transition-colors px-2 py-2 ${className}`} />
  )
}
