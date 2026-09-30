import { useState } from 'react'

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16.5V20h3.5L18.1 9.4l-3.5-3.5L4 16.5Zm16.8-9.9a.94.94 0 0 0 0-1.3l-2.1-2.1a.94.94 0 0 0-1.3 0l-1.7 1.7 3.5 3.5 1.6-1.8Z" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 20a2 2 0 0 1-2-2V7h14v11a2 2 0 0 1-2 2H7Zm1-3h2V10H8v7Zm6 0h2V10h-2v7ZM4 6V4h5l1-1h4l1 1h5v2H4Z" />
    </svg>
  )
}

function ChannelCard({ channel }) {
  const [failedImageUrl, setFailedImageUrl] = useState(null)
  const initial = Array.from(channel.name.trim())[0] || '?'
  const showImage = channel.imageUrl && failedImageUrl !== channel.imageUrl

  return (
    <article className="channel-card">
      <button
        className="channel-card__view"
        type="button"
        aria-label={`${channel.name} 채널 상세 보기`}
        title={channel.name}
      >
        <span className="channel-card__image-wrap">
          {showImage ? (
            <img
              src={channel.imageUrl}
              alt={`${channel.name} 채널`}
              loading="lazy"
              onError={() => setFailedImageUrl(channel.imageUrl)}
            />
          ) : (
            <span
              className="channel-card__fallback"
              role="img"
              aria-label={`${channel.name} 채널 이미지 없음`}
            >
              {initial}
            </span>
          )}
        </span>
        <span className="channel-card__name">{channel.name}</span>
      </button>

      <div className="channel-card__actions">
        <button
          type="button"
          className="channel-card__action channel-card__action--edit"
          aria-label={`${channel.name} 채널 수정`}
          title={`${channel.name} 채널 수정`}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="channel-card__action channel-card__action--delete"
          aria-label={`${channel.name} 채널 삭제`}
          title={`${channel.name} 채널 삭제`}
        >
          <DeleteIcon />
        </button>
      </div>
    </article>
  )
}

export default ChannelCard
