function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p>© {new Date().getFullYear()} YouFlix</p>
        <div className="app-footer__actions" aria-label="채널 데이터 관리">
          <button type="button">데이터 가져오기</button>
          <button type="button">데이터 내보내기</button>
        </div>
      </div>
    </footer>
  )
}

export default AppFooter
