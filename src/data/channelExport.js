export const CHANNEL_EXPORT_FORMAT_VERSION = 1

const EXPORT_ERROR_MESSAGE = '채널 데이터를 내보내지 못했습니다. 다시 시도해 주세요.'

function copyExportChannel({ id, name, category, imageUrl }) {
  return {
    id,
    name,
    category,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

/** 현재 목록의 첫 ID 순서만 유지하고 내보내기에 필요한 필드만 복사한다. */
export function createChannelExportData(channels = []) {
  const seenIds = new Set()
  const exportChannels = []

  for (const channel of channels) {
    if (seenIds.has(channel.id)) continue
    seenIds.add(channel.id)
    exportChannels.push(copyExportChannel(channel))
  }

  return {
    formatVersion: CHANNEL_EXPORT_FORMAT_VERSION,
    channels: exportChannels,
  }
}

export function serializeChannelExport(channels = []) {
  return `${JSON.stringify(createChannelExportData(channels), null, 2)}\n`
}

function createExportFilename(now) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `youflix-channels-${year}-${month}-${day}.json`
}

/** 브라우저 저장값을 변경하지 않고 현재 메모리의 채널 목록을 JSON 파일로 내려받는다. */
export function downloadChannelExport(channels, {
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  BlobCtor = globalThis.Blob,
  now = new Date(),
} = {}) {
  let objectUrl
  let anchor

  try {
    const contents = serializeChannelExport(channels)
    const blob = new BlobCtor([contents], { type: 'application/json;charset=utf-8' })
    objectUrl = urlApi.createObjectURL(blob)
    anchor = documentRef.createElement('a')
    anchor.href = objectUrl
    anchor.download = createExportFilename(now)
    documentRef.body.appendChild(anchor)
    anchor.click()

    return {
      ok: true,
      channelCount: createChannelExportData(channels).channels.length,
      filename: anchor.download,
    }
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'EXPORT_FAILED',
        message: EXPORT_ERROR_MESSAGE,
        cause,
      },
    }
  } finally {
    try {
      anchor?.remove()
    } catch {
      // 다운로드 결과와 무관한 임시 요소 정리 실패는 사용자 동작을 중단하지 않는다.
    }

    try {
      if (objectUrl) urlApi.revokeObjectURL(objectUrl)
    } catch {
      // 브라우저가 이미 URL을 해제한 경우에도 다운로드 결과는 유지한다.
    }
  }
}
