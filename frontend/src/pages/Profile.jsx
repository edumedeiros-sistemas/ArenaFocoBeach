import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiPatch } from '../services/api';
import { usePapeis } from '../hooks/usePapeis';

const tipoLabels = { admin: 'Admin', instructor: 'Instrutor', student: 'Aluno' };

export default function Profile() {
  const { user, profile } = useAuth();
  const { items: papeisItems } = usePapeis();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [preferredSport, setPreferredSport] = useState(profile?.preferredSport || '');
  const [papel, setPapel] = useState(profile?.papel || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || '');
    setPhone(profile?.phone || '');
    setPreferredSport(profile?.preferredSport || '');
    setPapel(profile?.papel || '');
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPatch('/users/me', { displayName, phone, preferredSport: preferredSport || null, papel: papel || null });
      toast.success('Perfil atualizado');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const isStudent = profile?.role === 'student';
  const sportLabels = { beach_tennis: 'Beach Tennis', futevolei: 'Futevôlei', volei_praia: 'Vôlei de Praia' };
  const papelLabel = papeisItems.find((p) => p.id === profile?.papel)?.label || profile?.papel || '—';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Meu Perfil</h1>
      <p className="text-gray-600 mb-6">
        {isStudent ? 'Seus dados. Alterações devem ser solicitadas a um admin ou instrutor.' : 'Atualize seus dados.'}
      </p>

      <div className="bg-white rounded-xl border border-sand-200 p-6 max-w-md">
        <p className="text-sm text-gray-500 mb-2">Email (conta): {user?.email}</p>
        <p className="text-sm text-gray-500 mb-2">Tipo de usuário: <strong>{tipoLabels[profile?.role] || profile?.role}</strong></p>

        {isStudent ? (
          <div className="space-y-3 text-sm">
            <p><span className="text-gray-500">Nome:</span> {profile?.displayName || '—'}</p>
            <p><span className="text-gray-500">Telefone:</span> {profile?.phone || '—'}</p>
            <p><span className="text-gray-500">Esporte preferido:</span> {sportLabels[profile?.preferredSport] || profile?.preferredSport || '—'}</p>
            <p><span className="text-gray-500">Papel (função):</span> {papelLabel}</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Esporte preferido</label>
              <select
                value={preferredSport}
                onChange={(e) => setPreferredSport(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500"
              >
                <option value="">Nenhum</option>
                <option value="beach_tennis">Beach Tennis</option>
                <option value="futevolei">Futevôlei</option>
                <option value="volei_praia">Vôlei de Praia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel (função)</label>
              <select value={papel} onChange={(e) => setPapel(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500">
                <option value="">—</option>
                {papeisItems.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
