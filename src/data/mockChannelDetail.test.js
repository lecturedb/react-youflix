import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMockChannelDetail,
  formatDuration,
  formatPublishedAt,
  formatStatistic,
  mockChannelDetail,
} from './mockChannelDetail.js'

test('Mock API 응답을 채널과 최신순 영상 목록으로 결합한다', () => {
  assert.equal(mockChannelDetail.channel.id, 'UC_x5XG1OV2P6uZZ5FSM9Ttw')
  assert.equal(mockChannelDetail.channel.name, 'Google for Developers')
  assert.equal(mockChannelDetail.videos.length, 6)
  assert.equal(mockChannelDetail.featuredVideo.id, 'VldX34mM95o')
  assert.equal(mockChannelDetail.featuredVideo.duration, 'PT48M11S')
  assert.deepEqual(mockChannelDetail.featuredVideo.statistics, {
    views: '959',
    likes: '38',
    comments: '3',
  })

  const timestamps = mockChannelDetail.videos.map(video => new Date(video.publishedAt).getTime())
  assert.deepEqual(timestamps, [...timestamps].sort((first, second) => second - first))
  assert.ok(mockChannelDetail.videos.some(video => video.title.length > 70))
})

test('날짜·재생시간·수치를 읽기 쉽게 표시하고 누락·비공개를 구분한다', () => {
  assert.match(formatPublishedAt('2025-10-15T19:03:02Z'), /2025년 10월 16일/)
  assert.equal(formatPublishedAt(), '정보 없음')
  assert.equal(formatPublishedAt('invalid'), '정보 없음')
  assert.equal(formatDuration('PT48M11S'), '48분 11초')
  assert.equal(formatDuration('PT1H2M3S'), '1시간 2분 3초')
  assert.equal(formatDuration('PT57S'), '57초')
  assert.equal(formatDuration(), '정보 없음')
  assert.equal(formatStatistic('405192304'), '405,192,304')
  assert.equal(formatStatistic(0), '0')
  assert.equal(formatStatistic(), '정보 없음')
  assert.equal(formatStatistic(undefined, { isPrivate: true }), '비공개')
})

test('설명이 없거나 통계 일부가 누락된 응답도 임의의 값으로 채우지 않는다', () => {
  const detail = buildMockChannelDetail({
    channelResponse: {
      items: [{
        id: 'channel-with-missing-data',
        snippet: { title: '설명 없는 채널' },
        statistics: { hiddenSubscriberCount: true },
      }],
    },
    uploads: {
      items: [{
        snippet: {
          title: '통계가 없는 긴 제목의 검증용 영상입니다. 화면 폭이 좁아져도 잘리지 않고 여러 줄로 표시되어야 합니다.',
          publishedAt: '2025-01-01T00:00:00Z',
          resourceId: { videoId: 'missing-statistics' },
        },
      }],
    },
    videoDetails: [{ items: [{ contentDetails: {} }] }],
  })

  assert.equal(Object.hasOwn(detail.channel, 'description'), false)
  assert.equal(detail.channel.statistics.subscribersHidden, true)
  assert.equal(formatStatistic(detail.channel.statistics.subscribers, {
    isPrivate: detail.channel.statistics.subscribersHidden,
  }), '비공개')
  assert.equal(formatStatistic(detail.videos[0].statistics.likes), '정보 없음')
})
