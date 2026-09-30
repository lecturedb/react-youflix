import { CATEGORIES, initialChannels } from './channels.js'

export const CHANNELS_STORAGE_KEY = 'youflix.currentChannels.v1'

const ERROR_MESSAGES = Object.freeze({
  STORAGE_UNAVAILABLE: '브라우저 저장소를 사용할 수 없습니다.',
  READ_FAILED: '저장된 채널 목록을 읽지 못했습니다.',
  PARSE_FAILED: '저장된 채널 목록의 JSON 형식이 올바르지 않습니다.',
  INVALID_DATA: '저장된 채널 목록에 복원할 수 없는 항목이 있습니다.',
  WRITE_FAILED: '현재 채널 목록을 저장하지 못했습니다.',
})

function createError(code, cause, details) {
  return {
    code,
    message: ERROR_MESSAGES[code],
    ...(details ? { details } : {}),
    ...(cause ? { cause } : {}),
  }
}

function getStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available outside a browser')
  }
  return window.localStorage
}

function copyChannel({ id, name, category, imageUrl }) {
  return {
    id,
    name,
    category,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

function copyList(channels) {
  return Array.isArray(channels) ? channels.map(copyChannel) : []
}

/** 저장하거나 복원할 수 있는 현재 채널 목록인지 검사한다. */
export function validateChannelList(value) {
  if (!Array.isArray(value)) {
    return { ok: false, details: '채널 목록이 배열이 아닙니다.' }
  }

  const ids = new Set()

  for (const [index, channel] of value.entries()) {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
      return { ok: false, details: `${index + 1}번째 채널이 객체가 아닙니다.` }
    }

    if (typeof channel.id !== 'string' || channel.id.trim() === '') {
      return { ok: false, details: `${index + 1}번째 채널의 ID가 올바르지 않습니다.` }
    }

    if (ids.has(channel.id)) {
      return { ok: false, details: `${index + 1}번째 채널의 ID가 중복됩니다.` }
    }

    if (typeof channel.name !== 'string' || channel.name.trim() === '') {
      return { ok: false, details: `${index + 1}번째 채널의 이름이 올바르지 않습니다.` }
    }

    if (!CATEGORIES.includes(channel.category)) {
      return { ok: false, details: `${index + 1}번째 채널의 카테고리가 올바르지 않습니다.` }
    }

    if (
      Object.hasOwn(channel, 'imageUrl')
      && channel.imageUrl !== undefined
      && typeof channel.imageUrl !== 'string'
    ) {
      return { ok: false, details: `${index + 1}번째 채널의 이미지 URL이 올바르지 않습니다.` }
    }

    ids.add(channel.id)
  }

  return { ok: true, channels: copyList(value) }
}

function failureResult(code, currentChannels, cause, details) {
  return {
    ok: false,
    source: 'current',
    channels: copyList(currentChannels),
    error: createError(code, cause, details),
  }
}

/**
 * 저장된 목록을 복원한다.
 * 저장값이 없을 때만 초기 목록을 현재 목록으로 저장해 사용한다.
 * 읽기 실패나 손상 데이터는 저장값 없음으로 취급하지 않고 기존 정상 목록을 유지한다.
 */
export function restoreCurrentChannels({ storage, currentChannels = [] } = {}) {
  let localStorage

  try {
    localStorage = getStorage(storage)
  } catch (error) {
    return failureResult('STORAGE_UNAVAILABLE', currentChannels, error)
  }

  let storedValue

  try {
    storedValue = localStorage.getItem(CHANNELS_STORAGE_KEY)
  } catch (error) {
    return failureResult('READ_FAILED', currentChannels, error)
  }

  if (storedValue === null) {
    const initialCurrentChannels = copyList(initialChannels)

    try {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(initialCurrentChannels))
    } catch (error) {
      return {
        ok: false,
        source: 'initial',
        channels: initialCurrentChannels,
        error: createError('WRITE_FAILED', error),
      }
    }

    return {
      ok: true,
      source: 'initial',
      channels: initialCurrentChannels,
      error: null,
    }
  }

  let parsedValue

  try {
    parsedValue = JSON.parse(storedValue)
  } catch (error) {
    return failureResult('PARSE_FAILED', currentChannels, error)
  }

  const validation = validateChannelList(parsedValue)

  if (!validation.ok) {
    return failureResult('INVALID_DATA', currentChannels, null, validation.details)
  }

  return {
    ok: true,
    source: 'storage',
    channels: validation.channels,
    error: null,
  }
}

/**
 * 다음 현재 목록 전체를 한 번에 저장한다.
 * 성공한 뒤에만 다음 목록을 반환하며, 실패하면 호출 시점의 정상 목록을 그대로 반환한다.
 */
export function saveCurrentChannels(nextChannels, { storage, currentChannels = [] } = {}) {
  const validation = validateChannelList(nextChannels)

  if (!validation.ok) {
    return failureResult('INVALID_DATA', currentChannels, null, validation.details)
  }

  let localStorage

  try {
    localStorage = getStorage(storage)
  } catch (error) {
    return failureResult('STORAGE_UNAVAILABLE', currentChannels, error)
  }

  const serializedChannels = JSON.stringify(validation.channels)

  try {
    localStorage.setItem(CHANNELS_STORAGE_KEY, serializedChannels)
  } catch (error) {
    return failureResult('WRITE_FAILED', currentChannels, error)
  }

  return {
    ok: true,
    source: 'storage',
    channels: validation.channels,
    error: null,
  }
}
