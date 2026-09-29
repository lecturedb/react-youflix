import sourceChannels from '../../reference/youflix-data.json' with { type: 'json' }

export const CATEGORIES = Object.freeze(['음악', '영화', '코딩', '뉴스', '엔터'])

/**
 * 앱의 기본 채널 형식: { id, name, category, imageUrl? }.
 * 영상 목록과 최신 통계는 이 목록에 넣지 않고 이후 API 조회 결과로 관리한다.
 */
export const initialChannels = Object.freeze(
  sourceChannels.map(({ chI, chN, cate, imgUrl }) => Object.freeze({
    id: chI,
    name: chN,
    category: cate,
    ...(imgUrl ? { imageUrl: imgUrl } : {}),
  })),
)

/** 초기 채널 우선. 사용자 목록 내부 중복도 먼저 등장한 ID를 유지한다. */
export function mergeChannels(userChannels = []) {
  const seenIds = new Set()

  return [...initialChannels, ...userChannels].filter(({ id }) => {
    if (seenIds.has(id)) return false
    seenIds.add(id)
    return true
  })
}

/** 유효한 앱 채널 목록을 분류하며 카테고리 안에서는 입력 순서를 유지한다. */
export function groupChannelsByCategory(channels) {
  return CATEGORIES.map((category) => ({
    category,
    channels: channels.filter((channel) => channel.category === category),
  }))
}

export const initialChannelGroups = groupChannelsByCategory(mergeChannels())
