import sourceChannels from '../../reference/youflix-data.json' with { type: 'json' }

export const CATEGORIES = Object.freeze(['음악', '영화', '코딩', '뉴스', '엔터'])

/**
 * 앱의 기본 채널 형식: { id, name, category, imageUrl? }.
 * 영상 목록과 최신 통계는 이 목록에 넣지 않고 이후 API 조회 결과로 관리한다.
 * 저장 목록이 없을 때 사용할 시작 데이터다. 현재 목록에 자동으로 합치지 않는다.
 */
export const initialChannels = Object.freeze(
  sourceChannels.map(({ chI, chN, cate, imgUrl }) => Object.freeze({
    id: chI,
    name: chN,
    category: cate,
    ...(imgUrl ? { imageUrl: imgUrl } : {}),
  })),
)

/** 출처 구분 없이 현재 목록을 우선하고, 새로운 ID만 입력 순서대로 끝에 추가한다. */
export function mergeChannels(currentChannels = [], additionalChannels = []) {
  const seenIds = new Set()

  return [...currentChannels, ...additionalChannels].filter(({ id }) => {
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

export const initialChannelGroups = groupChannelsByCategory(mergeChannels(initialChannels))
