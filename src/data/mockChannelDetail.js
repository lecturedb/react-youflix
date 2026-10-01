import { chResponse, uploadsResponse, videoResponse } from '../../reference/mock.js'

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

export function buildMockChannelDetail({
  channelResponse = chResponse,
  uploads = uploadsResponse,
  videoDetails = videoResponse,
} = {}) {
  const channelItem = channelResponse.items?.[0]
  const channelSnippet = channelItem?.snippet ?? {}
  const channelStatistics = channelItem?.statistics ?? {}
  const description = channelSnippet.description?.trim()

  const videos = (uploads.items ?? []).map((upload, index) => {
    const details = videoDetails[index]?.items?.[0] ?? {}
    const snippet = upload.snippet ?? {}

    return {
      id: snippet.resourceId?.videoId ?? `mock-video-${index}`,
      title: snippet.title ?? '제목 정보 없음',
      publishedAt: snippet.publishedAt,
      thumbnailUrl: snippet.thumbnails?.medium?.url,
      duration: details.contentDetails?.duration,
      statistics: {
        views: details.statistics?.viewCount,
        likes: details.statistics?.likeCount,
        comments: details.statistics?.commentCount,
      },
    }
  }).sort((first, second) => (
    new Date(second.publishedAt ?? 0).getTime()
      - new Date(first.publishedAt ?? 0).getTime()
  ))

  return {
    channel: {
      id: channelItem?.id,
      name: channelSnippet.title ?? '채널 이름 정보 없음',
      imageUrl: channelSnippet.thumbnails?.medium?.url,
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

export const mockChannelDetail = buildMockChannelDetail()
