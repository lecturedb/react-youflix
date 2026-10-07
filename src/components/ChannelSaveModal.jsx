import { useEffect, useRef, useState } from 'react'
import { restoreApiKey, saveApiKey } from '../data/apiKeyStorage.js'
import { normalizeChannelSearchResults } from '../data/channelSearch.js'
import { CATEGORIES } from '../data/channels.js'
import { searchChannels } from '../data/youtubeApi.js'
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

function SearchResultImage({ result }) {
  const [failedSource, setFailedSource] = useState(null)
  const showImage = result.imageUrl && failedSource !== result.imageUrl

  return showImage ? (
    <img
      src={result.imageUrl}
      alt=""
      onError={() => setFailedSource(result.imageUrl)}
    />
  ) : (
    <span className="channel-search-result__image-fallback" aria-hidden="true">
      {result.name.trim().charAt(0) || '?'}
    </span>
  )
}

function SearchResults({ state, selectedResultId, onRetry, onSelect, onFocusApiKey }) {
  if (state.status === 'idle') {
    return (
      <div className="channel-search-result channel-search-result--message">
        <div className="channel-search-result__placeholder" aria-hidden="true">?</div>
        <div>
          <strong>검색 결과가 여기에 표시됩니다.</strong>
          <p>채널명 또는 @핸들을 입력해 검색해 주세요.</p>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="channel-search-result channel-search-result--message" role="status">
        <span className="channel-search-result__spinner" aria-hidden="true" />
        <div>
          <strong>채널을 검색하는 중입니다.</strong>
          <p>검색 결과를 불러올 때까지 잠시 기다려 주세요.</p>
        </div>
      </div>
    )
  }

  if (state.status === 'invalid') {
    return (
      <div className="channel-search-result channel-search-result--message is-error" role="alert">
        <div className="channel-search-result__placeholder" aria-hidden="true">!</div>
        <div>
          <strong>채널명 또는 @핸들을 입력해 주세요.</strong>
          <p>검색 요청은 전송하지 않았습니다.</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    const needsApiKey = ['OPEN_API_KEY_SETTINGS', 'EDIT_API_KEY'].includes(state.error?.action)

    return (
      <div className="channel-search-result channel-search-result--message is-error" role="alert">
        <div className="channel-search-result__placeholder" aria-hidden="true">!</div>
        <div className="channel-search-result__message-content">
          <strong>{state.error?.message}</strong>
          <p>입력한 검색어를 유지했습니다. 문제를 해결한 뒤 다시 시도해 주세요.</p>
          <div className="channel-search-result__actions">
            {needsApiKey && (
              <button type="button" onClick={onFocusApiKey}>API 키 입력으로 이동</button>
            )}
            <button type="button" onClick={onRetry}>다시 시도</button>
          </div>
        </div>
      </div>
    )
  }

  if (state.results.length === 0) {
    return (
      <div className="channel-search-result channel-search-result--message" role="status">
        <div className="channel-search-result__placeholder" aria-hidden="true">0</div>
        <div>
          <strong>검색 결과가 없습니다.</strong>
          <p>검색어를 바꾸거나 @핸들을 확인한 뒤 다시 검색해 주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <ul className="channel-search-results" aria-label={`‘${state.submittedQuery}’ 채널 검색 결과`}>
      {state.results.map((result) => {
        const isSelected = result.id === selectedResultId

        return (
          <li key={result.id}>
            <button
              type="button"
              className={`channel-search-result-card${isSelected ? ' is-selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(result.id)}
            >
              <SearchResultImage result={result} />
              <span className="channel-search-result-card__content">
                <strong>{result.name}</strong>
                <span>채널 ID: {result.id}</span>
              </span>
              <span className="channel-search-result-card__selection" aria-hidden="true">
                {isSelected ? '선택됨' : '선택'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ChannelSaveModal({ onApiKeySaved, onSaveChannel, onClose }) {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyState, setApiKeyState] = useState(() => {
    const { ok, hasKey, error } = restoreApiKey()
    return { ok, hasKey, error }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchState, setSearchState] = useState({
    status: 'idle',
    results: [],
    error: null,
    submittedQuery: '',
  })
  const [selectedResultId, setSelectedResultId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [channelSaveError, setChannelSaveError] = useState(null)
  const apiKeyInputRef = useRef(null)
  const searchPendingRef = useRef(false)
  const searchRequestRef = useRef(0)
  const searchAbortControllerRef = useRef(null)
  const selectedResult = searchState.results.find(result => result.id === selectedResultId) ?? null

  useEffect(() => () => {
    searchAbortControllerRef.current?.abort()
  }, [])

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
      onApiKeySaved?.()
      return
    }

    setApiKeyState({
      ...result,
      hasKey: apiKeyState.hasKey,
    })
  }

  const runSearch = async (query, { forceRefresh = false } = {}) => {
    if (searchPendingRef.current) return

    const normalizedQuery = query.trim()
    setSelectedResultId(null)
    setChannelSaveError(null)

    if (!normalizedQuery) {
      setSearchState({
        status: 'invalid',
        results: [],
        error: null,
        submittedQuery: '',
      })
      return
    }

    const requestNumber = searchRequestRef.current + 1
    const controller = new AbortController()
    searchRequestRef.current = requestNumber
    searchPendingRef.current = true
    searchAbortControllerRef.current?.abort()
    searchAbortControllerRef.current = controller
    setSearchState({
      status: 'loading',
      results: [],
      error: null,
      submittedQuery: normalizedQuery,
    })

    try {
      const response = await searchChannels(normalizedQuery, {
        signal: controller.signal,
        forceRefresh,
      })
      if (searchRequestRef.current !== requestNumber) return

      const results = normalizeChannelSearchResults(response)
      setSearchState({
        status: 'success',
        results,
        error: null,
        submittedQuery: normalizedQuery,
      })
      setSelectedResultId(results.length === 1 ? results[0].id : null)
    } catch (error) {
      if (
        searchRequestRef.current !== requestNumber
        || error?.code === 'ABORTED'
      ) return

      setSearchState({
        status: 'error',
        results: [],
        error,
        submittedQuery: normalizedQuery,
      })
    } finally {
      if (searchRequestRef.current === requestNumber) {
        searchPendingRef.current = false
      }
    }
  }

  const handleSearch = (event) => {
    event.preventDefault()
    runSearch(searchQuery)
  }

  const handleSearchRetry = () => {
    runSearch(searchState.submittedQuery, { forceRefresh: true })
  }

  const handleFocusApiKey = () => {
    apiKeyInputRef.current?.focus()
  }

  const handleChannelSave = (event) => {
    event.preventDefault()

    if (!selectedResult) {
      setChannelSaveError({ message: '검색 결과에서 저장할 채널을 선택해 주세요.' })
      return
    }

    if (!selectedCategory) {
      setChannelSaveError({ message: '채널을 저장할 카테고리를 선택해 주세요.' })
      return
    }

    const result = onSaveChannel(selectedResult, selectedCategory)
    if (!result.ok) setChannelSaveError(result.error)
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
              ref={apiKeyInputRef}
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

          <form className="channel-save-row" onSubmit={handleSearch}>
            <label className="visually-hidden" htmlFor="channel-search-query">채널명 또는 핸들</label>
            <input
              id="channel-search-query"
              type="search"
              value={searchQuery}
              placeholder="채널명 또는 @핸들"
              disabled={searchState.status === 'loading'}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button type="submit" disabled={searchState.status === 'loading'}>
              {searchState.status === 'loading' ? '검색 중' : '채널 ID 찾기'}
            </button>
          </form>

          <div className="channel-search-results-wrap" aria-live="polite" aria-busy={searchState.status === 'loading'}>
            <SearchResults
              state={searchState}
              selectedResultId={selectedResultId}
              onRetry={handleSearchRetry}
              onSelect={(resultId) => {
                setSelectedResultId(resultId)
                setChannelSaveError(null)
              }}
              onFocusApiKey={handleFocusApiKey}
            />
          </div>
        </section>

        <section className="channel-save-section channel-save-section--submit" aria-labelledby="channel-category-section-title">
          <div className="channel-save-section__heading">
            <h3 id="channel-category-section-title">채널 저장</h3>
            <p>검색 결과와 카테고리를 선택해 채널 목록에 저장합니다.</p>
          </div>

          <form className="channel-save-row channel-save-row--submit" onSubmit={handleChannelSave}>
            <button type="submit">이 채널 저장하기</button>
            <label className="visually-hidden" htmlFor="channel-category">카테고리</label>
            <select
              id="channel-category"
              value={selectedCategory}
              onChange={(event) => {
                setSelectedCategory(event.target.value)
                setChannelSaveError(null)
              }}
            >
              <option value="" disabled>카테고리 선택</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </form>
          <p className="channel-save-target" role="status">
            {selectedResult
              ? `선택한 저장 대상: ${selectedResult.name} (${selectedResult.id})`
              : '검색 결과에서 저장할 채널을 선택해 주세요.'}
          </p>
          {channelSaveError && (
            <p className="channel-save-message is-error" role="alert">
              {channelSaveError.message}
            </p>
          )}
        </section>
      </div>

      <p className="visually-hidden" id={DESCRIPTION_ID}>
        YouTube API 키를 저장하고 채널을 검색한 뒤 카테고리를 선택하는 정보 저장 화면
      </p>
    </Modal>
  )
}

export default ChannelSaveModal
