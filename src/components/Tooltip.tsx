import { ReactNode, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: ReactNode
  className?: string
}

/**
 * Custom tooltip component with fast display and better styling.
 * Shows on hover with minimal delay (150ms vs browser default ~1s).
 * Uses portal rendering to avoid overflow issues in table cells.
 */
export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible || !triggerRef.current) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const tooltipHeight = 100 // Approximate tooltip height
      const spacing = 8

      // Determine if we should show tooltip above or below
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const showBelow = spaceBelow > tooltipHeight || spaceBelow > spaceAbove

      setPosition({
        top: showBelow ? rect.bottom + spacing : rect.top - tooltipHeight - spacing,
        left: rect.left + rect.width / 2,
        placement: showBelow ? 'bottom' : 'top'
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isVisible])

  const handleMouseEnter = () => {
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-block ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {isVisible && position && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-xl max-w-xs animate-in fade-in duration-150"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none'
          }}
        >
          {content}
          {/* Arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              [position.placement === 'bottom' ? 'top' : 'bottom']: '-4px'
            }}
          >
            <div className={`border-4 border-transparent ${
              position.placement === 'bottom' ? 'border-b-gray-900' : 'border-t-gray-900'
            }`}></div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
