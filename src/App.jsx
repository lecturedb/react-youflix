import { useEffect, useRef, useState } from 'react'
import AppFooter from './components/AppFooter.jsx'
import AppHeader from './components/AppHeader.jsx'
import ChannelDetailModal from './components/ChannelDetailModal.jsx'
import ChannelSaveModal from './components/ChannelSaveModal.jsx'
import ChannelManageModal from './components/ChannelManageModal.jsx'
import ChannelSection from './components/ChannelSection.jsx'
import { restoreCurrentChannels, saveCurrentChannels } from './data/channelStorage.js'
import { CATEGORIES, groupChannelsByCategory } from './data/channels.js'
import './App.css'

function App() {
  const [channelState, setChannelState] = useState(restoreCurrentChannels)
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [isChannelSaveOpen, setIsChannelSaveOpen] = useState(false)
  const [channelManagement, setChannelManagement] = useState(null)
  const [focusRequest, setFocusRequest] = useState(null)
  const [apiKeyRevision, setApiKeyRevision] = useState(0)
  const detailTriggerRef = useRef(null)
  const channelSaveTriggerRef = useRef(null)
  const channelGroups = groupChannelsByCategory(channelState.channels)

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

  const persistChannels = (nextChannels) => {
    const result = saveCurrentChannels(nextChannels, {
      currentChannels: channelState.channels,
    })

    if (result.ok) {
      setChannelState(result)
    }

    return result
  }

  const handleChannelAdd = (selectedResult, category) => {
    const duplicate = channelState.channels.find(channel => channel.id === selectedResult.id)

    if (duplicate) {
      return {
        ok: false,
        error: {
          code: 'DUPLICATE_CHANNEL',
          message: `이미 ${duplicate.category} 카테고리에 등록된 채널입니다.`,
        },
      }
    }

    const addedChannel = {
      id: selectedResult.id,
      name: selectedResult.name,
      category,
      ...(selectedResult.imageUrl ? { imageUrl: selectedResult.imageUrl } : {}),
    }
    const result = persistChannels([...channelState.channels, addedChannel])

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

  const handleChannelUpdate = (updatedChannel) => {
    const original = channelManagement.channel
    const sameCategory = original.category === updatedChannel.category
    const nextChannels = sameCategory
      ? channelState.channels.map(channel => (
          channel.id === original.id ? updatedChannel : channel
        ))
      : [
          ...channelState.channels.filter(channel => channel.id !== original.id),
          updatedChannel,
        ]
    const result = persistChannels(nextChannels)

    if (result.ok) {
      setChannelManagement(null)
      setActiveCategory(updatedChannel.category)
      setFocusRequest({ channelId: updatedChannel.id })
    }

    return result
  }

  const handleChannelDelete = () => {
    const target = channelManagement.channel
    const categoryChannels = channelGroups
      .find(group => group.category === target.category)?.channels ?? []
    const targetIndex = categoryChannels.findIndex(channel => channel.id === target.id)
    const remainingCategoryChannels = categoryChannels.filter(channel => channel.id !== target.id)
    const nextFocusChannel = remainingCategoryChannels[
      Math.min(targetIndex, remainingCategoryChannels.length - 1)
    ]
    const result = persistChannels(
      channelState.channels.filter(channel => channel.id !== target.id),
    )

    if (result.ok) {
      setChannelManagement(null)
      setFocusRequest(nextFocusChannel
        ? { channelId: nextFocusChannel.id }
        : { category: target.category })
    }

    return result
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

      <AppFooter />

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
