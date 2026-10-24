# PWA 홈 화면 독립 실행 안내

앱 페이지(`/admin-app/screen-1` 또는 `/customer-app/screen-1`)를 Chrome Android에서 열고 메뉴 → **홈 화면에 추가 / 앱 설치**를 선택합니다. iPhone Safari는 공유 → **홈 화면에 추가**를 사용합니다. 일반 브라우저 탭의 주소창을 CSS/JavaScript로 숨길 수는 없습니다. 기존에 설치했다면 홈 화면 아이콘을 삭제한 다음 재설치하여 새 manifest를 적용하세요.

관리자와 고객 앱은 각각 별도 manifest/id/start_url/scope로 설치됩니다. 웹 푸시는 사용자 권한 승인과 실제 FCM 토큰 등록이 필요합니다. 브라우저가 화면을 잠갔거나 앱을 백그라운드로 내리면 JavaScript 소리 재생은 보장되지 않으며 알림음은 기기 알림 설정에 따릅니다.
