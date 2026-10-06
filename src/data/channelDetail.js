const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR')
const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
})

export function formatStatistic(value, { isPrivate = false } = {}) {
  if (isPrivate) return '비공개'
  if (value === null || value === undefined || value === '') return '정보 없음'

  const number = Number(value)
  return Number.isFinite(number) ? NUMBER_FORMATTER.format(number) : '정보 없음'
}

export function formatPublishedAt(value) {
  if (!value) return '정보 없음'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '정보 없음' : DATE_FORMATTER.format(date)
}

export function formatDuration(value) {
  if (typeof value !== 'string') return '정보 없음'

  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return '정보 없음'

  const [, hours, minutes, seconds] = match
  const parts = []

  if (hours) parts.push(`${Number(hours)}시간`)
  if (minutes) parts.push(`${Number(minutes)}분`)
  if (seconds || parts.length === 0) parts.push(`${Number(seconds || 0)}초`)

  return parts.join(' ')
}

function getThumbnailUrl(thumbnails) {
  return thumbnails?.maxres?.url
    ?? thumbnails?.high?.url
    ?? thumbnails?.medium?.url
    ?? thumbnails?.default?.url
}

function getPlaybackState(videoId, details, playlistItem) {
  if (!videoId) {
    return {
      isPlayable: false,
      unavailableMessage: '영상 ID를 확인할 수 없어 재생할 수 없습니다.',
    }
  }

  if (!details) {
    return {
      isPlayable: false,
      unavailableMessage: '삭제되었거나 비공개로 전환된 영상입니다.',
    }
  }

  if (
    details.status?.privacyStatus === 'private'
    || playlistItem?.status?.privacyStatus === 'private'
  ) {
    return {
      isPlayable: false,
      unavailableMessage: '비공개 영상이라 재생할 수 없습니다.',
    }
  }

  if (details.status?.embeddable === false) {
    return {
      isPlayable: false,
      unavailableMessage: '소유자 설정으로 이 앱에서 재생할 수 없습니다.',
    }
  }

  if (['deleted', 'failed', 'rejected'].includes(details.status?.uploadStatus)) {
    return {
      isPlayable: false,
      unavailableMessage: '삭제되었거나 재생이 제한된 영상입니다.',
    }
  }

  return { isPlayable: true }
}

/** YouTube Data API의 채널·업로드·영상 응답을 상세 화면 모델로 결합한다. */
export function buildChannelDetail({
  channel,
  playlistItems = [],
  videoDetails = [],
} = {}) {
  const detailsById = new Map(videoDetails.map(video => [video.id, video]))
  const channelSnippet = channel?.snippet ?? {}
  const channelStatistics = channel?.statistics ?? {}
  const description = channelSnippet.description?.trim()

  const videos = playlistItems.map((upload, index) => {
    const uploadSnippet = upload.snippet ?? {}
    const videoId = upload.contentDetails?.videoId ?? uploadSnippet.resourceId?.videoId
    const details = detailsById.get(videoId)
    const detailSnippet = details?.snippet ?? {}

    return {
      id: videoId ?? `unavailable-video-${index}`,
      youtubeVideoId: videoId,
      title: detailSnippet.title ?? uploadSnippet.title ?? '제목 정보 없음',
      publishedAt: upload.contentDetails?.videoPublishedAt
        ?? detailSnippet.publishedAt
        ?? uploadSnippet.publishedAt,
      thumbnailUrl: getThumbnailUrl(detailSnippet.thumbnails)
        ?? getThumbnailUrl(uploadSnippet.thumbnails),
      duration: details?.contentDetails?.duration,
      statistics: {
        views: details?.statistics?.viewCount,
        likes: details?.statistics?.likeCount,
        comments: details?.statistics?.commentCount,
      },
      playback: getPlaybackState(videoId, details, upload),
    }
  }).sort((first, second) => (
    new Date(second.publishedAt ?? 0).getTime()
      - new Date(first.publishedAt ?? 0).getTime()
  ))

  return {
    channel: {
      id: channel?.id,
      name: channelSnippet.title ?? '채널 이름 정보 없음',
      imageUrl: getThumbnailUrl(channelSnippet.thumbnails),
      ...(description ? { description } : {}),
      statistics: {
        videos: channelStatistics.videoCount,
        subscribers: channelStatistics.subscriberCount,
        subscribersHidden: Boolean(channelStatistics.hiddenSubscriberCount),
        views: channelStatistics.viewCount,
      },
    },
    videos,
    featuredVideo: videos[0] ?? null,
  }
}
