# Youflix

YouTube 채널을 카테고리별로 저장하고 탐색하는 Vite + React 앱입니다. 채널 목록은 브라우저 로컬스토리지와 Google Drive JSON 파일에 함께 저장됩니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 다음 값을 설정합니다.

- `VITE_GOOGLE_CLIENT_ID`: Google OAuth 2.0 웹 클라이언트 ID
- `VITE_GOOGLE_DRIVE_FILE_ID`: 채널 JSON 파일 ID
- `VITE_GOOGLE_DRIVE_SCOPE`: 선택값. 고정 ID의 기존 업로드 파일을 Picker 없이 사용하는 기본값은 `https://www.googleapis.com/auth/drive`

OAuth 웹 클라이언트의 승인된 JavaScript 원본에는 로컬 주소(예: `http://localhost:5173`)와 실제 GitHub Pages 원본을 등록해야 합니다. 액세스 토큰은 로컬스토리지에 저장하지 않고 현재 탭의 메모리에서만 재사용합니다.

이 OAuth 앱이 생성했거나 Google Picker로 이미 연결한 파일이라면 권한 범위를 `https://www.googleapis.com/auth/drive.file`로 좁힐 수 있습니다. 기존에 사용자가 직접 업로드한 고정 파일은 `drive.file` 범위에서 403이 발생할 수 있습니다.

Drive 파일은 현재 내보내기 형식(`{ "formatVersion": 1, "channels": [...] }`)과 기존 Youflix 배열 형식을 모두 읽습니다. 다음 채널 변경 시 현재 내보내기 형식으로 저장됩니다.

## GitHub Pages 설정

저장소의 `Settings → Secrets and variables → Actions → Variables`에 아래 변수를 등록합니다.

- `GOOGLE_CLIENT_ID`
- `GOOGLE_DRIVE_FILE_ID`
- `GOOGLE_DRIVE_SCOPE` (선택)

배포 워크플로가 이 값을 Vite 빌드 환경변수로 전달합니다. OAuth 승인 원본에는 `https://<사용자>.github.io`처럼 경로를 제외한 Pages 원본을 등록합니다.

## 검사

```bash
node --test
npm run lint
npm run build
```
