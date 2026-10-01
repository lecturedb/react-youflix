import Modal from './Modal.jsx'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
    </svg>
  )
}

function ChannelDetailModal({ channel, onClose }) {
  const titleId = `channel-detail-${channel.id}-title`
  const descriptionId = `channel-detail-${channel.id}-description`

  return (
    <Modal
      className="channel-detail-modal"
      labelId={titleId}
      descriptionId={descriptionId}
      onClose={onClose}
    >
      <header className="channel-detail-modal__header">
        <div>
          <p className="channel-detail-modal__eyebrow">채널 상세</p>
          <h2 id={titleId}>{channel.name}</h2>
        </div>
        <button
          type="button"
          className="modal__close-button"
          aria-label={`${channel.name} 채널 상세 닫기`}
          autoFocus
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="channel-detail-modal__body">
        <p id={descriptionId}>
          채널 정보와 최신 동영상은 다음 구현 단계에서 이 영역에 표시됩니다.
        </p>
      </div>
    </Modal>
  )
}

export default ChannelDetailModal
