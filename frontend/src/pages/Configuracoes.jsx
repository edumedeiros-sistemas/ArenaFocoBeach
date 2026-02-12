import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const cards = [
  { to: '/configuracoes/roles', title: 'Roles (tipos de usuário)', description: 'Ver o que cada tipo pode fazer: Admin, Instrutor e Aluno.', adminOnly: false },
  { to: '/configuracoes/papeis', title: 'Papéis (funções)', description: 'Definir os papéis disponíveis (Professor, Aluno, Gerente, etc.). Independente do tipo de usuário.', adminOnly: true },
  { to: '/configuracoes/planos', title: 'Planos de aula', description: 'Cadastrar planos por dias na semana e valor (ex.: 2x na semana – R$ 200,00). Apenas admin pode criar e editar.', adminOnly: true },
  { to: '/usuarios', title: 'Usuários', description: 'Criar e gerenciar alunos, instrutores e administradores.', adminOnly: false },
  { to: '/quadras', title: 'Quadras', description: 'Cadastrar quadras e alterar status (disponível, alugada, manutenção).', adminOnly: true },
  { to: '/agenda', title: 'Agenda / Turmas', description: 'Criar turmas, inscrever alunos e definir horários.', adminOnly: false },
  { to: '/campeonatos', title: 'Campeonatos', description: 'Criar torneios, gerar chaves e registrar resultados.', adminOnly: true },
  { to: '/ligas', title: 'Ligas', description: 'Criar ligas, tabelas de classificação e rodadas.', adminOnly: true },
  { to: '/financeiro', title: 'Financeiro', description: 'Mensalidades, aluguéis e relatórios.', adminOnly: false },
];

export default function Configuracoes() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const visibleCards = cards.filter((c) => !c.adminOnly || isAdmin);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Configurações</h1>
      <p className="text-gray-600 mb-6">Painel de administração. Escolha o que deseja gerenciar.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map(({ to, title, description }) => (
          <Link
            key={to}
            to={to}
            className="block p-6 bg-white rounded-xl border border-sand-200 hover:border-ocean-300 hover:shadow-md transition"
          >
            <h2 className="font-semibold text-ocean-600">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
