import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';
import { useAuth } from '../context/AuthContext';

function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}

export default function ConfiguracoesPlanos() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', daysPerWeek: 1, price: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchPlanos = () => {
    apiGet('/settings/planos')
      .then((data) => setItems(data.items || []))
      .catch(() => toast.error('Erro ao carregar planos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlanos();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', daysPerWeek: 1, price: '' });
    setShowForm(true);
  };

  const openEdit = (plano) => {
    setEditingId(plano.id);
    setForm({ name: plano.name ?? '', daysPerWeek: plano.daysPerWeek, price: String(plano.price ?? '') });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = String(form.name ?? '').trim();
    const days = Number(form.daysPerWeek);
    const price = parseFloat(String(form.price).replace(',', '.'));
    if (!name) {
      toast.error('Informe o nome do plano.');
      return;
    }
    if (!days || days < 1 || days > 7) {
      toast.error('Selecione de 1 a 7 dias na semana.');
      return;
    }
    if (isNaN(price) || price < 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await apiPut(`/settings/planos/${editingId}`, { name, daysPerWeek: days, price });
        toast.success('Plano atualizado.');
      } else {
        await apiPost('/settings/planos', { name, daysPerWeek: days, price });
        toast.success('Plano cadastrado.');
      }
      setShowForm(false);
      fetchPlanos();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Excluir este plano?')) return;
    try {
      await apiDelete(`/settings/planos/${id}`);
      toast.success('Plano excluído.');
      fetchPlanos();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Planos de aula</h1>
          <p className="text-gray-600">
            Cadastre os planos por quantidade de dias na semana e valor (ex.: 2x na semana – R$ 200,00). Apenas administradores podem criar e editar.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 font-medium"
          >
            Adicionar plano
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-sand-200 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum plano cadastrado.{isAdmin && ' Clique em "Adicionar plano" para criar.'}
          </div>
        ) : (
          <ul className="divide-y divide-sand-200">
            {items.map((plano) => (
              <li key={plano.id} className="flex items-center justify-between p-4 hover:bg-sand-50">
                <div>
                  <span className="font-medium text-gray-800">{plano.name || 'Sem nome'}</span>
                  <span className="text-gray-600 ml-2">
                    – {plano.daysPerWeek} {plano.daysPerWeek === 1 ? 'dia' : 'dias'}/semana
                  </span>
                  <span className="text-ocean-600 font-semibold ml-2">{formatPrice(plano.price)}</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(plano)}
                      className="px-3 py-1.5 text-sm text-ocean-600 hover:bg-ocean-50 rounded-lg font-medium"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(plano.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editingId ? 'Editar plano' : 'Novo plano'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do plano</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Plano Básico, 2x na semana"
                  className="w-full border border-sand-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dias na semana</label>
                <select
                  value={form.daysPerWeek}
                  onChange={(e) => setForm((f) => ({ ...f, daysPerWeek: Number(e.target.value) }))}
                  className="w-full border border-sand-300 rounded-lg px-3 py-2"
                  required
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>{d} {d === 1 ? 'dia' : 'dias'}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="Ex: 200,00"
                  className="w-full border border-sand-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} disabled={submitting} className="px-4 py-2 rounded-lg border border-sand-300 text-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-ocean-500 text-white font-medium disabled:opacity-50">
                  {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <p className="mt-4">
        <Link to="/configuracoes" className="text-ocean-600 hover:underline">← Voltar às configurações</Link>
      </p>
    </div>
  );
}
