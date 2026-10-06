const IDLE_STATE = Object.freeze({
  status: 'idle',
  data: null,
  error: null,
})

/**
 * 화면의 각 요청 영역에서 독립적으로 로딩·성공·실패·재시도를 관리한다.
 * 진행 중인 요청은 다시 실행하지 않고, 실패하더라도 직전 성공 데이터는 유지한다.
 */
export function createRequestState(initialData = null) {
  let state = initialData === null
    ? IDLE_STATE
    : { status: 'success', data: initialData, error: null }
  let pendingRequest = null
  let lastRequest = null
  const listeners = new Set()

  const notify = () => {
    listeners.forEach(listener => listener(state))
  }

  const setState = (nextState) => {
    state = nextState
    notify()
  }

  const run = (request) => {
    if (pendingRequest) return pendingRequest

    lastRequest = request
    setState({ status: 'loading', data: state.data, error: null })

    pendingRequest = Promise.resolve()
      .then(request)
      .then((data) => {
        setState({ status: 'success', data, error: null })
        return data
      })
      .catch((error) => {
        setState({ status: 'error', data: state.data, error })
        throw error
      })
      .finally(() => {
        pendingRequest = null
      })

    return pendingRequest
  }

  return {
    getState: () => state,
    isPending: () => pendingRequest !== null,
    run,
    retry: () => (
      lastRequest
        ? run(lastRequest)
        : Promise.reject(new Error('재시도할 요청이 없습니다.'))
    ),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
