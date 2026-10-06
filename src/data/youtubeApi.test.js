import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import {
  clearYouTubeApiCache,
  getChannelById,
  getLatestChannelVideos,
  getVideoDetails,
  requestYouTube,
  searchChannels,
  YouTubeApiError,
} from './youtubeApi.js'

function createStorage(apiKey = 'test-api-key') {
  return {
    getItem() {
      return apiKey
    },
  }
}

function createResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data,
  }
}

beforeEach(() => {
  clearYouTubeApiCache()
})

test('저장된 키로 채널명 검색과 @핸들 조회 요청을 구성한다', async () => {
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    return createResponse({ items: [] })
  }
  const options = { storage: createStorage(), fetchImpl }

  await searchChannels(' Google ', options)
  await searchChannels('@GoogleDevelopers', options)

  assert.equal(urls[0].pathname, '/youtube/v3/search')
  assert.equal(urls[0].searchParams.get('q'), 'Google')
  assert.equal(urls[0].searchParams.get('type'), 'channel')
  assert.equal(urls[1].pathname, '/youtube/v3/channels')
  assert.equal(urls[1].searchParams.get('forHandle'), '@GoogleDevelopers')
  assert.equal(urls[0].searchParams.get('key'), 'test-api-key')
})

test('채널 정보와 uploads 재생목록, 영상 메타데이터를 순서대로 조회한다', async () => {
  const resources = []
  const fetchImpl = async (url) => {
    resources.push(url.pathname)

    if (url.pathname.endsWith('/channels')) {
      return createResponse({
        items: [{
          id: 'channel-1',
          contentDetails: { relatedPlaylists: { uploads: 'uploads-1' } },
        }],
      })
    }

    if (url.pathname.endsWith('/playlistItems')) {
      return createResponse({
        items: [
          { contentDetails: { videoId: 'video-1' } },
          { snippet: { resourceId: { videoId: 'video-2' } } },
        ],
      })
    }

    return createResponse({ items: [{ id: 'video-1' }, { id: 'video-2' }] })
  }

  const result = await getLatestChannelVideos('channel-1', {
    storage: createStorage(),
    fetchImpl,
  })

  assert.deepEqual(resources, [
    '/youtube/v3/channels',
    '/youtube/v3/playlistItems',
    '/youtube/v3/videos',
  ])
  assert.equal(result.channel.id, 'channel-1')
  assert.equal(result.playlistItems.length, 2)
  assert.equal(result.videos.length, 2)
  assert.deepEqual(result.errors, {})
})

test('일부 영상 조회 실패 시 성공한 채널과 목록 데이터를 유지한다', async () => {
  const fetchImpl = async (url) => {
    if (url.pathname.endsWith('/channels')) {
      return createResponse({
        items: [{
          id: 'channel-1',
          contentDetails: { relatedPlaylists: { uploads: 'uploads-1' } },
        }],
      })
    }
    if (url.pathname.endsWith('/playlistItems')) {
      return createResponse({ items: [{ contentDetails: { videoId: 'video-1' } }] })
    }
    throw new TypeError('network disconnected')
  }

  const result = await getLatestChannelVideos('channel-1', {
    storage: createStorage(),
    fetchImpl,
  })

  assert.equal(result.channel.id, 'channel-1')
  assert.equal(result.playlistItems.length, 1)
  assert.deepEqual(result.videos, [])
  assert.equal(result.errors.videos.code, 'NETWORK_ERROR')
})

test('동일 요청을 공유하고 성공 응답을 캐시하며 강제 갱신을 지원한다', async () => {
  let callCount = 0
  let resolveFetch
  const fetchImpl = () => {
    callCount += 1
    return new Promise((resolve) => {
      resolveFetch = () => resolve(createResponse({ items: [{ id: callCount }] }))
    })
  }
  const options = { storage: createStorage(), fetchImpl }

  const first = getChannelById('channel-1', options)
  const duplicate = getChannelById('channel-1', options)
  await Promise.resolve()
  assert.equal(callCount, 1)
  resolveFetch()
  assert.deepEqual(await first, { id: 1 })
  assert.deepEqual(await duplicate, { id: 1 })

  assert.deepEqual(await getChannelById('channel-1', options), { id: 1 })
  assert.equal(callCount, 1)

  const refreshed = getChannelById('channel-1', { ...options, forceRefresh: true })
  await Promise.resolve()
  assert.equal(callCount, 2)
  resolveFetch()
  assert.deepEqual(await refreshed, { id: 2 })
})

test('키 없음과 인증·권한·한도·네트워크·일시 오류를 안전한 공통 오류로 분류한다', async () => {
  await assert.rejects(
    searchChannels('Google', { storage: createStorage(null), fetchImpl: async () => {} }),
    error => error.code === 'MISSING_API_KEY'
      && error.action === 'OPEN_API_KEY_SETTINGS',
  )

  const cases = [
    [400, 'keyInvalid', 'API_KEY_INVALID', 'EDIT_API_KEY'],
    [403, 'accessNotConfigured', 'PERMISSION_DENIED', 'EDIT_API_KEY'],
    [403, 'quotaExceeded', 'QUOTA_EXCEEDED', 'RETRY_LATER'],
    [429, 'rateLimitExceeded', 'RATE_LIMITED', 'RETRY'],
    [503, 'backendError', 'TEMPORARY_ERROR', 'RETRY'],
  ]

  for (const [status, reason, code, action] of cases) {
    clearYouTubeApiCache()
    const fetchImpl = async () => createResponse({
      error: { errors: [{ reason }], message: `secret test-api-key ${reason}` },
    }, { ok: false, status })

    await assert.rejects(
      requestYouTube('channels', { part: 'snippet', id: 'channel-1' }, {
        storage: createStorage(),
        fetchImpl,
      }),
      (error) => {
        assert.ok(error instanceof YouTubeApiError)
        assert.equal(error.code, code)
        assert.equal(error.action, action)
        assert.doesNotMatch(error.message, /test-api-key/)
        return true
      },
    )
  }

  clearYouTubeApiCache()
  await assert.rejects(
    getVideoDetails(['video-1'], {
      storage: createStorage(),
      fetchImpl: async () => {
        throw new TypeError('offline')
      },
    }),
    error => error.code === 'NETWORK_ERROR'
      && error.retryable === true
      && error.action === 'RETRY',
  )
})

test('빈 검색과 채널 ID를 API 요청 전에 차단한다', async () => {
  let callCount = 0
  const options = {
    storage: createStorage(),
    fetchImpl: async () => {
      callCount += 1
      return createResponse({ items: [] })
    },
  }

  await assert.rejects(searchChannels('   ', options), error => error.code === 'INVALID_INPUT')
  await assert.rejects(getChannelById('', options), error => error.code === 'INVALID_INPUT')
  assert.equal(callCount, 0)
})
