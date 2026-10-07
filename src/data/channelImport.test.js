import assert from 'node:assert/strict'
import test from 'node:test'
import { serializeChannelExport } from './channelExport.js'
import {
  mergeChannelImport,
  parseChannelImport,
  readChannelImportFile,
} from './channelImport.js'

const currentChannels = [
  { id: 'existing', name: '사용자 수정 이름', category: '음악', imageUrl: 'https://example.com/current.jpg' },
]

test('내보낸 파일을 다시 읽고 허용 필드와 순서를 유지한다', () => {
  const channels = [
    { id: 'one', name: '첫 채널', category: '뉴스' },
    { id: 'two', name: '둘째 채널', category: '영화', imageUrl: 'https://example.com/two.jpg' },
  ]
  const result = parseChannelImport(serializeChannelExport(channels))

  assert.equal(result.ok, true)
  assert.deepEqual(result.channels, channels)
  assert.equal(result.duplicateCount, 0)
})

test('파일 내부 중복은 모두 검증한 뒤 첫 ID만 사용한다', () => {
  const result = parseChannelImport(JSON.stringify({
    formatVersion: 1,
    channels: [
      { id: 'same', name: '첫 항목', category: '코딩' },
      { id: 'same', name: '뒤의 중복', category: '뉴스' },
      { id: 'new', name: '신규', category: '코딩' },
    ],
  }))

  assert.equal(result.ok, true)
  assert.deepEqual(result.channels.map(channel => channel.name), ['첫 항목', '신규'])
  assert.equal(result.duplicateCount, 1)
})

test('기존 ID의 수정 값은 유지하고 신규 채널만 파일 순서대로 끝에 병합한다', () => {
  const imported = [
    { id: 'new-1', name: '신규 1', category: '뉴스' },
    { id: 'existing', name: '파일의 원래 이름', category: '영화' },
    { id: 'new-2', name: '신규 2', category: '뉴스' },
  ]
  const result = mergeChannelImport(currentChannels, imported, 2)

  assert.deepEqual(result.channels, [currentChannels[0], imported[0], imported[2]])
  assert.deepEqual(result.additions, [imported[0], imported[2]])
  assert.equal(result.addedCount, 2)
  assert.equal(result.skippedCount, 3)
})

test('삭제되어 현재 목록에 없는 ID는 신규로 추가하고 빈 파일은 목록을 지우지 않는다', () => {
  const deletedChannel = { id: 'deleted', name: '다시 추가', category: '엔터' }
  assert.deepEqual(
    mergeChannelImport(currentChannels, [deletedChannel]).channels,
    [...currentChannels, deletedChannel],
  )
  assert.deepEqual(mergeChannelImport(currentChannels, []).channels, currentChannels)
})

test('잘못된 JSON·구조·버전은 구분해 거부한다', () => {
  assert.equal(parseChannelImport('{broken').error.code, 'PARSE_FAILED')
  assert.equal(parseChannelImport('[]').error.code, 'INVALID_STRUCTURE')
  assert.equal(parseChannelImport(JSON.stringify({ formatVersion: 2, channels: [] })).error.code, 'UNSUPPORTED_VERSION')
  assert.equal(parseChannelImport(JSON.stringify({ formatVersion: 1, channels: {} })).error.code, 'INVALID_STRUCTURE')
})

test('레코드 하나라도 잘못되면 유효한 항목도 반환하지 않는다', () => {
  const invalidRecords = [
    { id: '', name: '이름', category: '음악' },
    { id: 'id', name: '   ', category: '음악' },
    { id: 'id', name: '이름', category: '기타' },
    { id: 'id', name: '이름', category: '음악', imageUrl: 1 },
    { id: 'id', name: '이름', category: '음악', imageUrl: 'not-a-url' },
  ]

  for (const invalidRecord of invalidRecords) {
    const result = parseChannelImport(JSON.stringify({
      formatVersion: 1,
      channels: [
        { id: 'valid', name: '정상', category: '뉴스' },
        invalidRecord,
      ],
    }))
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'INVALID_CHANNEL')
    assert.match(result.error.details, /2번째/)
    assert.equal(Object.hasOwn(result, 'channels'), false)
  }
})

test('파일 읽기 실패를 안전한 오류로 변환한다', async () => {
  const result = await readChannelImportFile({
    async text() { throw new Error('read denied') },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'READ_FAILED')
})
