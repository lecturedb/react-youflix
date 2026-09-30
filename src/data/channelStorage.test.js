import assert from 'node:assert/strict'
import test from 'node:test'
import { initialChannels } from './channels.js'
import {
  CHANNELS_STORAGE_KEY,
  restoreCurrentChannels,
  saveCurrentChannels,
  validateChannelList,
} from './channelStorage.js'

function createStorage(initialValue = null) {
  let value = initialValue

  return {
    getItem(key) {
      assert.equal(key, CHANNELS_STORAGE_KEY)
      return value
    },
    setItem(key, nextValue) {
      assert.equal(key, CHANNELS_STORAGE_KEY)
      value = nextValue
    },
    peek() {
      return value
    },
  }
}

test('저장값이 없을 때만 초기 목록으로 시작한다', () => {
  const storage = createStorage()
  const result = restoreCurrentChannels({ storage })

  assert.equal(result.ok, true)
  assert.equal(result.source, 'initial')
  assert.deepEqual(result.channels, initialChannels)
  assert.notEqual(result.channels, initialChannels)
  assert.equal(storage.peek(), null)
})

test('저장된 빈 배열과 수정·삭제·순서를 그대로 복원하고 초기 데이터를 합치지 않는다', () => {
  const emptyResult = restoreCurrentChannels({ storage: createStorage('[]') })
  assert.equal(emptyResult.source, 'storage')
  assert.deepEqual(emptyResult.channels, [])

  const edited = [
    { ...initialChannels[4], name: '수정된 채널', category: '엔터' },
    initialChannels[1],
  ]
  const result = restoreCurrentChannels({ storage: createStorage(JSON.stringify(edited)) })

  assert.equal(result.ok, true)
  assert.equal(result.source, 'storage')
  assert.deepEqual(result.channels, edited)
  assert.equal(result.channels.length, 2)
  assert.ok(!result.channels.some(channel => channel.id === initialChannels[0].id))
})

test('현재 목록 전체를 저장한 뒤 빈 목록까지 재접속 시 복원한다', () => {
  const storage = createStorage()
  const currentChannels = [initialChannels[0]]
  const nextChannels = [initialChannels[2], initialChannels[0]]
  const saved = saveCurrentChannels(nextChannels, { storage, currentChannels })

  assert.equal(saved.ok, true)
  assert.deepEqual(saved.channels, nextChannels)
  assert.deepEqual(restoreCurrentChannels({ storage }).channels, nextChannels)

  const emptied = saveCurrentChannels([], { storage, currentChannels: saved.channels })
  assert.equal(emptied.ok, true)
  assert.deepEqual(restoreCurrentChannels({ storage }).channels, [])
})

test('채널 저장값에는 현재 목록 필드만 포함하고 API 키 같은 별도 정보는 넣지 않는다', () => {
  const storage = createStorage()
  const channelWithUnrelatedData = {
    ...initialChannels[0],
    apiKey: 'should-not-be-persisted',
    statistics: { subscribers: 100 },
  }

  const result = saveCurrentChannels([channelWithUnrelatedData], { storage })
  const storedChannel = JSON.parse(storage.peek())[0]

  assert.equal(result.ok, true)
  assert.deepEqual(storedChannel, initialChannels[0])
  assert.equal(Object.hasOwn(storedChannel, 'apiKey'), false)
  assert.equal(Object.hasOwn(storedChannel, 'statistics'), false)
})

test('손상 JSON과 유효하지 않은 레코드는 원본을 덮어쓰지 않고 기존 정상 목록을 유지한다', () => {
  const currentChannels = [initialChannels[0]]
  const brokenJsonStorage = createStorage('{broken')
  const brokenJson = restoreCurrentChannels({ storage: brokenJsonStorage, currentChannels })

  assert.equal(brokenJson.ok, false)
  assert.equal(brokenJson.error.code, 'PARSE_FAILED')
  assert.deepEqual(brokenJson.channels, currentChannels)
  assert.equal(brokenJsonStorage.peek(), '{broken')

  const invalidValue = JSON.stringify([{ ...initialChannels[1], category: '잘못된 카테고리' }])
  const invalidStorage = createStorage(invalidValue)
  const invalidResult = restoreCurrentChannels({ storage: invalidStorage, currentChannels })

  assert.equal(invalidResult.ok, false)
  assert.equal(invalidResult.error.code, 'INVALID_DATA')
  assert.match(invalidResult.error.details, /카테고리/)
  assert.deepEqual(invalidResult.channels, currentChannels)
  assert.equal(invalidStorage.peek(), invalidValue)
})

test('저장소 읽기 실패는 초기 데이터로 대체하지 않고 기존 정상 목록을 유지한다', () => {
  const currentChannels = [initialChannels[3]]
  const result = restoreCurrentChannels({
    currentChannels,
    storage: {
      getItem() {
        throw new Error('read denied')
      },
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'READ_FAILED')
  assert.deepEqual(result.channels, currentChannels)
})

test('검증 또는 저장 실패 시 저장 원본과 기존 정상 목록을 보존한다', () => {
  const currentChannels = [initialChannels[0]]
  const storedOriginal = JSON.stringify(currentChannels)
  const storage = createStorage(storedOriginal)
  const invalidResult = saveCurrentChannels(
    [{ ...initialChannels[1], id: '' }],
    { storage, currentChannels },
  )

  assert.equal(invalidResult.ok, false)
  assert.equal(invalidResult.error.code, 'INVALID_DATA')
  assert.deepEqual(invalidResult.channels, currentChannels)
  assert.equal(storage.peek(), storedOriginal)

  const writeResult = saveCurrentChannels(
    [initialChannels[1]],
    {
      currentChannels,
      storage: {
        getItem: () => storedOriginal,
        setItem() {
          throw new Error('quota exceeded')
        },
      },
    },
  )

  assert.equal(writeResult.ok, false)
  assert.equal(writeResult.error.code, 'WRITE_FAILED')
  assert.deepEqual(writeResult.channels, currentChannels)
})

test('중복 ID와 복구 불가능한 필드를 목록 검증에서 감지한다', () => {
  assert.equal(validateChannelList([initialChannels[0], initialChannels[0]]).ok, false)
  assert.equal(validateChannelList([{ ...initialChannels[0], name: '   ' }]).ok, false)
  assert.equal(validateChannelList([{ ...initialChannels[0], imageUrl: 1 }]).ok, false)
  assert.equal(validateChannelList({}).ok, false)
})
