export const API_KEY_STORAGE_KEY = 'youflix.youtubeApiKey.v1'

const ERROR_MESSAGES = Object.freeze({
  EMPTY_KEY: 'API 키를 입력해 주세요.',
  STORAGE_UNAVAILABLE: '브라우저 저장소를 사용할 수 없습니다.',
  READ_FAILED: '저장된 API 키 상태를 확인하지 못했습니다.',
  WRITE_FAILED: 'API 키를 저장하지 못했습니다.',
})

function createError(code) {
  return {
    code,
    message: ERROR_MESSAGES[code],
  }
}

function getStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available outside a browser')
  }
  return window.localStorage
}

export function restoreApiKey({ storage } = {}) {
  let localStorage

  try {
    localStorage = getStorage(storage)
  } catch {
    return {
      ok: false,
      apiKey: null,
      hasKey: false,
      error: createError('STORAGE_UNAVAILABLE'),
    }
  }

  try {
    const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY)

    return {
      ok: true,
      apiKey,
      hasKey: typeof apiKey === 'string' && apiKey.length > 0,
      error: null,
    }
  } catch {
    return {
      ok: false,
      apiKey: null,
      hasKey: false,
      error: createError('READ_FAILED'),
    }
  }
}

export function saveApiKey(value, { storage } = {}) {
  const apiKey = typeof value === 'string' ? value.trim() : ''

  if (!apiKey) {
    return {
      ok: false,
      apiKey: null,
      hasKey: false,
      error: createError('EMPTY_KEY'),
    }
  }

  let localStorage

  try {
    localStorage = getStorage(storage)
  } catch {
    return {
      ok: false,
      apiKey: null,
      hasKey: false,
      error: createError('STORAGE_UNAVAILABLE'),
    }
  }

  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
  } catch {
    return {
      ok: false,
      apiKey: null,
      hasKey: false,
      error: createError('WRITE_FAILED'),
    }
  }

  return {
    ok: true,
    apiKey,
    hasKey: true,
    error: null,
  }
}
