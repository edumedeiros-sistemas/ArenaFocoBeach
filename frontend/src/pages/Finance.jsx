import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiGet } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Finance() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAdmin = profile?.role === 'admin';
    Promise.all([
      apiGet('/pagamentos').catch(() => []),
      isAdmin ? apiGet('/pagamentos/summary').catch(() => null) : Promise.resolve(null),
    ]).then(([list, sum]) => {
      setPayments(Array.isArray(list) ? list : []);
      setSummary(sum || null);
    }).catch(() => toast.error('Erro ao carregar')).finally(() => setLoading(false));
  }, [profile?.role]);

  const statusLabel = { pending: 'Pendente', paid: 'Pago', overdue: 'Atrasado', cancelled: 'Cancelado' };
  const typeLabel = { mensalidade: 'Mensalidade', aluguel: 'Aluguel', inscricao: 'Inscrição', taxa: 'Taxa' };

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Financeiro</h1>
      <p className="text-gray-600 mb-6">Pagamentos, mensalidades e aluguéis.</p>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-700">Recebido</p>
            <p className="text-2xl font-bold text-green-800">R$ {Number(summary.totalPaid || 0).toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-700">Pendente</p>
            <p className="text-2xl font-bold text-amber-800">R$ {Number(summary.totalPending || 0).toFixed(2)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">Atrasado</p>
            <p className="text-2xl font-bold text-red-800">R$ {Number(summary.totalOverdue || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-sand-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand-100">
                <th className="text-left p-3">Descrição / Tipo</th>
                <th className="text-left p-3">Vencimento</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nenhum pagamento encontrado.</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">{p.description || typeLabel[p.type] || p.type}</td>
                    <td className="p-3">{p.dueDate?.toDate ? p.dueDate.toDate().toLocaleDateString('pt-BR') : (p.dueDate || '-')}</td>
                    <td className="p-3 text-right font-medium">R$ {Number(p.amount || 0).toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.status === 'paid' ? 'bg-green-100 text-green-800' :
                        p.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {statusLabel[p.status] || p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
