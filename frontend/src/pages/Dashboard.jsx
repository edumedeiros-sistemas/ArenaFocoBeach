import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState({ courts: 0, classes: 0, paymentsPending: 0 });

  useEffect(() => {
    Promise.all([
      apiGet('/quadras').catch(() => []),
      apiGet('/aulas').catch(() => []),
      profile?.role === 'admin' ? apiGet('/pagamentos/summary').catch(() => ({})) : Promise.resolve({}),
    ]).then(([courts, classes, paySummary]) => {
      setSummary({
        courts: Array.isArray(courts) ? courts.length : 0,
        classes: Array.isArray(classes) ? classes.length : 0,
        paymentsPending: paySummary?.totalPending ?? 0,
      });
    }).catch(() => toast.error('Erro ao carregar resumo'));
  }, [profile?.role]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">Olá, {profile?.displayName || 'usuário'}! Aqui está o resumo.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/quadras" className="bg-white rounded-xl border border-sand-200 p-6 shadow-sm hover:shadow-md transition">
          <h2 className="font-semibold text-ocean-600">Quadras</h2>
          <p className="text-3xl font-bold text-gray-800 mt-2">{summary.courts}</p>
          <p className="text-sm text-gray-500 mt-1">Ver mapa e status</p>
        </Link>
        <Link to="/agenda" className="bg-white rounded-xl border border-sand-200 p-6 shadow-sm hover:shadow-md transition">
          <h2 className="font-semibold text-ocean-600">Turmas / Agenda</h2>
          <p className="text-3xl font-bold text-gray-800 mt-2">{summary.classes}</p>
          <p className="text-sm text-gray-500 mt-1">Ver calendário</p>
        </Link>
        {(profile?.role === 'admin' || profile?.role === 'instructor') && (
          <Link to="/financeiro" className="bg-white rounded-xl border border-sand-200 p-6 shadow-sm hover:shadow-md transition">
            <h2 className="font-semibold text-ocean-600">Pendentes (R$)</h2>
            <p className="text-3xl font-bold text-gray-800 mt-2">{Number(summary.paymentsPending).toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">Ver financeiro</p>
          </Link>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/campeonatos" className="p-4 rounded-xl bg-sand-100 border border-sand-200 hover:bg-sand-200 transition">
          <span className="font-medium">Campeonatos</span>
          <p className="text-sm text-gray-600 mt-1">Criar e gerenciar torneios e chaves</p>
        </Link>
        <Link to="/ligas" className="p-4 rounded-xl bg-sand-100 border border-sand-200 hover:bg-sand-200 transition">
          <span className="font-medium">Ligas</span>
          <p className="text-sm text-gray-600 mt-1">Tabelas de classificação e rodadas</p>
        </Link>
      </div>
    </div>
  );
}
