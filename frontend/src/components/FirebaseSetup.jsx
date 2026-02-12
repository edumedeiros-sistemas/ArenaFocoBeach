export default function FirebaseSetup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 border border-sand-200">
        <h1 className="text-xl font-bold text-ocean-600 mb-2">Beach Flow System</h1>
        <p className="text-gray-700 mb-4">
          Para o app funcionar, configure as chaves do Firebase no frontend.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 mb-6">
          <li>No Firebase Console, abra seu projeto → Configurações (ícone de engrenagem) → Geral.</li>
          <li>Em “Seus apps”, selecione o app Web (ou crie um) e copie o objeto <code className="bg-gray-100 px-1 rounded">firebaseConfig</code>.</li>
          <li>Na pasta <code className="bg-gray-100 px-1 rounded">frontend</code>, copie o arquivo <code className="bg-gray-100 px-1 rounded">.env.example</code> para <code className="bg-gray-100 px-1 rounded">.env.local</code>.</li>
          <li>Preencha <code className="bg-gray-100 px-1 rounded">.env.local</code> com as chaves (VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, etc.).</li>
          <li>Ative Authentication (Email/Password e Google) e Firestore no Firebase Console.</li>
          <li>Reinicie o servidor do frontend (<code className="bg-gray-100 px-1 rounded">npm run dev</code>).</li>
        </ol>
        <p className="text-xs text-gray-500">
          Exemplo de .env.local: <br />
          <span className="font-mono">VITE_FIREBASE_API_KEY=xxx</span>, <br />
          <span className="font-mono">VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com</span>, <br />
          <span className="font-mono">VITE_FIREBASE_PROJECT_ID=seu-projeto</span>, etc.
        </p>
      </div>
    </div>
  );
}
