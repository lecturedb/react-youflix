import { createChannelExportData } from './channelExport.js'
import { validateChannelList } from './channelStorage.js'

const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3/files'

function driveError(code, message, cause, details) {
  const error = new Error(message)
  error.code = code
  if (cause) error.cause = cause
  if (details) error.details = details
  return error
}

function normalizeLegacyChannel(channel) {
  if (!channel || typeof channel !== 'object' || Array.isArray(channel)) return channel
  if (Object.hasOwn(channel, 'id')) return channel

  return {
    id: channel.chI,
    name: channel.chN,
    category: channel.cate,
    ...(channel.imgUrl ? { imageUrl: channel.imgUrl } : {}),
  }
}

/** 현재 백업 형식, 정규화 배열, 기존 Youflix 배열을 모두 읽는다. */
export function parseDriveChannelData(value) {
  const rawChannels = Array.isArray(value) ? value : value?.channels
  const validation = validateChannelList(
    Array.isArray(rawChannels) ? rawChannels.map(normalizeLegacyChannel) : rawChannels,
  )

  if (!validation.ok) {
    throw driveError(
      'DRIVE_INVALID_DATA',
      'Google Drive 채널 파일의 형식이 올바르지 않습니다.',
      null,
      validation.details,
    )
  }

  return validation.channels
}

async function readErrorResponse(response) {
  try {
    const data = await response.json()
    return data?.error?.message || data?.error_description || ''
  } catch {
    return ''
  }
}

function responseErrorMessage(status) {
  if (status === 401) return 'Google Drive 인증이 만료되었습니다. 다시 동기화해 주세요.'
  if (status === 403) return 'Google Drive 파일에 접근할 권한이 없습니다.'
  if (status === 404) return '설정한 Google Drive 채널 파일을 찾을 수 없습니다.'
  return 'Google Drive 채널 파일을 처리하지 못했습니다.'
}

export async function downloadDriveChannels({ accessToken, fileId, fetchImpl = fetch }) {
  let response

  try {
    response = await fetchImpl(
      `${DRIVE_API_BASE_URL}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      },
    )
  } catch (cause) {
    throw driveError(
      'DRIVE_NETWORK_ERROR',
      'Google Drive에 연결하지 못했습니다. 기존 채널 목록을 유지합니다.',
      cause,
    )
  }

  if (!response.ok) {
    const details = await readErrorResponse(response)
    throw driveError(
      response.status === 401 ? 'DRIVE_AUTH_EXPIRED' : 'DRIVE_READ_FAILED',
      responseErrorMessage(response.status),
      null,
      details,
    )
  }

  let data
  try {
    data = await response.json()
  } catch (cause) {
    throw driveError(
      'DRIVE_PARSE_FAILED',
      'Google Drive 채널 파일의 JSON 형식이 올바르지 않습니다.',
      cause,
    )
  }

  return parseDriveChannelData(data)
}

export async function uploadDriveChannels(channels, {
  accessToken,
  fileId,
  fetchImpl = fetch,
} = {}) {
  const validation = validateChannelList(channels)
  if (!validation.ok) {
    throw driveError(
      'DRIVE_INVALID_DATA',
      'Google Drive에 저장할 채널 목록이 올바르지 않습니다.',
      null,
      validation.details,
    )
  }

  let response
  try {
    response = await fetchImpl(
      `${DRIVE_UPLOAD_BASE_URL}/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: `${JSON.stringify(createChannelExportData(validation.channels), null, 2)}\n`,
      },
    )
  } catch (cause) {
    throw driveError(
      'DRIVE_NETWORK_ERROR',
      'Google Drive에 연결하지 못해 변경 사항을 저장하지 않았습니다.',
      cause,
    )
  }

  if (!response.ok) {
    const details = await readErrorResponse(response)
    throw driveError(
      response.status === 401 ? 'DRIVE_AUTH_EXPIRED' : 'DRIVE_WRITE_FAILED',
      responseErrorMessage(response.status),
      null,
      details,
    )
  }

  return validation.channels
}

