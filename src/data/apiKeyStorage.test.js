import assert from 'node:assert/strict'
import test from 'node:test'
import {
  API_KEY_STORAGE_KEY,
  restoreApiKey,
  saveApiKey,
} from './apiKeyStorage.js'

function createStorage(initialValue = null) {
  let value = initialValue
  let writes = 0

  return {
    getItem(key) {
      assert.equal(key, API_KEY_STORAGE_KEY)
      return value
    },
    setItem(key, nextValue) {
      assert.equal(key, API_KEY_STORAGE_KEY)
      value = nextValue
      writes += 1
    },
    peek() {
      return value
    },
    writeCount() {
      return writes
    },
  }
}

test('API 키의 앞뒤 공백을 제거해 채널 목록과 별도 키로 저장한다', () => {
  const storage = createStorage()
  const result = saveApiKey('  test-api-key  ', { storage })

  assert.equal(result.ok, true)
  assert.equal(result.apiKey, 'test-api-key')
  assert.equal(storage.peek(), 'test-api-key')
  assert.equal(storage.writeCount(), 1)
})

test('빈 값과 공백만 있는 값은 저장하지 않는다', () => {
  const storage = createStorage('existing-key')

  for (const value of ['', '   ', null]) {
    const result = saveApiKey(value, { storage })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'EMPTY_KEY')
  }

  assert.equal(storage.peek(), 'existing-key')
  assert.equal(storage.writeCount(), 0)
})

test('새 키로 교체하고 다시 열거나 새로고침할 때 저장 상태를 복원한다', () => {
  const storage = createStorage('old-key')

  const beforeReplacement = restoreApiKey({ storage })
  assert.equal(beforeReplacement.ok, true)
  assert.equal(beforeReplacement.hasKey, true)
  assert.equal(beforeReplacement.apiKey, 'old-key')

  const saved = saveApiKey('new-key', { storage })
  const afterReplacement = restoreApiKey({ storage })

  assert.equal(saved.ok, true)
  assert.equal(afterReplacement.hasKey, true)
  assert.equal(afterReplacement.apiKey, 'new-key')
})

test('저장된 키가 없으면 정상적인 미저장 상태로 복원한다', () => {
  const result = restoreApiKey({ storage: createStorage() })

  assert.equal(result.ok, true)
  assert.equal(result.hasKey, false)
  assert.equal(result.apiKey, null)
})

test('읽기와 쓰기 실패를 성공으로 표시하지 않는다', () => {
  const readResult = restoreApiKey({
    storage: {
      getItem() {
        throw new Error('read denied')
      },
    },
  })
  const writeResult = saveApiKey('test-key', {
    storage: {
      setItem() {
        throw new Error('quota exceeded')
      },
    },
  })

  assert.equal(readResult.ok, false)
  assert.equal(readResult.error.code, 'READ_FAILED')
  assert.equal(writeResult.ok, false)
  assert.equal(writeResult.error.code, 'WRITE_FAILED')
})
