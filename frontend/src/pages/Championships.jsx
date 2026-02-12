import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiGet } from '../services/api';
import { useAuth } from '../context/AuthContext';

const sportLabels = { beach_tennis: 'Beach Tennis', futevolei: 'Futevôlei', volei_praia: 'Vôlei de Praia' };

export default function Championships() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/campeonatos')
      .then(setList)
      .catch(() => toast.error('Erro ao carregar campeonatos'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Campeonatos</h1>
      <p className="text-gray-600 mb-6">Crie e acompanhe torneios, chaves e resultados.</p>

      <div className="grid gap-4">
        {list.length === 0 ? (
          <div className="bg-white rounded-xl border border-sand-200 p-8 text-center text-gray-500">
            Nenhum campeonato cadastrado. {isAdmin && 'Admins podem criar em Configurações.'}
          </div>
        ) : (
          list.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-sand-200 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-lg">{c.name}</h2>
                <p className="text-sm text-gray-500">{sportLabels[c.sport] || c.sport} • {c.format}</p>
                <p className="text-sm text-gray-600">
                  {c.startDate?.toDate ? c.startDate.toDate().toLocaleDateString('pt-BR') : ''} – {c.endDate?.toDate ? c.endDate.toDate().toLocaleDateString('pt-BR') : ''}
                </p>
              </div>
              <Link
                to={`/campeonatos/${c.id}`}
                className="px-4 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 text-sm font-medium"
              >
                Ver chave
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
