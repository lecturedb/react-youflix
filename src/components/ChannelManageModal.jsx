import { useState } from 'react'
import { CATEGORIES } from '../data/channels.js'
import Modal from './Modal.jsx'

const TITLE_ID = 'channel-manage-modal-title'
const DESCRIPTION_ID = 'channel-manage-modal-description'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
    </svg>
  )
}

function validateImageUrl(value) {
  if (!value) return true

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function ChannelManageModal({ mode, channel, onSave, onDelete, onClose }) {
  const isEditing = mode === 'edit'
  const [name, setName] = useState(channel.name)
  const [category, setCategory] = useState(channel.category)
  const [imageUrl, setImageUrl] = useState(channel.imageUrl ?? '')
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    const normalizedName = name.trim()
    const normalizedImageUrl = imageUrl.trim()

    if (!normalizedName) {
      setError({ message: '채널 이름을 입력해 주세요.' })
      return
    }

    if (!CATEGORIES.includes(category)) {
      setError({ message: '올바른 카테고리를 선택해 주세요.' })
      return
    }

    if (!validateImageUrl(normalizedImageUrl)) {
      setError({ message: '이미지 URL은 http 또는 https 주소로 입력해 주세요.' })
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const result = await onSave({
        id: channel.id,
        name: normalizedName,
        category,
        ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
      })

      if (!result.ok) setError(result.error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const result = await onDelete()
      if (!result.ok) setError(result.error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      className="channel-manage-modal"
      labelId={TITLE_ID}
      descriptionId={DESCRIPTION_ID}
      onClose={onClose}
    >
      <header className="channel-save-modal__header">
        <div>
          <p className="channel-save-modal__eyebrow">채널 관리</p>
          <h2 id={TITLE_ID}>{isEditing ? '채널 수정' : '채널 삭제'}</h2>
        </div>
        <button
          type="button"
          className="modal__close-button"
          aria-label={`${isEditing ? '채널 수정' : '채널 삭제'} 닫기`}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      {isEditing ? (
        <form className="channel-manage-form" onSubmit={handleEditSubmit}>
          <label htmlFor="channel-edit-id">채널 ID</label>
          <input id="channel-edit-id" value={channel.id} readOnly />

          <label htmlFor="channel-edit-name">채널 이름</label>
          <input
            id="channel-edit-name"
            value={name}
            autoFocus
            required
            onChange={(event) => setName(event.target.value)}
          />

          <label htmlFor="channel-edit-category">카테고리</label>
          <select
            id="channel-edit-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map(item => <option key={item}>{item}</option>)}
          </select>

          <label htmlFor="channel-edit-image">이미지 URL (선택)</label>
          <input
            id="channel-edit-image"
            type="url"
            value={imageUrl}
            placeholder="https://example.com/channel-image.jpg"
            onChange={(event) => setImageUrl(event.target.value)}
          />

          {error && <p className="channel-save-message is-error" role="alert">{error.message}</p>}

          <div className="channel-manage-actions">
            <button type="button" className="secondary-button" disabled={isSaving} onClick={onClose}>취소</button>
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? 'Drive에 저장 중' : '변경 저장'}
            </button>
          </div>
        </form>
      ) : (
        <div className="channel-delete-confirmation">
          <p><strong>{channel.name}</strong> 채널을 삭제할까요?</p>
          <p>삭제 후에도 같은 채널을 검색해 다시 추가할 수 있습니다.</p>
          {error && <p className="channel-save-message is-error" role="alert">{error.message}</p>}
          <div className="channel-manage-actions">
            <button type="button" className="secondary-button" disabled={isSaving} autoFocus onClick={onClose}>취소</button>
            <button type="button" className="danger-button" disabled={isSaving} onClick={handleDelete}>
              {isSaving ? 'Drive에서 삭제 중' : '삭제'}
            </button>
          </div>
        </div>
      )}

      <p className="visually-hidden" id={DESCRIPTION_ID}>
        {isEditing
          ? '저장된 채널의 이름, 카테고리와 이미지 URL을 수정합니다.'
          : '선택한 채널의 삭제 여부를 확인합니다.'}
      </p>
    </Modal>
  )
}

export default ChannelManageModal
