import type { ComponentPropsWithoutRef } from 'react'

type TagProps = {
  tone?: 'accent' | 'neutral' | 'outline'
} & ComponentPropsWithoutRef<'span'>

export function Tag({ tone = 'neutral', className, ...rest }: TagProps) {
  return <span className={`tag tag-${tone}${className ? ` ${className}` : ''}`} {...rest} />
}
