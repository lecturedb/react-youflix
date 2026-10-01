import { useState } from 'react'
import {
  formatDuration,
  formatPublishedAt,
  formatStatistic,
  mockChannelDetail,
} from '../data/mockChannelDetail.js'
import Modal from './Modal.jsx'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
    </svg>
  )
}

function DetailImage({ src, alt, className, fallbackLabel }) {
  const [failedSource, setFailedSource] = useState(null)
  const showImage = src && failedSource !== src

  return showImage ? (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setFailedSource(src)}
    />
  ) : (
    <span className={`${className} detail-image-fallback`} role="img" aria-label={fallbackLabel}>
      <span aria-hidden="true">YouFlix</span>
    </span>
  )
}

function MetadataList({ video }) {
  const items = [
    ['업로드', formatPublishedAt(video.publishedAt)],
    ['재생시간', formatDuration(video.duration)],
    ['조회수', formatStatistic(video.statistics.views)],
    ['좋아요', formatStatistic(video.statistics.likes)],
    ['댓글', formatStatistic(video.statistics.comments)],
  ]

  return (
    <dl className="detail-metadata">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ChannelSummary({ channel }) {
  const initial = Array.from(channel.name.trim())[0] || '?'
  const statistics = [
    ['영상', formatStatistic(channel.statistics.videos)],
    ['구독자', formatStatistic(channel.statistics.subscribers, {
      isPrivate: channel.statistics.subscribersHidden,
    })],
    ['총 조회수', formatStatistic(channel.statistics.views)],
  ]

  return (
    <section className="detail-channel-summary" aria-labelledby="detail-channel-name">
      <div className="detail-channel-summary__identity">
        <DetailImage
          className="detail-channel-summary__image"
          src={channel.imageUrl}
          alt={`${channel.name} 채널`}
          fallbackLabel={`${channel.name} 채널 이미지 없음: ${initial}`}
        />
        <div>
          <p className="detail-section-label">채널</p>
          <h3 id="detail-channel-name">{channel.name}</h3>
        </div>
      </div>

      <dl className="detail-channel-statistics">
        {statistics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {channel.description && (
        <p className="detail-channel-summary__description">{channel.description}</p>
      )}
    </section>
  )
}

function YouTubePlayer({ video }) {
  const [hasLoadError, setHasLoadError] = useState(false)
  const youtubeUrl = video.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeVideoId)}`
    : null
  const canEmbed = video.playback.isPlayable && !hasLoadError

  return (
    <div className="detail-player">
      {canEmbed ? (
        <iframe
          className="detail-player__iframe"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtubeVideoId)}?rel=0&playsinline=1`}
          title={`${video.title} YouTube 플레이어`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onError={() => setHasLoadError(true)}
        />
      ) : (
        <div className="detail-player__unavailable" role="status">
          <strong>이 영상을 재생할 수 없습니다.</strong>
          <p>
            {hasLoadError
              ? '플레이어를 불러오지 못했습니다. 다른 영상을 선택해 주세요.'
              : video.playback.unavailableMessage}
          </p>
        </div>
      )}

      {youtubeUrl && !canEmbed && (
        <a
          className="detail-player__external-link"
          href={youtubeUrl}
          target="_blank"
          rel="noreferrer"
        >
          YouTube에서 열기
        </a>
      )}
    </div>
  )
}

function LatestVideoItem({ video, isCurrent, onSelect }) {
  return (
    <li className={`latest-video${isCurrent ? ' is-current' : ''}`}>
      <button
        type="button"
        className="latest-video__select"
        aria-label={`${video.title}${isCurrent ? ', 현재 대표 영상' : ', 대표 영상으로 선택'}`}
        aria-current={isCurrent || undefined}
        onClick={() => onSelect(video)}
      >
        <div className="latest-video__thumbnail-wrap">
          <DetailImage
            className="latest-video__thumbnail"
            src={video.thumbnailUrl}
            alt=""
            fallbackLabel={`${video.title} 썸네일 없음`}
          />
          <span className="latest-video__duration">{formatDuration(video.duration)}</span>
        </div>
        <div className="latest-video__content">
          <div className="latest-video__heading">
            <h3>{video.title}</h3>
            {isCurrent && <span>현재 대표 영상</span>}
          </div>
          <MetadataList video={video} />
        </div>
      </button>
    </li>
  )
}

function ChannelDetailModal({ channel: selectedChannel, onClose }) {
  const { channel, videos } = mockChannelDetail
  const [selectedVideoId, setSelectedVideoId] = useState(() => videos[0]?.id ?? null)
  const featuredVideo = videos.find(video => video.id === selectedVideoId) ?? videos[0] ?? null
  const titleId = `channel-detail-${selectedChannel.id}-title`
  const descriptionId = `channel-detail-${selectedChannel.id}-description`

  const handleVideoSelect = (video) => {
    setSelectedVideoId(video.id)
  }

  return (
    <Modal
      className="channel-detail-modal"
      labelId={titleId}
      descriptionId={descriptionId}
      onClose={onClose}
    >
      <header className="channel-detail-modal__header">
        <div>
          <p className="channel-detail-modal__eyebrow">채널 상세</p>
          <h2 id={titleId}>{channel.name}</h2>
        </div>
        <button
          type="button"
          className="modal__close-button"
          aria-label={`${channel.name} 채널 상세 닫기`}
          autoFocus
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      {featuredVideo ? (
        <div className="channel-detail-content">
          <section className="detail-featured" aria-labelledby="featured-video-title">
            <div className="detail-player-stage">
              <YouTubePlayer key={featuredVideo.id} video={featuredVideo} />
            </div>

            <div className="detail-information">
              <section className="detail-video-summary">
                <p className="detail-section-label">영상 정보</p>
                <h3 id="featured-video-title">{featuredVideo.title}</h3>
                <MetadataList video={featuredVideo} />
              </section>
              <ChannelSummary channel={channel} />
            </div>
          </section>

          <section className="latest-videos" aria-labelledby="latest-videos-title">
            <div className="latest-videos__header">
              <h2 id="latest-videos-title">최신 동영상</h2>
              <span>{videos.length}개</span>
            </div>
            <ol className="latest-videos__list">
              {videos.map((video) => (
                <LatestVideoItem
                  key={video.id}
                  video={video}
                  isCurrent={video.id === featuredVideo.id}
                  onSelect={handleVideoSelect}
                />
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <p className="detail-empty-state">최신 동영상이 없습니다.</p>
      )}

      <p className="visually-hidden" id={descriptionId}>
        {channel.name} 채널의 재생 가능한 대표 영상, 채널 정보와 선택 가능한 최신 동영상 목록
      </p>
    </Modal>
  )
}

export default ChannelDetailModal
