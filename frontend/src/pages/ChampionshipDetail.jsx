import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiGet } from '../services/api';

const sportLabels = { beach_tennis: 'Beach Tennis', futevolei: 'Futevôlei', volei_praia: 'Vôlei de Praia' };

export default function ChampionshipDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiGet(`/campeonatos/${id}`)
      .then(setData)
      .catch(() => toast.error('Erro ao carregar campeonato'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4">Carregando...</div>;
  if (!data) return <div className="p-4">Campeonato não encontrado.</div>;

  const toDate = (v) => {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    const sec = v.seconds ?? v._seconds;
    return sec != null ? new Date(sec * 1000) : new Date(v);
  };

  return (
    <div>
      <div className="mb-4">
        <Link to="/campeonatos" className="text-ocean-600 hover:underline">← Voltar</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{data.name}</h1>
      <p className="text-gray-600 mb-6">
        {sportLabels[data.sport] || data.sport} • {data.format} • {toDate(data.startDate)?.toLocaleDateString('pt-BR')} – {toDate(data.endDate)?.toLocaleDateString('pt-BR')}
      </p>

      {data.groups?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Grupos</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.groups.map((g) => (
              <div key={g.id} className="bg-white rounded-xl border border-sand-200 p-4">
                <h3 className="font-medium text-ocean-600">{g.name}</h3>
                <ul className="mt-2 text-sm text-gray-600">
                  {(g.teamNames || []).map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.matches?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Partidas</h2>
          <div className="bg-white rounded-xl border border-sand-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sand-100">
                  <th className="text-left p-3">Rodada</th>
                  <th className="text-left p-3">Time 1</th>
                  <th className="text-left p-3">Time 2</th>
                  <th className="p-3">Placar</th>
                  <th className="text-left p-3">Vencedor</th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-3">{m.round}</td>
                    <td className="p-3">{m.team1Id || '-'}</td>
                    <td className="p-3">{m.team2Id || '-'}</td>
                    <td className="p-3 text-center">{m.team1Score ?? '-'} x {m.team2Score ?? '-'}</td>
                    <td className="p-3">{m.winnerId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!data.groups?.length && !data.matches?.length) && (
        <p className="text-gray-500">Nenhum grupo ou partida gerada ainda. Admins podem gerar chaves no painel.</p>
      )}
    </div>
  );
}
