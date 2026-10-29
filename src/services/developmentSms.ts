import { backend, queryString } from './backend'

// 인증번호 자동 입력: 서버가 스텁 문자 모드(puf.sms-stub.expose-code=true)일 때만 코드를 돌려준다.
// 실제 문자 서비스를 쓰는 서버는 404 를 돌려주므로 아무 것도 채우지 않는다.
// 필요하면 빌드 환경변수 VITE_DEMO_SMS=false 로 이 기능을 끌 수 있다.
const DEMO_SMS_OFF = import.meta.env.VITE_DEMO_SMS === 'false'

export async function developmentSmsCode(phone: string): Promise<string> {
  if (DEMO_SMS_OFF || !phone) return ''
  // 문자 발송 직후에는 서버에 아직 기록이 없을 수 있어 몇 번 다시 확인한다
  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise<void>(resolve => setTimeout(resolve, attempt === 0 ? 600 : 900))
    try {
      const data = await backend<{ phone: string; code: string }>('/api/dev/sms/last' + queryString({ phone }))
      if (/^\d{6}$/.test(data?.code || '')) return data.code
    } catch {
      // 404(스텁 꺼짐) 또는 기록 없음: 다시 시도하다가 끝나면 빈 값
    }
  }
  return ''
}
