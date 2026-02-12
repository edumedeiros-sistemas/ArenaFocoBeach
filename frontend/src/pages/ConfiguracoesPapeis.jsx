import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiGet, apiPut } from '../services/api';

export default function ConfiguracoesPapeis() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    apiGet('/settings/papeis')
      .then((data) => setItems(data.items || []))
      .catch(() => toast.error('Erro ao carregar papéis'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (newItems) => {
    setSaving(true);
    try {
      const data = await apiPut('/settings/papeis', { items: newItems });
      setItems(data.items || newItems);
      toast.success('Papéis salvos.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const add = (e) => {
    e.preventDefault();
    const id = (newId || newLabel).trim().toLowerCase().replace(/\s+/g, '_');
    const label = (newLabel || newId).trim();
    if (!id || !label) {
      toast.error('Preencha o nome do papel.');
      return;
    }
    if (items.some((p) => p.id === id)) {
      toast.error('Já existe um papel com esse identificador.');
      return;
    }
    const next = [...items, { id, label }];
    setItems(next);
    save(next);
    setNewId('');
    setNewLabel('');
  };

  const update = (index, label) => {
    const next = items.map((p, i) => (i === index ? { ...p, label: label.trim() } : p));
    setItems(next);
  };

  const saveOnBlur = () => {
    save(items);
  };

  const remove = (index) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    save(next);
  };

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Papéis (funções)</h1>
      <p className="text-gray-600 mb-6">
        Defina os papéis que podem ser atribuídos aos usuários. Papel é a <strong>função</strong> da pessoa (ex.: Professor, Aluno), diferente do <strong>tipo de usuário</strong> (Admin, Instrutor, Aluno), que define permissões no sistema.
      </p>

      <form onSubmit={add} className="mb-8 p-6 bg-white rounded-xl border border-sand-200 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do papel</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex: Coordenador"
            className="px-3 py-2 border border-gray-300 rounded-lg w-48"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ID (opcional)</label>
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Ex: coordenador"
            className="px-3 py-2 border border-gray-300 rounded-lg w-40 font-mono text-sm"
          />
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 disabled:opacity-50">
          Adicionar
        </button>
      </form>

      <div className="bg-white rounded-xl border border-sand-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100">
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Nome (label)</th>
              <th className="text-right p-3 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={3} className="p-6 text-center text-gray-500">Nenhum papel configurado. Adicione acima.</td></tr>
            ) : (
              items.map((p, i) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-mono text-gray-600">{p.id}</td>
                  <td className="p-3">
                    <input
                      value={p.label}
                      onChange={(e) => update(i, e.target.value)}
                      onBlur={saveOnBlur}
                      className="px-2 py-1 border border-gray-300 rounded w-full max-w-xs"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => remove(i)} className="text-red-600 hover:underline text-sm">Remover</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
