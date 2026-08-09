import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
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

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error);
        setIsGoogleSubmitting(false);
      }
    } catch {
      setError('A apărut o eroare la conectarea cu Google. Încearcă din nou.');
      setIsGoogleSubmitting(false);
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

        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={isSubmitting || isGoogleSubmitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-black bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
        >
          <GoogleIcon className="h-5 w-5 shrink-0" />
          {isGoogleSubmitting ? 'Se redirecționează...' : 'Continuă cu Google'}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-0.5 flex-1 bg-zinc-900 dark:bg-zinc-100" />
          <span className="text-xs font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            sau
          </span>
          <div className="h-0.5 flex-1 bg-zinc-900 dark:bg-zinc-100" />
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
