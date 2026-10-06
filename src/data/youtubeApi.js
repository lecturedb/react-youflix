import { restoreApiKey } from './apiKeyStorage.js'

export const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3'

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CACHE_ENTRIES = 100
const DEFAULT_SEARCH_RESULTS = 10
const DEFAULT_VIDEO_RESULTS = 10

const cache = new Map()
const pendingRequests = new Map()

const QUOTA_REASONS = new Set([
  'dailyLimitExceeded',
  'dailyLimitExceededUnreg',
  'quotaExceeded',
])

const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'rateLimitExceededUnreg',
  'servingLimitExceeded',
  'userRateLimitExceeded',
  'userRateLimitExceededUnreg',
])

const KEY_REASONS = new Set([
  'apiKeyExpired',
  'ipRefererBlocked',
  'keyInvalid',
])

const PERMISSION_REASONS = new Set([
  'accessNotConfigured',
  'forbidden',
  'insufficientPermissions',
])

const ERROR_DEFINITIONS = Object.freeze({
  ABORTED: {
    message: '요청이 취소되었습니다.',
    retryable: false,
    action: null,
  },
  INVALID_INPUT: {
    message: '요청에 필요한 값을 확인해 주세요.',
    retryable: false,
    action: null,
  },
  MISSING_API_KEY: {
    message: 'YouTube API 키를 먼저 저장해 주세요.',
    retryable: false,
    action: 'OPEN_API_KEY_SETTINGS',
  },
  API_KEY_INVALID: {
    message: '저장된 API 키가 올바르지 않습니다. API 키 입력에서 수정해 주세요.',
    retryable: false,
    action: 'EDIT_API_KEY',
  },
  PERMISSION_DENIED: {
    message: '이 API 키로 YouTube Data API를 사용할 수 없습니다. API 설정과 권한을 확인해 주세요.',
    retryable: false,
    action: 'EDIT_API_KEY',
  },
  QUOTA_EXCEEDED: {
    message: 'YouTube API 사용 한도를 초과했습니다. 나중에 다시 시도해 주세요.',
    retryable: true,
    action: 'RETRY_LATER',
  },
  RATE_LIMITED: {
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
    action: 'RETRY',
  },
  NETWORK_ERROR: {
    message: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
    retryable: true,
    action: 'RETRY',
  },
  TEMPORARY_ERROR: {
    message: 'YouTube API에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
    action: 'RETRY',
  },
  REQUEST_FAILED: {
    message: 'YouTube 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
    retryable: true,
    action: 'RETRY',
  },
})

export class YouTubeApiError extends Error {
  constructor(code, { status = null, reason = null } = {}) {
    const definition = ERROR_DEFINITIONS[code] ?? ERROR_DEFINITIONS.REQUEST_FAILED
    super(definition.message)
    this.name = 'YouTubeApiError'
    this.code = Object.hasOwn(ERROR_DEFINITIONS, code) ? code : 'REQUEST_FAILED'
    this.status = status
    this.reason = reason
    this.retryable = definition.retryable
    this.action = definition.action
  }
}

function createInvalidInputError() {
  return new YouTubeApiError('INVALID_INPUT')
}

function normalizeMaxResults(value, fallback) {
  if (value === undefined) return fallback
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 50
    ? number
    : fallback
}

function fingerprint(value) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function createCacheKey(resource, params, apiKey) {
  const normalizedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&')

  return `${fingerprint(apiKey)}:${resource}?${normalizedParams}`
}

function trimCache() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
}

function getErrorReason(payload) {
  return payload?.error?.errors?.[0]?.reason ?? null
}

function classifyResponseError(status, reason) {
  if (QUOTA_REASONS.has(reason)) return 'QUOTA_EXCEEDED'
  if (RATE_LIMIT_REASONS.has(reason) || status === 429) return 'RATE_LIMITED'
  if (KEY_REASONS.has(reason) || status === 401) return 'API_KEY_INVALID'
  if (PERMISSION_REASONS.has(reason) || status === 403) return 'PERMISSION_DENIED'
  if (status >= 500) return 'TEMPORARY_ERROR'
  return 'REQUEST_FAILED'
}

async function parseErrorPayload(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function readStoredApiKey(storage) {
  const result = restoreApiKey({ storage })

  if (!result.ok || !result.hasKey || !result.apiKey) {
    throw new YouTubeApiError('MISSING_API_KEY')
  }

  return result.apiKey
}

export function clearYouTubeApiCache() {
  cache.clear()
  pendingRequests.clear()
}

export function requestYouTube(resource, params, {
  storage,
  fetchImpl = globalThis.fetch,
  signal,
  forceRefresh = false,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  now = Date.now,
} = {}) {
  let apiKey

  try {
    apiKey = readStoredApiKey(storage)
  } catch (error) {
    return Promise.reject(error)
  }

  const cacheKey = createCacheKey(resource, params, apiKey)
  const cached = cache.get(cacheKey)

  if (!forceRefresh && cached && cached.expiresAt > now()) {
    return Promise.resolve(cached.data)
  }

  if (!forceRefresh && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)
  }

  if (typeof fetchImpl !== 'function') {
    return Promise.reject(new YouTubeApiError('NETWORK_ERROR'))
  }

  const url = new URL(`${YOUTUBE_API_BASE_URL}/${resource}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  url.searchParams.set('key', apiKey)

  const request = Promise.resolve()
    .then(() => fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    }))
    .then(async (response) => {
      if (!response.ok) {
        const payload = await parseErrorPayload(response)
        const reason = getErrorReason(payload)
        throw new YouTubeApiError(classifyResponseError(response.status, reason), {
          status: response.status,
          reason,
        })
      }

      return response.json()
    })
    .then((data) => {
      cache.set(cacheKey, {
        data,
        expiresAt: now() + Math.max(0, cacheTtlMs),
      })
      trimCache()
      return data
    })
    .catch((error) => {
      if (error instanceof YouTubeApiError) throw error
      if (error?.name === 'AbortError') throw new YouTubeApiError('ABORTED')
      throw new YouTubeApiError('NETWORK_ERROR')
    })
    .finally(() => {
      if (pendingRequests.get(cacheKey) === request) {
        pendingRequests.delete(cacheKey)
      }
    })

  pendingRequests.set(cacheKey, request)
  return request
}

export function searchChannels(query, options = {}) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : ''
  if (!normalizedQuery) return Promise.reject(createInvalidInputError())

  if (normalizedQuery.startsWith('@')) {
    return requestYouTube('channels', {
      part: 'snippet,statistics,contentDetails',
      forHandle: normalizedQuery,
      maxResults: 1,
    }, options)
  }

  return requestYouTube('search', {
    part: 'snippet',
    type: 'channel',
    q: normalizedQuery,
    maxResults: normalizeMaxResults(options.maxResults, DEFAULT_SEARCH_RESULTS),
  }, options)
}

export async function getChannelById(channelId, options = {}) {
  const normalizedId = typeof channelId === 'string' ? channelId.trim() : ''
  if (!normalizedId) throw createInvalidInputError()

  const response = await requestYouTube('channels', {
    part: 'snippet,statistics,contentDetails',
    id: normalizedId,
    maxResults: 1,
  }, options)

  return response.items?.[0] ?? null
}

export function getPlaylistItems(playlistId, options = {}) {
  const normalizedId = typeof playlistId === 'string' ? playlistId.trim() : ''
  if (!normalizedId) return Promise.reject(createInvalidInputError())

  return requestYouTube('playlistItems', {
    part: 'snippet,contentDetails,status',
    playlistId: normalizedId,
    maxResults: normalizeMaxResults(options.maxResults, DEFAULT_VIDEO_RESULTS),
  }, options)
}

export function getVideoDetails(videoIds, options = {}) {
  const normalizedIds = Array.from(new Set(
    (Array.isArray(videoIds) ? videoIds : [])
      .filter(id => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean),
  )).slice(0, 50)

  if (normalizedIds.length === 0) return Promise.resolve({ items: [] })

  return requestYouTube('videos', {
    part: 'snippet,contentDetails,statistics,status',
    id: normalizedIds.join(','),
    maxResults: normalizedIds.length,
  }, options)
}

export async function getLatestChannelVideos(channelId, options = {}) {
  const result = {
    channel: null,
    playlistItems: [],
    videos: [],
    errors: {},
  }

  result.channel = await getChannelById(channelId, options)
  if (!result.channel) return result

  const uploadsPlaylistId = result.channel.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) return result

  let playlistResponse

  try {
    playlistResponse = await getPlaylistItems(uploadsPlaylistId, options)
    result.playlistItems = playlistResponse.items ?? []
  } catch (error) {
    result.errors.playlist = error
    return result
  }

  const videoIds = result.playlistItems.map(item => (
    item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
  ))

  try {
    const videoResponse = await getVideoDetails(videoIds, options)
    result.videos = videoResponse.items ?? []
  } catch (error) {
    result.errors.videos = error
  }

  return result
}
