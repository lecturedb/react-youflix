import assert from 'node:assert/strict'
import test from 'node:test'
import { initialChannels } from './channels.js'
import {
  downloadDriveChannels,
  parseDriveChannelData,
  uploadDriveChannels,
} from './channelDriveSync.js'

test('Drive 파일에서 현재 내보내기 형식과 기존 배열 형식을 모두 복원한다', () => {
  assert.deepEqual(
    parseDriveChannelData({ formatVersion: 1, channels: [initialChannels[0]] }),
    [initialChannels[0]],
  )

  assert.deepEqual(parseDriveChannelData([{
    chI: initialChannels[1].id,
    chN: initialChannels[1].name,
    cate: initialChannels[1].category,
    imgUrl: initialChannels[1].imageUrl,
  }]), [initialChannels[1]])
})

test('Drive 다운로드는 인증 헤더를 사용하고 채널 형식을 검증한다', async () => {
  let requestedUrl
  const channels = await downloadDriveChannels({
    accessToken: 'token',
    fileId: 'file id',
    fetchImpl: async (url, options) => {
      requestedUrl = url
      assert.equal(options.headers.Authorization, 'Bearer token')
      return new Response(JSON.stringify({ channels: [initialChannels[0]] }))
    },
  })

  assert.match(requestedUrl, /file%20id\?alt=media/)
  assert.deepEqual(channels, [initialChannels[0]])
})

test('Drive 업로드는 백업 형식의 JSON 전체를 PATCH한다', async () => {
  let request
  await uploadDriveChannels([initialChannels[0]], {
    accessToken: 'token',
    fileId: 'file-id',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response('{}')
    },
  })

  assert.match(request.url, /uploadType=media/)
  assert.equal(request.options.method, 'PATCH')
  assert.deepEqual(JSON.parse(request.options.body), {
    formatVersion: 1,
    channels: [initialChannels[0]],
  })
})

test('Drive 오류나 손상 데이터는 실패하고 호출자가 기존 목록을 유지할 수 있게 한다', async () => {
  await assert.rejects(
    downloadDriveChannels({
      accessToken: 'token',
      fileId: 'missing',
      fetchImpl: async () => new Response('{}', { status: 404 }),
    }),
    error => error.code === 'DRIVE_READ_FAILED',
  )

  assert.throws(
    () => parseDriveChannelData([{ id: '', name: 'broken', category: '음악' }]),
    error => error.code === 'DRIVE_INVALID_DATA',
  )
})
