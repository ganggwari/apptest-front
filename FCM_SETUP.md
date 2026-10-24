# Firebase FCM PWA 설정

- Firebase 프로젝트 `pufpr-ab135-7d2a5`, 제공된 웹 설정 및 VAPID 공개 키를 `src/services/fcmPush.ts`와 기존 PWA의 `scripts/build-pwa.mjs`에 적용했습니다. Firebase 웹 설정/VAPID 공개 키는 비밀 서버 키가 아닙니다.
- Firebase 공식 compat SDK 10.14.1을 Google CDN에서 로드합니다 (별도 npm 설치 불필요). 시연 기기는 외부 Google CDN 접근이 가능해야 합니다.
- 기존 프런트 의존성(`npm ci`) 설치 후 `npm run build` 실행. 이 작업 환경은 npm 네트워크가 차단되어 빌드 성공을 검증하지 못했습니다.
- `npm run build` 후 Render Static Site를 재배포하세요. `dist/sw.js`는 빌드 스크립트가 생성합니다. `public/sw.js`를 따로 만들지 마세요.
- 관리자 PWA: 로그인 → 상단 **푸시 켜기** → 알림 허용 → `/api/managers/me/device-tokens`에 저장. 고객 PWA: 알림 수신 설정 → 켜기 → `/api/customers/me/device-tokens`에 저장. 기존에 권한이 허용된 경우 재로그인 시 자동 등록합니다.
- Render 백엔드에 `PUF_FCM_ENABLED=true`, `SECRET_FCM_CREDENTIALS_JSON`(Firebase Admin 서비스 계정 JSON 전체)을 설정하세요. 프런트 웹 설정/VAPID 키만으로 서버 발송은 불가능합니다. 비공개 서비스 계정 JSON을 정적 사이트에 절대 올리지 마세요.
- Firebase 콘솔 > Cloud Messaging > Web configuration의 공개 VAPID 키가 전달한 값과 같은지 확인하고, Firebase 프로젝트에 Render Static Site 도메인을 허용하세요. HTTPS 필수.
- iOS: iOS 16.4 이상 Safari에서 홈 화면에 추가한 PWA에서만 웹 푸시가 동작합니다. 앱을 홈 화면에 설치해 실행한 후 권한을 허용하세요.
- 프런트는 알림 표시 기능을 추가하지만, 서버 실제 발송 및 기기 수신 성공 여부는 실기기에서 검증해야 합니다. SSE는 앱 화면 갱신 용도로 유지됩니다.
- FCM 토큰은 DB 열 크기 255자에 맞는지 검사합니다. 초과하는 환경이면 `device_token.token`과 `manager_device_token.token`의 길이를 늘려야 합니다.
- 기존 Spring 코드와 환경변수 이름은 `application.properties`에 따라 확인하세요.

## Firebase 프로젝트 변경 (2026-10-24)

- 새 Firebase 프로젝트: `pufpr-ab135-7d2a5` / sender ID: `950702292615`. 웹 SDK와 `dist/sw.js` 생성 스크립트가 동일한 프로젝트를 사용하도록 변경.
- Render 백엔드 환경변수 `PUF_FCM_ENABLED=true`, `SECRET_FCM_CREDENTIALS_JSON`에 **새 Firebase 프로젝트의 서비스 계정 JSON 전체**를 설정하고 재배포. JSON은 절대 GitHub, Static Site, 빌드 결과에 복사하지 말 것.
- 서버의 `/api/push/config` 반환값도 새 프로젝트로 맞추려면 `SECRET_FCM_WEB_API_KEY`, `SECRET_FCM_WEB_PROJECT_ID`, `SECRET_FCM_WEB_SENDER_ID`, `SECRET_FCM_WEB_APP_ID`, `SECRET_FCM_WEB_VAPID_KEY`를 새 값으로 교체.
- 구 Firebase 프로젝트에서 발급받은 토큰은 새 프로젝트와 호환되지 않음. 관리자/고객 모두 재로그인 후 **푸시 켜기** 또는 알림 설정을 통해 새 토큰을 발급/등록. 구 토큰은 DB에서 정리 권장.
- 브라우저가 옛 Service Worker를 캐시한 경우 앱 새로고침, 사이트 데이터 재설정 또는 PWA 재설치 후 시도.
- 업로드한 서비스 계정 비공개 키가 대화에 공유되었으므로 Firebase/Google Cloud Console에서 이 키를 교체(기존 키 폐기, 새 키 발급)하고 Render에 새 JSON을 반영하는 것을 권장.
