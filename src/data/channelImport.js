import { CHANNEL_EXPORT_FORMAT_VERSION } from './channelExport.js'
import { CATEGORIES } from './channels.js'

const ERROR_MESSAGES = Object.freeze({
  READ_FAILED: '선택한 파일을 읽지 못했습니다.',
  PARSE_FAILED: 'JSON 파일 형식이 올바르지 않습니다.',
  INVALID_STRUCTURE: 'YouFlix 채널 데이터 파일 구조가 올바르지 않습니다.',
  UNSUPPORTED_VERSION: '지원하지 않는 채널 데이터 형식 버전입니다.',
  INVALID_CHANNEL: '파일에 올바르지 않은 채널 정보가 있습니다.',
})

function failure(code, details, cause) {
  return {
    ok: false,
    error: {
      code,
      message: ERROR_MESSAGES[code],
      ...(details ? { details } : {}),
      ...(cause ? { cause } : {}),
    },
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validateImportChannel(channel, index) {
  const position = `${index + 1}번째 채널`

  if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
    return failure('INVALID_CHANNEL', `${position}이 객체가 아닙니다.`)
  }

  if (typeof channel.id !== 'string' || channel.id.trim() === '') {
    return failure('INVALID_CHANNEL', `${position}의 ID가 올바르지 않습니다.`)
  }

  if (typeof channel.name !== 'string' || channel.name.trim() === '') {
    return failure('INVALID_CHANNEL', `${position}의 이름이 올바르지 않습니다.`)
  }

  if (!CATEGORIES.includes(channel.category)) {
    return failure('INVALID_CHANNEL', `${position}의 카테고리가 올바르지 않습니다.`)
  }

  if (
    Object.hasOwn(channel, 'imageUrl')
    && (
      typeof channel.imageUrl !== 'string'
      || (channel.imageUrl.trim() !== '' && !isHttpUrl(channel.imageUrl.trim()))
    )
  ) {
    return failure('INVALID_CHANNEL', `${position}의 이미지 URL이 올바르지 않습니다.`)
  }

  const imageUrl = channel.imageUrl?.trim()

  return {
    ok: true,
    channel: {
      id: channel.id.trim(),
      name: channel.name.trim(),
      category: channel.category,
      ...(imageUrl ? { imageUrl } : {}),
    },
  }
}

/** 내보내기 파일 전체를 검증한 뒤 파일 내부의 첫 ID만 입력 순서대로 반환한다. */
export function parseChannelImport(contents) {
  let parsed

  try {
    parsed = JSON.parse(contents)
  } catch (cause) {
    return failure('PARSE_FAILED', null, cause)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return failure('INVALID_STRUCTURE', '최상위 값이 객체가 아닙니다.')
  }

  if (parsed.formatVersion !== CHANNEL_EXPORT_FORMAT_VERSION) {
    return failure(
      'UNSUPPORTED_VERSION',
      `지원 버전은 ${CHANNEL_EXPORT_FORMAT_VERSION}입니다.`,
    )
  }

  if (!Array.isArray(parsed.channels)) {
    return failure('INVALID_STRUCTURE', 'channels 값이 배열이 아닙니다.')
  }

  const validatedChannels = []

  for (const [index, channel] of parsed.channels.entries()) {
    const validation = validateImportChannel(channel, index)
    if (!validation.ok) return validation
    validatedChannels.push(validation.channel)
  }

  const seenIds = new Set()
  let duplicateCount = 0
  const channels = validatedChannels.filter((channel) => {
    if (seenIds.has(channel.id)) {
      duplicateCount += 1
      return false
    }
    seenIds.add(channel.id)
    return true
  })

  return { ok: true, channels, duplicateCount }
}

/** 현재 목록을 우선하며 신규 ID만 파일 순서대로 목록 끝에 병합한다. */
export function mergeChannelImport(currentChannels, importedChannels, duplicateCount = 0) {
  const seenIds = new Set(currentChannels.map(channel => channel.id))
  const additions = []
  let skippedCount = duplicateCount

  for (const channel of importedChannels) {
    if (seenIds.has(channel.id)) {
      skippedCount += 1
      continue
    }
    seenIds.add(channel.id)
    additions.push(channel)
  }

  return {
    channels: [...currentChannels, ...additions],
    additions,
    addedCount: additions.length,
    skippedCount,
  }
}

export async function readChannelImportFile(file) {
  try {
    return parseChannelImport(await file.text())
  } catch (cause) {
    return failure('READ_FAILED', null, cause)
  }
}
