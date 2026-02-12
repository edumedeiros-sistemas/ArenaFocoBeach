const ROLES = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrador do sistema. Acesso total.',
    permissions: [
      'Alterar tipo de usuário (role) de qualquer pessoa (apenas outro admin pode alterar um admin)',
      'Criar, editar e listar todos os usuários',
      'Configurar papéis (funções) disponíveis no sistema',
      'Criar e editar quadras; alterar status (disponível, alugada, manutenção)',
      'Criar, editar e cancelar turmas/aulas; inscrever e remover alunos',
      'Criar campeonatos, gerar chaves, registrar resultados e inscrições',
      'Criar ligas, adicionar times, registrar resultados e ver classificação',
      'Ver todos os pagamentos; marcar como pago ou inadimplente; ver resumo financeiro',
      'Criar reservas/aluguéis de quadras',
    ],
    color: 'ocean',
  },
  {
    id: 'instructor',
    name: 'Instrutor',
    description: 'Instrutor ou coordenador. Gerencia aulas, quadras e participantes.',
    permissions: [
      'Criar usuários (alunos) e editar dados de outros usuários (exceto tipo de usuário)',
      'Alterar status das quadras em tempo real',
      'Criar, editar e cancelar turmas/aulas; inscrever e remover alunos',
      'Registrar resultados em campeonatos e ligas (não cria campeonatos/ligas)',
      'Ver e gerenciar pagamentos; criar registros de pagamento',
      'Criar reservas/aluguéis de quadras',
      'Acessar menu Configurações, Usuários e Financeiro',
    ],
    color: 'green',
  },
  {
    id: 'student',
    name: 'Aluno',
    description: 'Aluno ou participante. Visualiza agenda e gerencia próprio perfil.',
    permissions: [
      'Ver dashboard, mapa de quadras, agenda e calendário de aulas',
      'Ver campeonatos e ligas (brackets, tabelas, resultados)',
      'Ver seus próprios pagamentos e situação financeira',
      'Ver próprio perfil (somente leitura; alterações devem ser feitas por admin ou instrutor)',
      'Não pode alterar tipo de usuário de ninguém, nem acessar lista completa de usuários ou configurações de papéis',
    ],
    color: 'gray',
  },
];

const colorClasses = {
  ocean: 'border-ocean-200 bg-ocean-50 text-ocean-800',
  green: 'border-green-200 bg-green-50 text-green-800',
  gray: 'border-gray-200 bg-gray-50 text-gray-800',
};

export default function ConfiguracoesRoles() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Roles (tipos de usuário)</h1>
      <p className="text-gray-600 mb-6">
        Cada usuário tem um <strong>tipo (role)</strong> que define o que ele pode fazer no sistema. O tipo é independente do <strong>papel/função</strong> (Professor, Aluno, Gerente), que descreve a atuação da pessoa na arena.
      </p>

      <div className="space-y-6">
        {ROLES.map((role) => (
          <div
            key={role.id}
            className={`rounded-xl border-2 p-6 ${colorClasses[role.color] || colorClasses.gray}`}
          >
            <h2 className="text-lg font-bold mb-1">{role.name}</h2>
            <p className="text-sm opacity-90 mb-4">{role.description}</p>
            <h3 className="text-sm font-semibold mb-2">O que pode fazer:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {role.permissions.map((perm, i) => (
                <li key={i}>{perm}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
