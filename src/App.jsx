import { useEffect, useRef, useState } from 'react'
import AppFooter from './components/AppFooter.jsx'
import AppHeader from './components/AppHeader.jsx'
import ChannelDetailModal from './components/ChannelDetailModal.jsx'
import ChannelSaveModal from './components/ChannelSaveModal.jsx'
import ChannelManageModal from './components/ChannelManageModal.jsx'
import ChannelSection from './components/ChannelSection.jsx'
import { downloadDriveChannels, uploadDriveChannels } from './data/channelDriveSync.js'
import { mergeChannelImport } from './data/channelImport.js'
import { restoreCurrentChannels, saveCurrentChannels } from './data/channelStorage.js'
import { CATEGORIES, groupChannelsByCategory } from './data/channels.js'
import {
  clearGoogleDriveAccessToken,
  getGoogleDriveAccessToken,
  getGoogleDriveConfig,
  isGoogleDriveConfigured,
} from './data/googleDriveAuth.js'
import './App.css'

const driveConfig = getGoogleDriveConfig()

function operationError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function syncFailureResult(error, channels) {
  return {
    ok: false,
    source: 'current',
    channels,
    error: {
      code: error?.code || 'DRIVE_SYNC_FAILED',
      message: error?.message || 'Google Drive 동기화에 실패했습니다.',
      ...(error?.details ? { details: error.details } : {}),
      ...(error ? { cause: error } : {}),
    },
  }
}

function App() {
  const [channelState, setChannelState] = useState(restoreCurrentChannels)
  const [syncState, setSyncState] = useState(() => (
    isGoogleDriveConfigured(driveConfig)
      ? { status: 'idle', message: '' }
      : {
          status: 'error',
          message: 'Google Drive 동기화 설정이 없습니다. 환경변수를 확인해 주세요.',
          configured: false,
        }
  ))
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [isChannelSaveOpen, setIsChannelSaveOpen] = useState(false)
  const [channelManagement, setChannelManagement] = useState(null)
  const [focusRequest, setFocusRequest] = useState(null)
  const [apiKeyRevision, setApiKeyRevision] = useState(0)
  const detailTriggerRef = useRef(null)
  const channelSaveTriggerRef = useRef(null)
  const startupSyncStartedRef = useRef(false)
  const syncPendingRef = useRef(false)
  const channelGroups = groupChannelsByCategory(channelState.channels)

  const replaceChannelsFromDrive = async ({ interactive }) => {
    if (syncPendingRef.current) {
      return syncFailureResult(
        operationError('SYNC_IN_PROGRESS', 'Google Drive 동기화가 진행 중입니다. 잠시 후 다시 시도해 주세요.'),
        channelState.channels,
      )
    }

    syncPendingRef.current = true
    setSyncState({ status: 'syncing', message: 'Google Drive에서 최신 채널 목록을 불러오는 중입니다.' })

    try {
      const accessToken = await getGoogleDriveAccessToken({ interactive, config: driveConfig })
      const channels = await downloadDriveChannels({
        accessToken,
        fileId: driveConfig.fileId,
      })
      const localResult = saveCurrentChannels(channels, {
        currentChannels: channelState.channels,
      })

      if (!localResult.ok) {
        setSyncState({ status: 'error', message: localResult.error.message })
        return localResult
      }

      setChannelState(localResult)
      setSyncState({ status: 'idle', message: '' })
      return localResult
    } catch (error) {
      if (error?.code === 'DRIVE_AUTH_EXPIRED') clearGoogleDriveAccessToken()
      const result = syncFailureResult(error, channelState.channels)
      setSyncState({ status: 'error', message: result.error.message })
      return result
    } finally {
      syncPendingRef.current = false
    }
  }

  useEffect(() => {
    if (startupSyncStartedRef.current || !isGoogleDriveConfigured(driveConfig)) return
    startupSyncStartedRef.current = true
    replaceChannelsFromDrive({ interactive: false })
  // 앱 시작 시 한 번만 실행하며 실패해도 현재 로컬 목록을 유지한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!focusRequest) return undefined

    const frameId = window.requestAnimationFrame(() => {
      let target

      if (focusRequest.channelId) {
        const card = Array.from(document.querySelectorAll('[data-channel-id]'))
          .find(element => element.dataset.channelId === focusRequest.channelId)
        target = card?.querySelector('.channel-card__view')
      } else if (focusRequest.category) {
        target = document.getElementById(`category-${focusRequest.category}`)
          ?.querySelector('.empty-category button')
      }

      if (target?.isConnected) {
        target.scrollIntoView({ block: 'center', inline: 'nearest' })
        target.focus()
      }
      setFocusRequest(null)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [channelState.channels, focusRequest])

  const handleCategorySelect = (category) => {
    setActiveCategory(category)
  }

  const handleChannelSelect = (channel, triggerElement) => {
    detailTriggerRef.current = triggerElement
    setSelectedChannel(channel)
  }

  const handleDetailClose = () => {
    const returnTarget = detailTriggerRef.current
    setSelectedChannel(null)

    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) returnTarget.focus()
    })
  }

  const handleChannelSaveOpen = (triggerElement) => {
    channelSaveTriggerRef.current = triggerElement
    setIsChannelSaveOpen(true)
  }

  const handleChannelSaveClose = () => {
    const returnTarget = channelSaveTriggerRef.current
    const detailFallbackTarget = document.querySelector(
      '.channel-detail-modal .modal__close-button',
    )
    setIsChannelSaveOpen(false)

    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) {
        returnTarget.focus()
      } else if (detailFallbackTarget?.isConnected) {
        detailFallbackTarget.focus()
      }
    })
  }

  const handleApiKeySaved = () => {
    setApiKeyRevision(currentRevision => currentRevision + 1)
  }

  const persistChannels = async (createNextChannels) => {
    if (syncPendingRef.current) {
      return syncFailureResult(
        operationError('SYNC_IN_PROGRESS', 'Google Drive 동기화가 진행 중입니다. 잠시 후 다시 시도해 주세요.'),
        channelState.channels,
      )
    }

    syncPendingRef.current = true
    setSyncState({ status: 'syncing', message: '채널 변경 사항을 Google Drive에 저장하는 중입니다.' })

    let remoteChannels
    let accessToken

    try {
      accessToken = await getGoogleDriveAccessToken({ interactive: true, config: driveConfig })
      remoteChannels = await downloadDriveChannels({
        accessToken,
        fileId: driveConfig.fileId,
      })
      const nextChannels = createNextChannels(remoteChannels)

      await uploadDriveChannels(nextChannels, {
        accessToken,
        fileId: driveConfig.fileId,
      })

      const localResult = saveCurrentChannels(nextChannels, {
        currentChannels: channelState.channels,
      })

      if (!localResult.ok) {
        try {
          await uploadDriveChannels(remoteChannels, {
            accessToken,
            fileId: driveConfig.fileId,
          })
        } catch {
          const rollbackError = operationError(
            'LOCAL_WRITE_FAILED_AFTER_DRIVE_WRITE',
            '브라우저 저장에 실패했고 Drive 변경도 되돌리지 못했습니다. 다시 동기화해 주세요.',
          )
          const result = syncFailureResult(rollbackError, channelState.channels)
          setSyncState({ status: 'error', message: result.error.message })
          return result
        }

        setSyncState({ status: 'error', message: localResult.error.message })
        return localResult
      }

      setChannelState(localResult)
      setSyncState({ status: 'idle', message: '' })
      return localResult
    } catch (error) {
      if (error?.code === 'DRIVE_AUTH_EXPIRED') clearGoogleDriveAccessToken()
      const result = syncFailureResult(error, channelState.channels)
      setSyncState({ status: 'error', message: result.error.message })
      return result
    } finally {
      syncPendingRef.current = false
    }
  }

  const handleChannelAdd = async (selectedResult, category) => {
    const addedChannel = {
      id: selectedResult.id,
      name: selectedResult.name,
      category,
      ...(selectedResult.imageUrl ? { imageUrl: selectedResult.imageUrl } : {}),
    }
    const result = await persistChannels((latestChannels) => {
      const duplicate = latestChannels.find(channel => channel.id === selectedResult.id)
      if (duplicate) {
        throw operationError(
          'DUPLICATE_CHANNEL',
          `이미 ${duplicate.category} 카테고리에 등록된 채널입니다.`,
        )
      }
      return [...latestChannels, addedChannel]
    })

    if (result.ok) {
      setActiveCategory(category)
      setIsChannelSaveOpen(false)
      setFocusRequest({ channelId: addedChannel.id })
    }

    return result
  }

  const handleChannelManageOpen = (mode, channel, triggerElement) => {
    setChannelManagement({ mode, channel, triggerElement })
  }

  const handleChannelManageClose = () => {
    const returnTarget = channelManagement?.triggerElement
      ?.closest('.channel-card')
      ?.querySelector('.channel-card__view')
    setChannelManagement(null)

    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) returnTarget.focus()
    })
  }

  const handleChannelUpdate = async (updatedChannel) => {
    const original = channelManagement.channel
    const result = await persistChannels((latestChannels) => {
      const latestChannel = latestChannels.find(channel => channel.id === original.id)
      if (!latestChannel) {
        throw operationError(
          'CHANNEL_REMOVED_REMOTELY',
          '이 채널은 다른 기기에서 이미 삭제되었습니다. 최신 목록을 유지합니다.',
        )
      }

      return latestChannel.category === updatedChannel.category
        ? latestChannels.map(channel => (
            channel.id === original.id ? updatedChannel : channel
          ))
        : [
            ...latestChannels.filter(channel => channel.id !== original.id),
            updatedChannel,
          ]
    })

    if (result.ok) {
      setChannelManagement(null)
      setActiveCategory(updatedChannel.category)
      setFocusRequest({ channelId: updatedChannel.id })
    }

    return result
  }

  const handleChannelDelete = async () => {
    const target = channelManagement.channel
    const categoryChannels = channelGroups
      .find(group => group.category === target.category)?.channels ?? []
    const targetIndex = categoryChannels.findIndex(channel => channel.id === target.id)
    const remainingCategoryChannels = categoryChannels.filter(channel => channel.id !== target.id)
    const nextFocusChannel = remainingCategoryChannels[
      Math.min(targetIndex, remainingCategoryChannels.length - 1)
    ]
    const result = await persistChannels(
      latestChannels => latestChannels.filter(channel => channel.id !== target.id),
    )

    if (result.ok) {
      setChannelManagement(null)
      setFocusRequest(nextFocusChannel
        ? { channelId: nextFocusChannel.id }
        : { category: target.category })
    }

    return result
  }

  const handleChannelImport = async (importedChannels, fileDuplicateCount) => {
    let merged
    const result = await persistChannels((latestChannels) => {
      merged = mergeChannelImport(
        latestChannels,
        importedChannels,
        fileDuplicateCount,
      )
      return merged.channels
    })
    return result.ok
      ? { ok: true, ...merged }
      : result
  }

  return (
    <div className="app-shell">
      <AppHeader
        categories={CATEGORIES}
        activeCategory={activeCategory}
        onCategorySelect={handleCategorySelect}
        onAddChannel={handleChannelSaveOpen}
      />

      <main className="main-content">
        {channelState.error && (
          <div className="storage-notice" role="alert">
            <strong>채널 목록을 복원하지 못했습니다.</strong>
            <span>{channelState.error.message}</span>
          </div>
        )}

        {syncState.status !== 'idle' && (
          <div
            className={`storage-notice drive-sync-notice is-${syncState.status}`}
            role={syncState.status === 'error' ? 'alert' : 'status'}
          >
            <strong>{syncState.status === 'syncing'
              ? 'Google Drive 동기화 중'
              : 'Google Drive 동기화 실패'}</strong>
            <span>{syncState.message}</span>
            {syncState.status === 'error' && syncState.configured !== false && (
              <button
                type="button"
                onClick={() => replaceChannelsFromDrive({ interactive: true })}
              >
                Drive 동기화 다시 시도
              </button>
            )}
          </div>
        )}

        <div className="channel-sections" aria-label="카테고리별 채널 목록">
          {channelGroups.map(({ category, channels }) => (
            <ChannelSection
              key={category}
              category={category}
              channels={channels}
              isVisible={activeCategory === 'ALL' || activeCategory === category}
              onChannelSelect={handleChannelSelect}
              onAddChannel={handleChannelSaveOpen}
              onEditChannel={(channel, triggerElement) => (
                handleChannelManageOpen('edit', channel, triggerElement)
              )}
              onDeleteChannel={(channel, triggerElement) => (
                handleChannelManageOpen('delete', channel, triggerElement)
              )}
            />
          ))}
        </div>
      </main>

      <AppFooter
        channels={channelState.channels}
        onImportChannels={handleChannelImport}
      />

      {selectedChannel && (
        <ChannelDetailModal
          channel={selectedChannel}
          apiKeyRevision={apiKeyRevision}
          onClose={handleDetailClose}
          onOpenApiSettings={handleChannelSaveOpen}
        />
      )}

      {isChannelSaveOpen && (
        <ChannelSaveModal
          onApiKeySaved={handleApiKeySaved}
          onSaveChannel={handleChannelAdd}
          onClose={handleChannelSaveClose}
        />
      )}

      {channelManagement && (
        <ChannelManageModal
          mode={channelManagement.mode}
          channel={channelManagement.channel}
          onSave={handleChannelUpdate}
          onDelete={handleChannelDelete}
          onClose={handleChannelManageClose}
        />
      )}
    </div>
  )
}

export default App
