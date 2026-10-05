import { useState } from 'react'
import { restoreApiKey, saveApiKey } from '../data/apiKeyStorage.js'
import { CATEGORIES } from '../data/channels.js'
import Modal from './Modal.jsx'

const TITLE_ID = 'channel-save-modal-title'
const DESCRIPTION_ID = 'channel-save-modal-description'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
    </svg>
  )
}

function ChannelSaveModal({ onClose }) {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyState, setApiKeyState] = useState(() => {
    const { ok, hasKey, error } = restoreApiKey()
    return { ok, hasKey, error }
  })

  const handleApiKeySave = (event) => {
    event.preventDefault()
    const result = saveApiKey(apiKey)

    if (result.ok) {
      setApiKey('')
      setApiKeyState({
        ok: true,
        hasKey: true,
        error: null,
        message: 'API 키를 브라우저에 저장했습니다. API 인증 여부는 아직 확인하지 않았습니다.',
      })
      return
    }

    setApiKeyState({
      ...result,
      hasKey: apiKeyState.hasKey,
    })
  }

  return (
    <Modal
      className="channel-save-modal"
      labelId={TITLE_ID}
      descriptionId={DESCRIPTION_ID}
      onClose={onClose}
    >
      <header className="channel-save-modal__header">
        <div>
          <p className="channel-save-modal__eyebrow">정보 저장</p>
          <h2 id={TITLE_ID}>채널 추가</h2>
        </div>
        <button
          type="button"
          className="modal__close-button"
          aria-label="채널 추가 닫기"
          autoFocus
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="channel-save-modal__content">
        <section className="channel-save-section" aria-labelledby="api-key-section-title">
          <div className="channel-save-section__heading">
            <h3 id="api-key-section-title">YouTube API 키</h3>
            <p>검색과 최신 정보 조회에 사용할 키를 이 브라우저에만 저장합니다.</p>
          </div>

          <form className="channel-save-row" onSubmit={handleApiKeySave}>
            <label className="visually-hidden" htmlFor="youtube-api-key">YouTube API 키</label>
            <input
              id="youtube-api-key"
              type="password"
              value={apiKey}
              placeholder={apiKeyState.hasKey ? '새 API 키로 교체' : 'API 키 입력'}
              autoComplete="off"
              spellCheck="false"
              onChange={(event) => setApiKey(event.target.value)}
            />
            <button type="submit">저장</button>
          </form>

          <p className="channel-save-security-note">
            브라우저 저장은 비밀 보관소 수준의 보호를 제공하지 않습니다. 공용 기기에서는 저장하지 마세요.
          </p>

          {apiKeyState.error ? (
            <p className="channel-save-message is-error" role="alert">
              {apiKeyState.error.message}
            </p>
          ) : (
            <p className="channel-save-message is-success" role="status">
              {apiKeyState.message || (apiKeyState.hasKey
                ? '저장된 API 키가 있습니다. 새 키를 입력하면 교체할 수 있습니다.'
                : '저장된 API 키가 없습니다.')}
            </p>
          )}
        </section>

        <section className="channel-save-section" aria-labelledby="channel-search-section-title">
          <div className="channel-save-section__heading">
            <h3 id="channel-search-section-title">채널 찾기</h3>
            <p>채널명 또는 @핸들로 저장할 채널을 찾습니다.</p>
          </div>

          <div className="channel-save-row">
            <label className="visually-hidden" htmlFor="channel-search-query">채널명 또는 핸들</label>
            <input
              id="channel-search-query"
              type="search"
              placeholder="채널명 또는 @핸들"
            />
            <button type="button" disabled>채널 ID 찾기</button>
          </div>

          <div className="channel-search-result" aria-live="polite">
            <div className="channel-search-result__placeholder" aria-hidden="true">?</div>
            <div>
              <strong>검색 결과가 여기에 표시됩니다.</strong>
              <p>채널 검색은 API 요청 연결 후 사용할 수 있습니다.</p>
            </div>
          </div>
        </section>

        <section className="channel-save-section channel-save-section--submit" aria-labelledby="channel-category-section-title">
          <div className="channel-save-section__heading">
            <h3 id="channel-category-section-title">채널 저장</h3>
            <p>검색 결과와 카테고리를 선택해 채널 목록에 저장합니다.</p>
          </div>

          <div className="channel-save-row channel-save-row--submit">
            <button type="button" disabled>이 채널 저장하기</button>
            <label className="visually-hidden" htmlFor="channel-category">카테고리</label>
            <select id="channel-category" defaultValue="">
              <option value="" disabled>카테고리 선택</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <p className="visually-hidden" id={DESCRIPTION_ID}>
        YouTube API 키를 저장하고 채널을 검색한 뒤 카테고리를 선택하는 정보 저장 화면
      </p>
    </Modal>
  )
}

export default ChannelSaveModal
