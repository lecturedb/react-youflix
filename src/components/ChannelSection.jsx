import ChannelCard from './ChannelCard.jsx'

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

function ChannelSection({ category, channels }) {
  const sectionId = `category-${category}`
  const hasChannels = channels.length > 0

  return (
    <section className="channel-section" id={sectionId} aria-labelledby={`${sectionId}-title`}>
      <h2 id={`${sectionId}-title`}>{category}</h2>

      {hasChannels ? (
        <div className="channel-carousel">
          <button
            type="button"
            className="carousel-button carousel-button--previous"
            aria-label={`${category} 채널 이전 목록`}
            disabled
          >
            <ArrowIcon direction="left" />
          </button>

          <div className="channel-track">
            {channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>

          <button
            type="button"
            className="carousel-button carousel-button--next"
            aria-label={`${category} 채널 다음 목록`}
            disabled
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
