# PUF Render 분리 배포 — 프런트 GitHub 저장소

- Static Site: https://apptest-front.onrender.com
- Spring API: https://apptest-backend-tj3a.onrender.com
- Render Static Site build: `npm ci && npm run build`, publish directory: `dist`
- `VITE_API_BASE_URL=https://apptest-backend-tj3a.onrender.com` (빌드 환경변수 선택 사항; 기본값도 동일)
- 프런트 `public/_redirects`는 SPA fallback만 관리. REST/SSE/WS는 백엔드 직접 연결합니다.
- 카카오 JS 키·등록 도메인, Firebase FCM 설정, 기존 stub 버튼, SSE 상태 표시, PWA 파일은 유지합니다.
- Cross-site 쿠키 지원은 브라우저의 서드파티 쿠키 정책에 따라 제한될 수 있습니다. 모바일 PWA 기기별 실제 로그인·SSE·FCM 검증이 필수입니다.
- 브라우저 개발자도구 Network에서 로그인 POST와 후속 /me 응답을 확인하고 Set-Cookie에 `SameSite=None; Secure`가 있는지 확인하세요.
- FCM 권한·Service Worker는 프런트 HTTPS origin에서 동작합니다. Firebase 서비스 계정 JSON은 절대 프런트에 넣지 않습니다.
