# 고객 PWA 내비게이션 시연 경로 이식

## 이식 출처
- `apptest-front-main/src/components/CustomerDirections.vue`의 `DEMO_TRIPS` 좌표 3쌍
- `/api/navigation/route` 기반 위험 지하차도 우회·선택형 우회 로직
- `/api/navigation/hazards` version 변화 감지 및 `routel-backend-event` 연동

## 유지
- 최신 프런트의 `requestAnimationFrame` 기반 시연 주행, 1~16배속, 일시정지
- FCM / SSE 연결 상태 및 계정 전환·stub 조작 UI
- 별도 Render Static Site ↔ Spring 백엔드 분리 배포 주소 설정

## 시연 순서
1. 고객 앱 길찾기에서 **초량지하차도 경로** 버튼 선택. 시연 주행 모드가 자동 선택됨.
2. 위험 단계가 관심/주의라면 Spring `/api/navigation/route`에서 선택 우회 경로를 제안할 수 있음.
3. 주행 시작, 관리자 stub에서 해당 지하차도 위험 단계 상승.
4. `/api/navigation/hazards` version 변경 확인(최대 약 4초 폴링, SSE 이벤트도 확인) 후 현재 위치에서 자동 재탐색.

## 검증 한계
- 실제 카카오 경로가 해당 지하차도를 지나는지는 외부 지도 경로 및 DB 상태에 따라 다름.
- 프런트 npm 의존성(특히 vue-tsc) 캐시 부재로 전체 빌드 미검증.
- 실기기 FCM, SSE, 내비 연동의 End-to-end 테스트는 미수행.
