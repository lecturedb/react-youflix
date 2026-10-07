import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeChannelSearchResults } from './channelSearch.js'

test('채널명 검색과 핸들 검색 응답을 같은 결과 형태로 변환한다', () => {
  const searchResults = normalizeChannelSearchResults({
    items: [{
      id: { channelId: 'search-id' },
      snippet: {
        title: ' 검색 결과 ',
        thumbnails: {
          default: { url: 'default.jpg' },
          high: { url: 'high.jpg' },
        },
      },
    }],
  })
  const handleResults = normalizeChannelSearchResults({
    items: [{
      id: 'handle-id',
      snippet: { title: '핸들 결과' },
    }],
  })

  assert.deepEqual(searchResults, [{
    id: 'search-id',
    name: '검색 결과',
    imageUrl: 'high.jpg',
  }])
  assert.deepEqual(handleResults, [{ id: 'handle-id', name: '핸들 결과' }])
})

test('ID·이름이 없는 항목과 중복 채널을 결과에서 제외한다', () => {
  const results = normalizeChannelSearchResults({
    items: [
      { id: { channelId: 'same-id' }, snippet: { title: '첫 결과' } },
      { id: { channelId: 'same-id' }, snippet: { title: '중복 결과' } },
      { id: { channelId: 'missing-name' }, snippet: {} },
      { snippet: { title: 'ID 없음' } },
    ],
  })

  assert.deepEqual(results, [{ id: 'same-id', name: '첫 결과' }])
  assert.deepEqual(normalizeChannelSearchResults(), [])
})
