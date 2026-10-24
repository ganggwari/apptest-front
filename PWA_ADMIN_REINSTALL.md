# 관리자 PWA 주소창 문제 해결

현재 관리자 screenshot은 Chrome Custom Tab/바로가기 형태로 실행된 것으로 보입니다. 고객 앱처럼 주소창 없는 독립형 PWA는 브라우저 UI를 CSS로 감추는 것이 아니라 Chrome이 앱으로 **설치**하여 실행해야 합니다.

1. Render 프런트 재배포 후 Android Chrome을 직접 열기
2. 기존 관리자 바로가기 또는 설치된 앱 제거 (고객 앱은 유지 가능)
3. Chrome에서 `https://apptest-front.onrender.com/admin-app/install.html` 열기
4. `ROUTEL 관리자 앱 설치`가 보이면 클릭. 보이지 않으면 Chrome 메뉴 → 앱 설치 확인
5. 홈 화면의 **새 관리자 앱 아이콘**으로 실행

설치 페이지의 정적 `<link rel="manifest" href="/admin.webmanifest">` 덕분에 설치 프로세스 도중 고객용 manifest로 잘못 해석되는 일을 줄입니다. 관리자 및 고객의 manifest id/scope/start_url은 구분되어 있습니다.

주의: 카카오톡 내부 브라우저나 삼성 인터넷 등의 웹뷰/바로가기에서 열면 Chrome 설치와 다른 동작을 보일 수 있습니다. Android Chrome에서 직접 설치하세요. 기기가 해당 브라우저에서 설치 조건을 만족하지 않으면 앱 설치 버튼이 표시되지 않을 수 있습니다.

빌드/폰 실기기 테스트는 별도로 필요합니다.
