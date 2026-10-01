import { useCallback, useEffect, useRef } from 'react'

function Modal({ children, className = '', labelId, descriptionId, onClose }) {
  const dialogRef = useRef(null)
  const closeRequestedRef = useRef(false)

  const requestClose = useCallback(() => {
    if (closeRequestedRef.current) return
    closeRequestedRef.current = true
    onClose()
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [])

  const handleCancel = (event) => {
    event.preventDefault()
    requestClose()
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) requestClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`.trim()}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="modal__surface">{children}</div>
    </dialog>
  )
}

export default Modal
