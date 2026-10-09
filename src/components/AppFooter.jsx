import { useRef, useState } from 'react'
import { downloadChannelExport } from '../data/channelExport.js'
import { readChannelImportFile } from '../data/channelImport.js'

function AppFooter({ channels, onImportChannels }) {
  const [dataState, setDataState] = useState({ status: 'idle', message: '', action: null })
  const fileInputRef = useRef(null)

  const handleExport = () => {
    const result = downloadChannelExport(channels)

    if (result.ok) {
      setDataState({
        status: 'success',
        message: `채널 ${result.channelCount}개의 데이터를 내보냈습니다.`,
        action: 'export',
      })
      return
    }

    setDataState({ status: 'error', message: result.error.message, action: 'export' })
  }

  const handleImportSelect = async (event) => {
    const input = event.currentTarget
    const [file] = input.files
    if (!file) return

    setDataState({ status: 'loading', message: '채널 데이터 파일을 확인하는 중입니다.', action: 'import' })
    const parsed = await readChannelImportFile(file)
    input.value = ''

    if (!parsed.ok) {
      setDataState({
        status: 'error',
        message: `${parsed.error.message}${parsed.error.details ? ` ${parsed.error.details}` : ''} 파일을 다시 선택해 주세요.`,
        action: 'import',
      })
      return
    }

    const result = await onImportChannels(parsed.channels, parsed.duplicateCount)

    if (!result.ok) {
      setDataState({
        status: 'error',
        message: `${result.error.message} 파일을 다시 선택해 시도해 주세요.`,
        action: 'import',
      })
      return
    }

    const duplicateMessage = result.skippedCount > 0
      ? ` 중복 ${result.skippedCount}개를 건너뛰었습니다.`
      : ''
    const message = result.addedCount > 0
      ? `채널 ${result.addedCount}개를 추가했습니다.${duplicateMessage}`
      : result.skippedCount > 0
        ? `추가할 채널이 없습니다. 중복 ${result.skippedCount}개를 건너뛰었습니다.`
        : '파일에 추가할 채널이 없습니다. 기존 목록을 유지했습니다.'

    setDataState({ status: 'success', message, action: 'import' })
  }

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p>© {new Date().getFullYear()} YouFlix</p>
        <div className="app-footer__actions" aria-label="채널 데이터 관리">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImportSelect}
          />
          <button
            type="button"
            disabled={dataState.status === 'loading'}
            onClick={() => fileInputRef.current?.click()}
          >
            {dataState.status === 'loading'
              ? '파일 확인 중'
              : dataState.status === 'error' && dataState.action === 'import'
                ? '다시 가져오기'
                : '데이터 가져오기'}
          </button>
          <button type="button" onClick={handleExport}>
            {dataState.status === 'error' && dataState.action === 'export'
              ? '다시 내보내기'
              : '데이터 내보내기'}
          </button>
          {dataState.status !== 'idle' && (
            <span
              className={`app-footer__data-message is-${dataState.status}`}
              role={dataState.status === 'error' ? 'alert' : 'status'}
            >
              {dataState.message}
            </span>
          )}
        </div>
      </div>
    </footer>
  )
}

export default AppFooter
