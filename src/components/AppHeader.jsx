const ALL_LABEL = 'ALL'

function AppHeader({ categories, activeCategory, onCategorySelect, onAddChannel }) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button
          className="brand-button"
          type="button"
          aria-label="YouFlix 전체 채널 보기"
          onClick={() => onCategorySelect(ALL_LABEL)}
        >
          YouFlix
        </button>

        <nav className="category-nav" aria-label="채널 카테고리">
          <ul>
            {[ALL_LABEL, ...categories].map((category) => (
              <li key={category}>
                <button
                  type="button"
                  className={`category-nav__button${activeCategory === category ? ' is-active' : ''}`}
                  aria-current={activeCategory === category ? 'page' : undefined}
                  onClick={() => onCategorySelect(category)}
                >
                  {category}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <button
          className="add-channel-button"
          type="button"
          onClick={(event) => onAddChannel(event.currentTarget)}
        >
          <span aria-hidden="true">＋</span>
          채널 추가
        </button>
      </div>
    </header>
  )
}

export default AppHeader
