# FCM + SSE / demo integration

- `/demo.html`: 테스트 컨트롤 패널(위험 단계, 번호판, 시나리오, 빠른 계정 로그인). 관리자 인증 및 `puf.demo.enabled=true` 필요.
- 화면 왼쪽 아래 `⇄ 계정`: 테스트 계정 빠른 전환 (시드 DB의 계정 암호가 ID와 같다는 전제). ?nodemo=1 로 숨김.
- 상단 SSE/WS 표시줄: 초록=최근 이벤트 수신, 노랑=연결 중/수신 지연, 빨강=연결 끊김. 한번 누르면 축소, 두 번 누르면 WS 재확인.
- SSE 재연결: 서버 기본 15초 heartbeat, 프런트 40초 watchdog, 재연결 백오프 1/2/5/10/20초, 탭 복귀/온라인 복원.
- **백엔드 ZIP도 필수 배포**: 서버가 4KB heartbeat 를 보내야 정상 동작.
- Render Static Site의 `/api/*` URL을 Spring으로 프록시하는 기존 구성 유지 필요. 서로 다른 origin이면 해당 상대경로가 동작하지 않음.
- 테스트 위젯과 시연 API는 공개 운영환경에서 비활성화해야 합니다.
- `FCM_SETUP.md`의 Firebase 발송 서비스 계정 설정은 별도로 적용해야 합니다.
