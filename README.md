# Beach Flow System

**O fluxo perfeito para sua arena de areia**

Sistema full-stack para gerenciamento de arenas de esportes de areia (beach tennis, futevôlei, vôlei de praia): mapa de quadras, agenda, turmas, campeonatos, ligas e controle financeiro.

## Stack

- **Frontend:** React 18, React Router, Tailwind CSS, React Leaflet, React Big Calendar
- **Backend:** Node.js, Express, Firebase Admin SDK
- **Firebase:** Firestore, Authentication, Realtime Database, Storage, Cloud Messaging (FCM)

## Estrutura do Projeto

```
Beach_Flow_System/
├── backend/          # API REST Express + Firebase Admin
├── frontend/         # App React (Vite)
├── firebase/         # Regras Firestore, indexes
├── firebase.json     # Config Firebase CLI
└── README.md
```

## Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta Firebase (https://console.firebase.google.com)
- (Opcional) Conta Stripe/PagSeguro para pagamentos

## Configuração e execução local

### 1. Clone e instale dependências

```bash
cd Beach_Flow_System

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 2. Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com).
2. Ative: Authentication (Email/Password e Google), Firestore, Realtime Database, Storage, Cloud Messaging.
3. Gere uma chave de conta de serviço: Project Settings → Service accounts → Generate new private key. Salve o JSON em `backend/serviceAccountKey.json` (não commite no Git).
4. No console do Realtime Database, crie a raiz e regras (veja `firebase/database.rules`).
5. (Opcional) Na raiz do projeto: `npm install -g firebase-tools` e `firebase login`, depois `firebase init` para Firestore/Realtime/Storage se quiser deploy das regras.

### 3. Variáveis de ambiente

**Backend** – copie e preencha:

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (ou use `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json`)
- `PORT=4000`
- `FRONTEND_URL=http://localhost:5173` (ou a URL do frontend em dev)

**Frontend** – copie e preencha:

```bash
cp frontend/.env.example frontend/.env.local
```

Use as chaves do seu projeto Firebase (Config do projeto no console):

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, etc.
- `VITE_API_URL=http://localhost:4000`

### 4. Rodar localmente

**Importante:** Quadras, Agenda, Usuários e demais telas dependem da API. Sem o backend rodando, essas páginas exibem erro. Suba sempre os dois:

**Terminal 1 – Backend:**

```bash
cd backend && npm run dev
```

API em: http://localhost:4000

**Terminal 2 – Frontend:**

```bash
cd frontend && npm run dev
```

App em: http://localhost:5173

Se não houver `VITE_API_URL` no `.env` do frontend, o app usa por padrão `http://localhost:4000`. Em produção, defina `VITE_API_URL` com a URL da sua API.

### 5. Primeiro uso

1. Acesse o app e registre o primeiro usuário.
2. No Firestore, na coleção `users`, edite o documento do seu UID e defina `role: "admin"` para ter acesso total.
3. Crie quadras, turmas e demais dados pelo painel admin.

## Scripts úteis

| Onde      | Comando        | Descrição              |
|----------|----------------|------------------------|
| backend  | `npm run dev`  | Servidor com nodemon   |
| backend  | `npm test`     | Testes Jest            |
| frontend | `npm run dev`  | Dev server Vite        |
| frontend | `npm run build`| Build produção         |
| frontend | `npm test`     | Testes Vitest          |

## Funcionalidades principais

- **Autenticação:** Registro/login (email/senha e Google), perfis admin/instrutor/aluno.
- **Mapa de quadras:** Visualização interativa, status em tempo real (disponível/alugada/manutenção), detalhes e horários.
- **Agenda:** Calendário de aulas, aluguéis e eventos; turmas com alunos, instrutor e quadra; filtros por esporte/quadra.
- **Campeonatos:** Criação, grupos, chaves, inscrições, resultados e bracket.
- **Ligas:** Temporadas, pontuação configurável, tabela de classificação e rodadas.
- **Financeiro:** Mensalidades, aluguéis, taxas de campeonato/liga, relatórios e integração com gateways de pagamento (Stripe/PagSeguro).

## Deploy no Netlify (frontend)

O Netlify hospeda só o **frontend** (o build estático). A API (backend) precisa estar em outro serviço (Render, Railway, Fly.io, etc.) para Quadras, Agenda, Usuários e demais telas funcionarem.

### 1. Deploy do frontend no Netlify

1. Conecte o repositório GitHub ao Netlify.
2. O projeto já tem `netlify.toml` na raiz: o Netlify usa `base = "frontend"`, `command = "npm run build"` e `publish = "dist"`. Não precisa alterar.
3. Em **Site settings → Environment variables**, adicione todas as variáveis que o frontend usa (as que começam com `VITE_`):
   - **VITE_API_URL** = URL da sua API em produção (ex.: `https://sua-api.onrender.com`). **Obrigatório** para as telas funcionarem.
   - **VITE_FIREBASE_API_KEY**, **VITE_FIREBASE_AUTH_DOMAIN**, **VITE_FIREBASE_PROJECT_ID**, **VITE_FIREBASE_STORAGE_BUCKET**, **VITE_FIREBASE_MESSAGING_SENDER_ID**, **VITE_FIREBASE_APP_ID**, **VITE_FIREBASE_DATABASE_URL** (valores do Firebase Console).
4. Faça o deploy. O site ficará em algo como `https://seu-site.netlify.app`.

### 2. Deploy do backend (ex.: Render)

1. Crie um serviço **Web Service** no [Render](https://render.com) (ou Railway, Fly.io, etc.) usando o mesmo repositório.
2. Configure: **Root Directory** = `backend`, **Build Command** = `npm install`, **Start Command** = `npm start` (ou `node src/index.js`).
3. Nas variáveis de ambiente do backend, defina:
   - **FRONTEND_URL** = URL do seu site no Netlify (ex.: `https://seu-site.netlify.app`). Assim o CORS aceita requisições do frontend.
   - Variáveis do Firebase (project id, private key, client email, etc.) conforme `backend/.env.example`.
4. Após o deploy, copie a URL do backend (ex.: `https://beach-flow-api.onrender.com`) e use como **VITE_API_URL** no Netlify (e faça um novo deploy do frontend se já tiver deployado).

### 3. Resumo

| Onde     | Variável importante |
|----------|---------------------|
| Netlify  | `VITE_API_URL` = URL do backend em produção |
| Backend  | `FRONTEND_URL` = URL do site no Netlify |

Sem isso, o frontend no Netlify não consegue falar com a API e as telas (Quadras, Agenda, Usuários) dão erro.

## Segurança

- Validação de entrada em todas as rotas sensíveis.
- Firestore Rules restringem leitura/escrita por papel (admin/instrutor/aluno).
- Tokens Firebase Auth validados no backend para rotas protegidas.
- Nunca commite `serviceAccountKey.json` ou `.env`; use `.gitignore`.

## Licença

Uso interno / projeto proprietário.
