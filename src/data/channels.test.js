import assert from 'node:assert/strict'
import test from 'node:test'
import sourceChannels from '../../reference/youflix-data.json' with { type: 'json' }
import { CATEGORIES, initialChannels, initialChannelGroups, mergeChannels, groupChannelsByCategory } from './channels.js'

test('초기 데이터의 필드와 카테고리별 순서를 유지한다', () => {
  assert.equal(initialChannels.length, 42)
  assert.deepEqual(CATEGORIES, ['음악', '영화', '코딩', '뉴스', '엔터'])
  assert.deepEqual(initialChannelGroups.map(group => group.channels.length), [16, 9, 6, 5, 6])
  sourceChannels.forEach((channel, index) => {
    assert.deepEqual(initialChannels[index], {
      id: channel.chI, name: channel.chN, category: channel.cate, imageUrl: channel.imgUrl,
    })
    assert.match(channel.chI, /^UC[\w-]{22}$/)
  })
  for (const group of initialChannelGroups) {
    assert.deepEqual(group.channels.map(channel => channel.id),
      sourceChannels.filter(channel => channel.cate === group.category).map(channel => channel.chI))
  }
})

test('현재 목록의 ID를 우선하고 같은 이름의 다른 ID와 신규 항목 순서를 유지한다', () => {
  const current = [
    { ...initialChannels[0], name: '수정된 이름', category: '음악' },
    { id: 'new-1', name: '동일 이름', category: '음악' },
  ]
  const additions = [
    initialChannels[0],
    { id: 'new-2', name: '동일 이름', category: '코딩' },
    { ...current[1], category: '엔터' },
    { id: 'new-3', name: '마지막', category: '음악' },
    { id: 'new-2', name: '중복', category: '뉴스' },
  ]
  const before = JSON.stringify([current, additions])
  const merged = mergeChannels(current, additions)
  assert.deepEqual(merged, [...current, additions[1], additions[3]])
  assert.deepEqual(groupChannelsByCategory(merged)[0].channels, [...current, additions[3]])
  assert.equal(JSON.stringify([current, additions]), before)
  assert.deepEqual(mergeChannels([...current, { ...current[0], name: '뒤의 중복' }]), current)
})

test('수정·삭제한 현재 목록과 빈 목록에 초기 데이터를 다시 주입하지 않는다', () => {
  const edited = { ...initialChannels[1], name: '사용자 지정', category: '엔터', imageUrl: 'https://example.com/image.png' }
  const current = [edited, ...initialChannels.slice(2)]
  const result = mergeChannels(current)
  assert.deepEqual(result, current)
  assert.ok(!result.some(channel => channel.id === initialChannels[0].id))
  assert.deepEqual(mergeChannels([]), [])
  assert.deepEqual(mergeChannels(), [])
  assert.deepEqual(groupChannelsByCategory(mergeChannels([])).map(group => group.channels), [[], [], [], [], []])
  // 삭제 ID를 명시적으로 다시 추가하는 경우에만 목록 끝에 등록한다.
  assert.deepEqual(mergeChannels(current, [initialChannels[0]]), [...current, initialChannels[0]])
})
