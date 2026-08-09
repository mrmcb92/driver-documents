import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setError('Introdu o adresă de email validă.');
      return;
    }
    if (password.length < 6) {
      setError('Parola trebuie să aibă cel puțin 6 caractere.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = isRegister
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);

      if (result.error) {
        setError(result.error);
      } else if (isRegister) {
        setError(
          'Contul a fost creat. Verifică-ți emailul pentru linkul de confirmare, apoi autentifică-te.'
        );
        setIsRegister(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputBaseClass =
    'w-full rounded-xl border-2 bg-white px-4 py-3 text-zinc-900 outline-none transition-colors focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-600';
  const inputNormalClass =
    'border-zinc-900 focus:border-zinc-900 dark:border-zinc-100 dark:focus:border-zinc-100';

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 transition-colors duration-200 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-slide-up dark:border-white dark:bg-zinc-900 dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🚗</div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
            Driver Documents
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {isRegister
              ? 'Creează-ți un cont pentru a-ți gestiona documentele'
              : 'Autentifică-te pentru a accesa documentele tale'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nume@exemplu.ro"
              autoComplete="email"
              className={`${inputBaseClass} ${inputNormalClass}`}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-sm">
              Parolă
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minim 6 caractere"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className={`${inputBaseClass} ${inputNormalClass}`}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border-2 border-black bg-zinc-200 px-3 py-2 text-sm font-bold text-zinc-900 dark:border-white dark:bg-zinc-800 dark:text-zinc-100"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl border-2 border-black bg-black px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-white dark:text-black dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:text-base"
          >
            {isSubmitting ? 'Se procesează...' : isRegister ? 'Creează cont' : 'Autentifică-te'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {isRegister ? 'Ai deja un cont?' : 'Nu ai un cont?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister((prev) => !prev);
              setError(null);
            }}
            className="font-black text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
          >
            {isRegister ? 'Autentifică-te' : 'Creează unul acum'}
          </button>
        </p>
      </div>
    </div>
  );
}
