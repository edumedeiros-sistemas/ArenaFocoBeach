import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiGet } from '../services/api';
import { useAuth } from '../context/AuthContext';

const sportLabels = { beach_tennis: 'Beach Tennis', futevolei: 'Futevôlei', volei_praia: 'Vôlei de Praia' };

export default function Leagues() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiGet('/ligas')
      .then(setList)
      .catch(() => toast.error('Erro ao carregar ligas'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    apiGet(`/ligas/${selected.id}`)
      .then((data) => setSelected(data))
      .catch(() => setSelected(null));
  }, [selected?.id]);

  const openDetail = (id) => {
    const item = list.find((l) => l.id === id);
    if (item) setSelected({ ...item }); // triggers fetch in useEffect
  };

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Ligas</h1>
      <p className="text-gray-600 mb-6">Tabelas de classificação e rodadas.</p>

      <div className="grid gap-4 md:grid-cols-2">
        {list.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-xl border border-sand-200 p-8 text-center text-gray-500">
            Nenhuma liga cadastrada. {isAdmin && 'Admins podem criar ligas.'}
          </div>
        ) : (
          list.map((l) => (
            <div
              key={l.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetail(l.id)}
              onKeyDown={(e) => e.key === 'Enter' && openDetail(l.id)}
              className="bg-white rounded-xl border border-sand-200 p-4 hover:border-ocean-300 cursor-pointer"
            >
              <h2 className="font-bold">{l.name}</h2>
              <p className="text-sm text-gray-500">{sportLabels[l.sport] || l.sport} • Temporada {l.season}</p>
              <p className="text-xs text-gray-400 mt-1">Vitória: {l.pointsWin} pts • Empate: {l.pointsDraw} • Derrota: {l.pointsLoss}</p>
            </div>
          ))
        )}
      </div>

      {selected && typeof selected.id === 'string' && selected.standings && (
        <div className="mt-8 bg-white rounded-xl border border-sand-200 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-bold text-lg">{selected.name} – Classificação</h2>
            <button type="button" onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-700">Fechar</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sand-100">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Time</th>
                  <th className="p-2">P</th>
                  <th className="p-2">V</th>
                  <th className="p-2">E</th>
                  <th className="p-2">D</th>
                  <th className="p-2">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {(selected.standings || []).sort((a, b) => (b.points || 0) - (a.points || 0)).map((s, i) => (
                  <tr key={s.teamId || i} className="border-t">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2 font-medium">{s.teamName}</td>
                    <td className="p-2 text-center">{s.played ?? 0}</td>
                    <td className="p-2 text-center">{s.won ?? 0}</td>
                    <td className="p-2 text-center">{s.draw ?? 0}</td>
                    <td className="p-2 text-center">{s.lost ?? 0}</td>
                    <td className="p-2 text-center font-bold">{s.points ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
