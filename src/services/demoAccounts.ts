// 시연용 계정. 시드 계정의 비밀번호는 아이디와 같다. 로그인 화면에 미리 채워 두고 로그인 버튼만 누르게 한다.
export const DEMO_ACCOUNTS = {
  customer: { loginId: 'customer01', password: 'customer01' },
  manager: { loginId: 'manager01', password: 'manager01' },
} as const
