import { ReactNode, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: ReactNode
  className?: string
}

interface TooltipPosition {
  top: number
  left: number
  placement: 'top' | 'bottom'
  transform: string
  arrowOffset: number
}

/**
 * Custom tooltip component with fast display and better styling.
 * Shows on hover with minimal delay (150ms vs browser default ~1s).
 * Uses portal rendering to avoid overflow issues in table cells.
 * Automatically adjusts position to stay within viewport on mobile.
 */
export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible || !triggerRef.current) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const tooltipWidth = tooltip?.offsetWidth || 320 // Use actual width or max-w-xs default
      const tooltipHeight = tooltip?.offsetHeight || 100
      const spacing = 8
      const edgePadding = 12 // Minimum distance from viewport edge

      // Determine if we should show tooltip above or below
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const showBelow = spaceBelow > tooltipHeight || spaceBelow > spaceAbove

      // Calculate ideal centered position
      const triggerCenter = rect.left + rect.width / 2
      let tooltipLeft = triggerCenter
      let transform = 'translateX(-50%)' // Default: center on trigger
      let arrowOffset = 0 // Offset from center (0 = centered)

      // Check if tooltip would overflow viewport horizontally
      const tooltipHalfWidth = tooltipWidth / 2
      const leftOverflow = tooltipLeft - tooltipHalfWidth < edgePadding
      const rightOverflow = tooltipLeft + tooltipHalfWidth > window.innerWidth - edgePadding

      if (leftOverflow) {
        // Align to left edge with padding
        tooltipLeft = edgePadding
        transform = 'translateX(0)'
        arrowOffset = triggerCenter - tooltipLeft // Arrow points to trigger from left-aligned tooltip
      } else if (rightOverflow) {
        // Align to right edge with padding
        tooltipLeft = window.innerWidth - edgePadding
        transform = 'translateX(-100%)'
        arrowOffset = triggerCenter - tooltipLeft // Arrow points to trigger from right-aligned tooltip
      }

      setPosition({
        top: showBelow ? rect.bottom + spacing : rect.top - tooltipHeight - spacing,
        left: tooltipLeft,
        placement: showBelow ? 'bottom' : 'top',
        transform,
        arrowOffset
      })
    }

    // Hide tooltip on scroll instead of updating position
    const handleScroll = () => {
      setIsVisible(false)
    }

    // Initial position calculation
    updatePosition()

    // Hide tooltip when user scrolls
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', updatePosition)

    // Recalculate after tooltip renders (to get accurate dimensions)
    const timer = setTimeout(updatePosition, 0)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', updatePosition)
      clearTimeout(timer)
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
            transform: position.transform,
            pointerEvents: 'none'
          }}
        >
          {content}
          {/* Arrow - positioned to point at trigger element */}
          <div
            className="absolute -translate-x-1/2"
            style={{
              [position.placement === 'bottom' ? 'top' : 'bottom']: '-4px',
              left: position.arrowOffset !== 0 ? `${position.arrowOffset}px` : '50%'
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
