import { useRef, useState } from 'react'
import AppFooter from './components/AppFooter.jsx'
import AppHeader from './components/AppHeader.jsx'
import ChannelDetailModal from './components/ChannelDetailModal.jsx'
import ChannelSaveModal from './components/ChannelSaveModal.jsx'
import ChannelSection from './components/ChannelSection.jsx'
import { restoreCurrentChannels } from './data/channelStorage.js'
import { CATEGORIES, groupChannelsByCategory } from './data/channels.js'
import './App.css'

function App() {
  const [channelState] = useState(restoreCurrentChannels)
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [isChannelSaveOpen, setIsChannelSaveOpen] = useState(false)
  const detailTriggerRef = useRef(null)
  const channelSaveTriggerRef = useRef(null)
  const channelGroups = groupChannelsByCategory(channelState.channels)

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
    setIsChannelSaveOpen(false)

    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) returnTarget.focus()
    })
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
            />
          ))}
        </div>
      </main>

      <AppFooter />

      {selectedChannel && (
        <ChannelDetailModal
          channel={selectedChannel}
          onClose={handleDetailClose}
        />
      )}

      {isChannelSaveOpen && (
        <ChannelSaveModal onClose={handleChannelSaveClose} />
      )}
    </div>
  )
}

export default App
