function getThumbnailUrl(thumbnails) {
  return thumbnails?.maxres?.url
    ?? thumbnails?.high?.url
    ?? thumbnails?.medium?.url
    ?? thumbnails?.default?.url
}

/** search.list와 channels.list 응답을 저장 대상 선택에 공통으로 사용할 형태로 바꾼다. */
export function normalizeChannelSearchResults(response) {
  const seenIds = new Set()

  return (response?.items ?? []).flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id : item.id?.channelId
    const name = item.snippet?.title?.trim()

    if (!id || !name || seenIds.has(id)) return []
    seenIds.add(id)

    const imageUrl = getThumbnailUrl(item.snippet?.thumbnails)

    return [{
      id,
      name,
      ...(imageUrl ? { imageUrl } : {}),
    }]
  })
}
