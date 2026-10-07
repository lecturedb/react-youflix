import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHANNEL_EXPORT_FORMAT_VERSION,
  createChannelExportData,
  downloadChannelExport,
  serializeChannelExport,
} from './channelExport.js'

const channels = [
  {
    id: 'channel-2',
    name: '수정된 채널',
    category: '뉴스',
    imageUrl: 'https://example.com/edited.jpg',
    apiKey: 'never-export-this',
    statistics: { subscribers: 100 },
  },
  { id: 'channel-1', name: '이미지 없는 채널', category: '음악' },
  { id: 'channel-2', name: '뒤의 중복', category: '영화' },
]

test('형식 버전과 현재 목록 순서를 유지하고 중복 ID와 비공개 필드를 제외한다', () => {
  const data = createChannelExportData(channels)

  assert.deepEqual(data, {
    formatVersion: CHANNEL_EXPORT_FORMAT_VERSION,
    channels: [
      {
        id: 'channel-2',
        name: '수정된 채널',
        category: '뉴스',
        imageUrl: 'https://example.com/edited.jpg',
      },
      { id: 'channel-1', name: '이미지 없는 채널', category: '음악' },
    ],
  })
  assert.equal(JSON.stringify(data).includes('never-export-this'), false)
  assert.equal(JSON.stringify(data).includes('statistics'), false)
})

test('빈 현재 목록도 버전이 있는 JSON으로 직렬화한다', () => {
  assert.deepEqual(JSON.parse(serializeChannelExport([])), {
    formatVersion: CHANNEL_EXPORT_FORMAT_VERSION,
    channels: [],
  })
})

test('다운로드 파일명과 JSON 내용을 만들고 임시 URL을 정리한다', async () => {
  let downloadedBlob
  let clicked = false
  let removed = false
  let revokedUrl
  const anchor = {
    click() { clicked = true },
    remove() { removed = true },
  }
  const result = downloadChannelExport(channels, {
    documentRef: {
      createElement: () => anchor,
      body: { appendChild: () => {} },
    },
    urlApi: {
      createObjectURL(blob) {
        downloadedBlob = blob
        return 'blob:test-export'
      },
      revokeObjectURL(url) { revokedUrl = url },
    },
    now: new Date(2026, 9, 7),
  })

  assert.equal(result.ok, true)
  assert.equal(result.channelCount, 2)
  assert.equal(result.filename, 'youflix-channels-2026-10-07.json')
  assert.equal(anchor.download, result.filename)
  assert.equal(anchor.href, 'blob:test-export')
  assert.equal(clicked, true)
  assert.equal(removed, true)
  assert.equal(revokedUrl, 'blob:test-export')
  assert.deepEqual(JSON.parse(await downloadedBlob.text()), createChannelExportData(channels))
})

test('다운로드 실패를 알리고 만들어진 임시 URL을 정리한다', () => {
  let revokedUrl
  const result = downloadChannelExport(channels, {
    documentRef: {
      createElement: () => ({
        click() { throw new Error('download blocked') },
        remove() {},
      }),
      body: { appendChild: () => {} },
    },
    urlApi: {
      createObjectURL: () => 'blob:failed-export',
      revokeObjectURL(url) { revokedUrl = url },
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'EXPORT_FAILED')
  assert.match(result.error.message, /다시 시도/)
  assert.equal(revokedUrl, 'blob:failed-export')
})
