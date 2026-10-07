import { useState } from 'react'
import { downloadChannelExport } from '../data/channelExport.js'

function AppFooter({ channels }) {
  const [exportState, setExportState] = useState({ status: 'idle', message: '' })

  const handleExport = () => {
    const result = downloadChannelExport(channels)

    if (result.ok) {
      setExportState({
        status: 'success',
        message: `채널 ${result.channelCount}개의 데이터를 내보냈습니다.`,
      })
      return
    }

    setExportState({ status: 'error', message: result.error.message })
  }

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p>© {new Date().getFullYear()} YouFlix</p>
        <div className="app-footer__actions" aria-label="채널 데이터 관리">
          <button type="button">데이터 가져오기</button>
          <button type="button" onClick={handleExport}>
            {exportState.status === 'error' ? '다시 내보내기' : '데이터 내보내기'}
          </button>
          {exportState.status !== 'idle' && (
            <span
              className={`app-footer__export-message is-${exportState.status}`}
              role={exportState.status === 'error' ? 'alert' : 'status'}
            >
              {exportState.message}
            </span>
          )}
        </div>
      </div>
    </footer>
  )
}

export default AppFooter
