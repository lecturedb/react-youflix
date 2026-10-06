import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildChannelDetail,
  formatDuration,
  formatPublishedAt,
  formatStatistic,
} from './channelDetail.js'
import {
  buildMockChannelDetail,
  mockChannelDetail,
} from './mockChannelDetail.js'

test('실제 API의 채널·업로드·영상 응답을 ID 기준으로 결합하고 최신순으로 정렬한다', () => {
  const detail = buildChannelDetail({
    channel: {
      id: 'channel-1',
      snippet: {
        title: '실제 채널',
        thumbnails: { high: { url: 'channel-high.jpg' } },
      },
      statistics: { viewCount: '100', videoCount: '2' },
    },
    playlistItems: [
      {
        contentDetails: { videoId: 'older', videoPublishedAt: '2025-01-01T00:00:00Z' },
        snippet: { title: '이전 제목' },
      },
      {
        contentDetails: { videoId: 'newer', videoPublishedAt: '2025-02-01T00:00:00Z' },
        snippet: { title: '최신 제목' },
      },
    ],
    videoDetails: [
      {
        id: 'newer',
        snippet: {
          title: '최신 상세 제목',
          thumbnails: { maxres: { url: 'newer.jpg' } },
        },
        contentDetails: { duration: 'PT2M' },
        statistics: { viewCount: '20' },
        status: { embeddable: true },
      },
      {
        id: 'older',
        contentDetails: { duration: 'PT1M' },
        statistics: { viewCount: '10' },
        status: { embeddable: true },
      },
    ],
  })

  assert.equal(detail.channel.name, '실제 채널')
  assert.equal(detail.channel.imageUrl, 'channel-high.jpg')
  assert.equal(detail.featuredVideo.id, 'newer')
  assert.equal(detail.featuredVideo.title, '최신 상세 제목')
  assert.equal(detail.featuredVideo.thumbnailUrl, 'newer.jpg')
  assert.equal(detail.videos[1].id, 'older')
})

test('Mock API 응답을 채널과 최신순 영상 목록으로 결합한다', () => {
  assert.equal(mockChannelDetail.channel.id, 'UC_x5XG1OV2P6uZZ5FSM9Ttw')
  assert.equal(mockChannelDetail.channel.name, 'Google for Developers')
  assert.equal(mockChannelDetail.videos.length, 6)
  assert.equal(mockChannelDetail.featuredVideo.id, 'VldX34mM95o')
  assert.equal(mockChannelDetail.featuredVideo.duration, 'PT48M11S')
  assert.equal(mockChannelDetail.featuredVideo.youtubeVideoId, 'VldX34mM95o')
  assert.deepEqual(mockChannelDetail.featuredVideo.playback, { isPlayable: true })
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

test('삭제·비공개·임베드 제한 영상을 재생 불가 상태로 구분한다', () => {
  const uploads = {
    items: [
      { snippet: { title: '삭제된 영상', resourceId: { videoId: 'deleted' } } },
      { snippet: { title: '비공개 영상', resourceId: { videoId: 'private' } } },
      { snippet: { title: '임베드 제한 영상', resourceId: { videoId: 'restricted' } } },
      { snippet: { title: 'ID 없는 영상' } },
    ],
  }
  const detail = buildMockChannelDetail({
    uploads,
    videoDetails: [
      { items: [] },
      { items: [{ status: { privacyStatus: 'private' } }] },
      { items: [{ status: { embeddable: false } }] },
      { items: [{}] },
    ],
  })

  assert.equal(detail.videos[0].playback.isPlayable, false)
  assert.match(detail.videos[0].playback.unavailableMessage, /삭제/)
  assert.match(detail.videos[1].playback.unavailableMessage, /비공개/)
  assert.match(detail.videos[2].playback.unavailableMessage, /소유자 설정/)
  assert.match(detail.videos[3].playback.unavailableMessage, /영상 ID/)
})
