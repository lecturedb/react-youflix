import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequestState } from './requestState.js'

test('요청 영역별 로딩과 성공 상태를 관리한다', async () => {
  const requestState = createRequestState()
  const states = []
  requestState.subscribe(state => states.push(state.status))

  const result = await requestState.run(() => Promise.resolve({ id: 'channel-1' }))

  assert.deepEqual(result, { id: 'channel-1' })
  assert.deepEqual(states, ['loading', 'success'])
  assert.deepEqual(requestState.getState(), {
    status: 'success',
    data: { id: 'channel-1' },
    error: null,
  })
})

test('처리 중 중복 실행을 막고 같은 요청 결과를 공유한다', async () => {
  const requestState = createRequestState()
  let resolveRequest
  let callCount = 0
  const request = () => {
    callCount += 1
    return new Promise((resolve) => {
      resolveRequest = resolve
    })
  }

  const first = requestState.run(request)
  const duplicate = requestState.run(request)

  assert.equal(first, duplicate)
  assert.equal(callCount, 0)
  await Promise.resolve()
  assert.equal(callCount, 1)

  resolveRequest('complete')
  assert.equal(await first, 'complete')
})

test('실패 시 직전 성공 데이터를 유지하고 같은 요청을 재시도한다', async () => {
  const previousData = { items: ['existing'] }
  const requestState = createRequestState(previousData)
  let callCount = 0
  const request = () => {
    callCount += 1
    return callCount === 1
      ? Promise.reject(new Error('temporary'))
      : Promise.resolve({ items: ['refreshed'] })
  }

  await assert.rejects(requestState.run(request), /temporary/)
  assert.equal(requestState.getState().status, 'error')
  assert.deepEqual(requestState.getState().data, previousData)

  const result = await requestState.retry()
  assert.deepEqual(result, { items: ['refreshed'] })
  assert.equal(requestState.getState().status, 'success')
})
