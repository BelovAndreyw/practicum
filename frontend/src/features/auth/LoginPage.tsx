import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Button, Input, Card } from '@/components/ui';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('a.petrov@urfu.ru');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card} padding="lg">
        <div className={styles.logo}>
          <img src="/favicon.svg" alt="КЗ" width={40} height={40} />
          <div>
            <span className="eyebrow">Добро пожаловать</span>
            <h1 className={styles.title}>Командный зачёт</h1>
          </div>
        </div>

        <p className={styles.hint}>Войдите с учётной записью УрФУ</p>

        <form onSubmit={onSubmit} className={styles.form}>
          <Input
            label="Email / логин УрФУ"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@urfu.ru"
            required
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <p className={styles.error}>{error}</p>}
          <Button type="submit" size="lg" loading={loading} style={{ width: '100%' }}>
            Войти
          </Button>
        </form>

        <p className={styles.footer}>
          Есть проблема со входом? Обратитесь к организаторам.
        </p>
      </Card>
    </div>
  );
}
