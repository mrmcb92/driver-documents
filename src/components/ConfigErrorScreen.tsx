interface ConfigErrorScreenProps {
  message: string;
}

export default function ConfigErrorScreen({ message }: ConfigErrorScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 transition-colors duration-200 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border-2 border-black bg-white p-6 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-slide-up dark:border-white dark:bg-zinc-900 dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] sm:p-8">
        <div className="mb-3 text-5xl">⚠️</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
          Aplicația nu este configurată
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
          {message}
        </p>
      </div>
    </div>
  );
}
