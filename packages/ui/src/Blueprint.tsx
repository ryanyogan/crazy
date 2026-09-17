import type { ComponentPropsWithoutRef, ElementType } from 'react'

type BlueprintProps<T extends ElementType> = {
  as?: T
} & ComponentPropsWithoutRef<T>

/**
 * The blueprint frame: a hairline box with a "+" registration mark at each
 * corner. Every card, figure and primary button wears it.
 */
export function Blueprint<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...rest
}: BlueprintProps<T>) {
  const Tag: ElementType = as ?? 'div'
  return (
    <Tag className={className ? `blueprint ${className}` : 'blueprint'} {...rest}>
      <i className="corner tl" aria-hidden="true" />
      <i className="corner tr" aria-hidden="true" />
      <i className="corner bl" aria-hidden="true" />
      <i className="corner br" aria-hidden="true" />
      {children}
    </Tag>
  )
}
