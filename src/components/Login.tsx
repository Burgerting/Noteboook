import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../store/AuthContext';
import { LogIn } from 'lucide-react';

export default function Login() {
  const { setToken } = useAuth();

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setToken(codeResponse.access_token);
    },
    onError: (error) => console.log('Login Failed:', error),
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly',
  });

  return (
    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', margin: '0 auto', marginTop: '10vh' }}>
      <h1 style={{ marginBottom: '1rem' }}>雲端同步應用程式</h1>
      <p style={{ marginBottom: '2rem' }}>登入您的 Google 帳戶，安全地同步您的記事與記帳資料。</p>
      
      <button className="btn btn-primary" onClick={() => login()} style={{ width: '100%', padding: '0.75rem' }}>
        <LogIn size={20} />
        使用 Google 帳號登入
      </button>
      
      <button className="btn btn-ghost" onClick={() => setToken('mock-token')} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem' }}>
        本地測試模式 (免登入)
      </button>
    </div>
  );
}
