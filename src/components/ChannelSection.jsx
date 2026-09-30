import { useCallback, useEffect, useRef, useState } from 'react'
import ChannelCard from './ChannelCard.jsx'

const SCROLL_EDGE_TOLERANCE = 4
const MIN_VISIBLE_CARD_COUNT = 2
const MAX_VISIBLE_CARD_COUNT = 7
const MIN_CARD_WIDTH = 132
const MIN_CARD_GAP = 8
const MAX_CARD_GAP = 12

const INITIAL_LAYOUT = {
  visibleCardCount: 0,
  cardWidth: 0,
  gap: 10,
}

function getCardScrollPosition(track, cardIndex) {
  const cards = track.querySelectorAll('.channel-card')
  const firstCard = cards[0]
  const targetCard = cards[cardIndex]

  if (!firstCard || !targetCard) return 0
  return targetCard.offsetLeft - firstCard.offsetLeft
}

function ArrowIcon({ direction }) {
  const path = direction === 'left'
    ? 'm15.4 5.4-1.4-1.4-8 8 8 8 1.4-1.4-6.6-6.6 6.6-6.6Z'
    : 'm8.6 18.6 1.4 1.4 8-8-8-8-1.4 1.4 6.6 6.6-6.6 6.6Z'

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function ChannelSection({ category, channels, isVisible }) {
  const sectionId = `category-${category}`
  const trackId = `${sectionId}-track`
  const hasChannels = channels.length > 0
  const trackRef = useRef(null)
  const layoutRef = useRef(INITIAL_LAYOUT)
  const alignmentFrameRef = useRef(null)
  const [carouselLayout, setCarouselLayout] = useState(INITIAL_LAYOUT)
  const [scrollState, setScrollState] = useState({
    canMovePrevious: false,
    canMoveNext: false,
  })

  const updateScrollState = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const maximumScroll = Math.max(0, track.scrollWidth - track.clientWidth)
    const nextState = {
      canMovePrevious: track.scrollLeft > SCROLL_EDGE_TOLERANCE,
      canMoveNext: maximumScroll > SCROLL_EDGE_TOLERANCE
        && track.scrollLeft < maximumScroll - SCROLL_EDGE_TOLERANCE,
    }

    setScrollState((currentState) => (
      currentState.canMovePrevious === nextState.canMovePrevious
      && currentState.canMoveNext === nextState.canMoveNext
        ? currentState
        : nextState
    ))
  }, [])

  const updateCarouselLayout = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const availableWidth = track.getBoundingClientRect().width
    if (availableWidth <= 0) return

    const previousLayout = layoutRef.current
    const previousStep = previousLayout.cardWidth + previousLayout.gap
    const firstVisibleCardIndex = previousStep > 0
      ? Math.round(track.scrollLeft / previousStep)
      : 0
    const gap = Math.min(
      MAX_CARD_GAP,
      Math.max(MIN_CARD_GAP, availableWidth / 100),
    )
    const visibleCardCount = Math.min(
      MAX_VISIBLE_CARD_COUNT,
      Math.max(
        MIN_VISIBLE_CARD_COUNT,
        Math.floor((availableWidth + gap) / (MIN_CARD_WIDTH + gap)),
      ),
    )
    const cardWidth = (
      availableWidth - gap * (visibleCardCount - 1)
    ) / visibleCardCount
    const nextLayout = { visibleCardCount, cardWidth, gap }

    layoutRef.current = nextLayout
    setCarouselLayout((currentLayout) => (
      currentLayout.visibleCardCount === nextLayout.visibleCardCount
      && currentLayout.cardWidth === nextLayout.cardWidth
      && currentLayout.gap === nextLayout.gap
        ? currentLayout
        : nextLayout
    ))

    window.cancelAnimationFrame(alignmentFrameRef.current)
    alignmentFrameRef.current = window.requestAnimationFrame(() => {
      const maximumStartIndex = Math.max(0, channels.length - visibleCardCount)
      const alignedCardIndex = Math.min(firstVisibleCardIndex, maximumStartIndex)

      track.scrollTo({
        left: getCardScrollPosition(track, alignedCardIndex),
        behavior: 'auto',
      })
      updateScrollState()
    })
  }, [channels.length, updateScrollState])

  useEffect(() => {
    const track = trackRef.current
    if (!track || !isVisible) return undefined

    const frameId = window.requestAnimationFrame(updateCarouselLayout)
    const resizeObserver = new ResizeObserver(updateCarouselLayout)
    resizeObserver.observe(track)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(alignmentFrameRef.current)
      resizeObserver.disconnect()
    }
  }, [isVisible, updateCarouselLayout])

  const moveCarousel = (direction) => {
    const track = trackRef.current
    if (!track) return

    const { visibleCardCount, cardWidth, gap } = layoutRef.current
    if (visibleCardCount <= 0 || cardWidth <= 0) return

    const cardStep = cardWidth + gap
    const currentStartIndex = Math.round(track.scrollLeft / cardStep)
    const maximumStartIndex = Math.max(0, channels.length - visibleCardCount)
    const nextStartIndex = direction === 'next'
      ? Math.min(currentStartIndex + visibleCardCount, maximumStartIndex)
      : Math.max(currentStartIndex - visibleCardCount, 0)

    track.scrollTo({
      left: getCardScrollPosition(track, nextStartIndex),
      behavior: 'smooth',
    })
  }

  return (
    <section
      className="channel-section"
      id={sectionId}
      aria-labelledby={`${sectionId}-title`}
      hidden={!isVisible}
    >
      <h2 id={`${sectionId}-title`}>{category}</h2>

      {hasChannels ? (
        <div className="channel-carousel">
          <button
            type="button"
            className="carousel-button carousel-button--previous"
            aria-label={`${category} 채널 이전 목록`}
            aria-controls={trackId}
            disabled={!scrollState.canMovePrevious}
            onClick={() => moveCarousel('previous')}
          >
            <ArrowIcon direction="left" />
          </button>

          <div
            className="channel-track"
            id={trackId}
            ref={trackRef}
            role="group"
            aria-label={`${category} 채널 목록`}
            data-visible-card-count={carouselLayout.visibleCardCount || undefined}
            style={carouselLayout.cardWidth > 0 ? {
              columnGap: `${carouselLayout.gap}px`,
              gridAutoColumns: `${carouselLayout.cardWidth}px`,
            } : undefined}
            onScroll={updateScrollState}
          >
            {channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>

          <button
            type="button"
            className="carousel-button carousel-button--next"
            aria-label={`${category} 채널 다음 목록`}
            aria-controls={trackId}
            disabled={!scrollState.canMoveNext}
            onClick={() => moveCarousel('next')}
          >
            <ArrowIcon direction="right" />
          </button>
        </div>
      ) : (
        <div className="empty-category">
          <div>
            <strong>등록된 채널이 없습니다.</strong>
            <p>{category} 카테고리에 좋아하는 채널을 추가해 보세요.</p>
          </div>
          <button type="button">채널 추가</button>
        </div>
      )}
    </section>
  )
}

export default ChannelSection
