export default function ErrorFallback({ error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 border border-red-200">
        <h1 className="text-lg font-bold text-red-700 mb-2">Algo deu errado</h1>
        <p className="text-sm text-gray-700 mb-2">Recarregue a página. Se continuar, verifique o console (F12) e a configuração do Firebase.</p>
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-32 text-red-800">
          {error?.message || String(error)}
        </pre>
      </div>
    </div>
  );
}
