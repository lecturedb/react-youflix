import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildChannelDetail,
  formatDuration,
  formatPublishedAt,
  formatStatistic,
} from '../data/channelDetail.js'
import { getLatestChannelVideos } from '../data/youtubeApi.js'
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

function DetailStatus({ error, isLoading = false, onRetry, onOpenApiSettings, compact = false }) {
  const needsApiKey = ['OPEN_API_KEY_SETTINGS', 'EDIT_API_KEY'].includes(error?.action)

  return (
    <div
      className={`detail-request-state${compact ? ' detail-request-state--compact' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {isLoading && <span className="detail-loading-indicator" aria-hidden="true" />}
      <div>
        <strong>{isLoading ? '채널 정보를 불러오는 중입니다.' : error?.message}</strong>
        {!isLoading && (
          <p>저장된 채널은 변경하거나 삭제하지 않습니다.</p>
        )}
      </div>
      {!isLoading && (
        <div className="detail-request-state__actions">
          {needsApiKey && (
            <button
              type="button"
              onClick={(event) => onOpenApiSettings(event.currentTarget)}
            >
              API 키 {error.action === 'EDIT_API_KEY' ? '수정' : '입력'}
            </button>
          )}
          {error?.retryable && (
            <button type="button" onClick={onRetry}>다시 시도</button>
          )}
        </div>
      )}
    </div>
  )
}

function ChannelDetailModal({
  channel: selectedChannel,
  apiKeyRevision,
  onClose,
  onOpenApiSettings,
}) {
  const [detailState, setDetailState] = useState({
    status: 'loading',
    channelId: selectedChannel.id,
    detail: null,
    error: null,
    partialErrors: {},
  })
  const [selectedVideoId, setSelectedVideoId] = useState(null)
  const requestNumberRef = useRef(0)
  const abortControllerRef = useRef(null)
  const detail = detailState.channelId === selectedChannel.id ? detailState.detail : null
  const channel = detail?.channel
  const videos = detail?.videos ?? []
  const featuredVideo = videos.find(video => video.id === selectedVideoId) ?? videos[0] ?? null
  const displayedChannelName = channel?.name ?? selectedChannel.name
  const titleId = `channel-detail-${selectedChannel.id}-title`
  const descriptionId = `channel-detail-${selectedChannel.id}-description`

  const loadChannelDetail = useCallback(async (forceRefresh = false) => {
    const requestNumber = requestNumberRef.current + 1
    const controller = new AbortController()
    requestNumberRef.current = requestNumber
    abortControllerRef.current?.abort()
    abortControllerRef.current = controller

    await Promise.resolve()
    if (requestNumberRef.current !== requestNumber) return

    setDetailState((currentState) => ({
      status: 'loading',
      channelId: selectedChannel.id,
      detail: currentState.channelId === selectedChannel.id ? currentState.detail : null,
      error: null,
      partialErrors: currentState.channelId === selectedChannel.id
        ? currentState.partialErrors
        : {},
    }))

    try {
      const result = await getLatestChannelVideos(selectedChannel.id, {
        signal: controller.signal,
        forceRefresh,
      })

      if (requestNumberRef.current !== requestNumber) return

      if (!result.channel) {
        setDetailState({
          status: 'not-found',
          channelId: selectedChannel.id,
          detail: null,
          error: null,
          partialErrors: {},
        })
        setSelectedVideoId(null)
        return
      }

      const nextDetail = buildChannelDetail({
        channel: result.channel,
        playlistItems: result.playlistItems,
        videoDetails: result.videos,
      })

      setDetailState({
        status: 'success',
        channelId: selectedChannel.id,
        detail: nextDetail,
        error: null,
        partialErrors: result.errors,
      })
      setSelectedVideoId((currentId) => (
        nextDetail.videos.some(video => video.id === currentId)
          ? currentId
          : nextDetail.featuredVideo?.id ?? null
      ))
    } catch (error) {
      if (
        requestNumberRef.current !== requestNumber
        || error?.code === 'ABORTED'
      ) return

      setDetailState((currentState) => ({
        status: 'error',
        channelId: selectedChannel.id,
        detail: currentState.channelId === selectedChannel.id
          ? currentState.detail
          : null,
        error,
        partialErrors: currentState.channelId === selectedChannel.id
          ? currentState.partialErrors
          : {},
      }))
    }
  }, [selectedChannel.id])

  useEffect(() => {
    const loadTimeout = window.setTimeout(() => {
      loadChannelDetail()
    }, 0)

    return () => {
      window.clearTimeout(loadTimeout)
      abortControllerRef.current?.abort()
    }
  }, [apiKeyRevision, loadChannelDetail])

  const handleVideoSelect = (video) => {
    setSelectedVideoId(video.id)
  }

  const handleRetry = () => {
    loadChannelDetail(true)
  }

  const renderLoadedDetail = () => {
    const partialError = detailState.partialErrors.playlist
      ?? detailState.partialErrors.videos

    return (
      <div className="channel-detail-content">
        <section className="detail-featured" aria-labelledby={featuredVideo ? 'featured-video-title' : undefined}>
          <div className="detail-player-stage">
            {featuredVideo ? (
              <YouTubePlayer key={featuredVideo.id} video={featuredVideo} />
            ) : (
              <div className="detail-player detail-player__empty" role="status">
                <strong>최신 동영상이 없습니다.</strong>
                <p>채널 정보는 아래에서 확인할 수 있습니다.</p>
              </div>
            )}
          </div>

          <div className={`detail-information${featuredVideo ? '' : ' detail-information--channel-only'}`}>
            {featuredVideo ? (
              <section className="detail-video-summary">
                <p className="detail-section-label">영상 정보</p>
                <h3 id="featured-video-title">{featuredVideo.title}</h3>
                <MetadataList video={featuredVideo} />
              </section>
            ) : (
              <section className="detail-video-summary">
                <p className="detail-section-label">영상 정보</p>
                <h3>표시할 최신 동영상이 없습니다.</h3>
              </section>
            )}
            <ChannelSummary channel={channel} />
          </div>
        </section>

        <section className="latest-videos" aria-labelledby="latest-videos-title">
          <div className="latest-videos__header">
            <h2 id="latest-videos-title">최신 동영상</h2>
            <span>{videos.length}개</span>
          </div>

          {partialError && (
            <DetailStatus
              error={partialError}
              onRetry={handleRetry}
              onOpenApiSettings={onOpenApiSettings}
              compact
            />
          )}

          {videos.length > 0 ? (
            <ol className="latest-videos__list">
              {videos.map((video) => (
                <LatestVideoItem
                  key={video.id}
                  video={video}
                  isCurrent={video.id === featuredVideo?.id}
                  onSelect={handleVideoSelect}
                />
              ))}
            </ol>
          ) : !partialError && (
            <p className="latest-videos__empty">최신 동영상이 없습니다.</p>
          )}
        </section>
      </div>
    )
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
          <h2 id={titleId}>{displayedChannelName}</h2>
        </div>
        <button
          type="button"
          className="modal__close-button"
          aria-label={`${displayedChannelName} 채널 상세 닫기`}
          autoFocus
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      {detailState.status === 'loading' && !detail && (
        <DetailStatus isLoading />
      )}

      {detailState.status === 'error' && !detail && (
        <DetailStatus
          error={detailState.error}
          onRetry={handleRetry}
          onOpenApiSettings={onOpenApiSettings}
        />
      )}

      {detailState.status === 'not-found' && (
        <div className="detail-request-state" role="alert">
          <div>
            <strong>채널을 찾을 수 없습니다.</strong>
            <p>저장된 채널은 삭제하지 않았습니다. 잠시 후 다시 확인해 주세요.</p>
          </div>
          <div className="detail-request-state__actions">
            <button type="button" onClick={handleRetry}>다시 시도</button>
          </div>
        </div>
      )}

      {detail && (
        <>
          {detailState.status === 'loading' && (
            <DetailStatus isLoading compact />
          )}
          {detailState.status === 'error' && (
            <DetailStatus
              error={detailState.error}
              onRetry={handleRetry}
              onOpenApiSettings={onOpenApiSettings}
              compact
            />
          )}
          {renderLoadedDetail()}
        </>
      )}

      <p className="visually-hidden" id={descriptionId}>
        {displayedChannelName} 채널의 재생 가능한 대표 영상, 채널 정보와 선택 가능한 최신 동영상 목록
      </p>
    </Modal>
  )
}

export default ChannelDetailModal
