const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
// 고정 ID의 기존 업로드 파일을 Picker 없이 읽고 써야 하므로 drive 범위가 기본이다.
// 이 OAuth 앱이 생성했거나 Picker로 연결한 파일이라면 환경변수로 drive.file을 사용할 수 있다.
const DEFAULT_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

let scriptPromise = null
let tokenClient = null
let tokenClientKey = null
let pendingTokenRequest = null
let accessToken = null
let accessTokenExpiresAt = 0

function authError(code, message, cause) {
  const error = new Error(message)
  error.code = code
  if (cause) error.cause = cause
  return error
}

export function getGoogleDriveConfig(env = import.meta.env) {
  return {
    clientId: env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '',
    fileId: env.VITE_GOOGLE_DRIVE_FILE_ID?.trim() ?? '',
    scope: env.VITE_GOOGLE_DRIVE_SCOPE?.trim() || DEFAULT_DRIVE_SCOPE,
  }
}

export function isGoogleDriveConfigured(config = getGoogleDriveConfig()) {
  return Boolean(config.clientId && config.fileId)
}

function loadGoogleIdentityScript(documentRef = globalThis.document) {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve(globalThis.google)
  if (!documentRef) {
    return Promise.reject(authError(
      'AUTH_UNAVAILABLE',
      'Google 인증을 사용할 수 없는 환경입니다.',
    ))
  }

  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existingScript = documentRef.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_URL}"]`)
    const script = existingScript ?? documentRef.createElement('script')

    const handleLoad = () => {
      if (globalThis.google?.accounts?.oauth2) {
        resolve(globalThis.google)
      } else {
        scriptPromise = null
        reject(authError('AUTH_LOAD_FAILED', 'Google 인증 모듈을 불러오지 못했습니다.'))
      }
    }
    const handleError = (cause) => {
      scriptPromise = null
      reject(authError(
        'AUTH_LOAD_FAILED',
        'Google 인증 모듈을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.',
        cause,
      ))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingScript) {
      script.src = GOOGLE_IDENTITY_SCRIPT_URL
      script.async = true
      script.defer = true
      documentRef.head.appendChild(script)
    }
  })

  return scriptPromise
}

function normalizeTokenError(response) {
  const code = response?.error || 'AUTH_FAILED'
  const silentFailure = [
    'interaction_required',
    'login_required',
    'consent_required',
    'popup_failed_to_open',
  ].includes(code)

  return authError(
    silentFailure ? 'AUTH_REQUIRED' : 'AUTH_FAILED',
    silentFailure
      ? 'Google Drive 동기화를 계속하려면 사용자 인증이 필요합니다.'
      : 'Google Drive 인증을 완료하지 못했습니다. 다시 시도해 주세요.',
    response,
  )
}

async function getTokenClient(config) {
  const googleApi = await loadGoogleIdentityScript()
  const nextKey = `${config.clientId}\n${config.scope}`

  if (tokenClient && tokenClientKey === nextKey) return tokenClient

  tokenClientKey = nextKey
  tokenClient = googleApi.accounts.oauth2.initTokenClient({
    client_id: config.clientId,
    scope: config.scope,
    callback(response) {
      const pending = pendingTokenRequest
      pendingTokenRequest = null
      if (!pending) return

      if (response?.error || !response?.access_token) {
        pending.reject(normalizeTokenError(response))
        return
      }

      accessToken = response.access_token
      const expiresInSeconds = Number(response.expires_in) || 3600
      accessTokenExpiresAt = Date.now() + Math.max(0, expiresInSeconds - 60) * 1000
      pending.resolve(accessToken)
    },
    error_callback(response) {
      const pending = pendingTokenRequest
      pendingTokenRequest = null
      pending?.reject(normalizeTokenError(response))
    },
  })

  return tokenClient
}

/**
 * 유효한 토큰은 메모리에서 재사용한다. 자동 동기화는 prompt 없이 기존 승인을
 * 재사용하고, 사용자 동작에서 재시도할 때만 계정 선택 팝업을 허용한다.
 */
export async function getGoogleDriveAccessToken({
  interactive = false,
  config = getGoogleDriveConfig(),
} = {}) {
  if (!isGoogleDriveConfigured(config)) {
    throw authError(
      'DRIVE_NOT_CONFIGURED',
      'Google Drive 동기화 설정이 없습니다. 환경변수를 확인해 주세요.',
    )
  }

  if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken
  if (pendingTokenRequest) return pendingTokenRequest.promise

  const client = await getTokenClient(config)
  let resolveRequest
  let rejectRequest
  const promise = new Promise((resolve, reject) => {
    resolveRequest = resolve
    rejectRequest = reject
  })
  pendingTokenRequest = {
    promise,
    resolve: resolveRequest,
    reject: rejectRequest,
  }

  try {
    client.requestAccessToken({ prompt: interactive ? 'select_account' : '' })
  } catch (cause) {
    pendingTokenRequest = null
    throw authError(
      interactive ? 'AUTH_FAILED' : 'AUTH_REQUIRED',
      interactive
        ? 'Google Drive 인증 창을 열지 못했습니다.'
        : 'Google Drive 동기화를 계속하려면 사용자 인증이 필요합니다.',
      cause,
    )
  }

  return promise
}

export function clearGoogleDriveAccessToken() {
  accessToken = null
  accessTokenExpiresAt = 0
}
