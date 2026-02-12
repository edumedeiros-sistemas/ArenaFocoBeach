import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiGet, apiPatch, apiPost } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePapeis } from '../hooks/usePapeis';

const tipoLabels = { admin: 'Admin', instructor: 'Instrutor', student: 'Aluno' };
const sportLabels = { beach_tennis: 'Beach Tennis', futevolei: 'Futevôlei', volei_praia: 'Vôlei de Praia' };
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const defaultSlot = () => ({ dayOfWeek: 1, start: '08:00', end: '09:00', courtId: '', professorId: '' });

function scheduleLengthForPlan(planId, planos) {
  const plano = planos.find((p) => p.id === planId);
  return plano?.daysPerWeek ?? 1;
}

function resizeScheduleToPlan(planId, planos, currentSchedule) {
  const days = scheduleLengthForPlan(planId, planos);
  const current = Array.isArray(currentSchedule) && currentSchedule.length > 0 ? currentSchedule : [defaultSlot()];
  if (current.length < days) {
    return [...current.map((s) => ({ ...s })), ...Array.from({ length: days - current.length }, defaultSlot)];
  }
  if (current.length > days) {
    return current.slice(0, days).map((s) => ({ ...s }));
  }
  return current.map((s) => ({ ...s }));
}

export default function Users() {
  const { profile, user } = useAuth();
  const { items: papeisItems, labelMap: papelLabels } = usePapeis();
  const currentUid = user?.uid;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    displayName: '', email: '', password: '', phone: '', preferredSport: '', role: 'student', papel: '',
    planId: '', contractStart: '', contractEnd: '', paymentDueDay: 10, schedule: [defaultSlot()],
  });
  const [courts, setCourts] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [allUsersForProfessor, setAllUsersForProfessor] = useState([]);
  const [editScheduleUser, setEditScheduleUser] = useState(null);
  const [editSchedule, setEditSchedule] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    apiGet('/quadras').then(setCourts).catch(() => []);
    apiGet('/settings/planos').then((d) => setPlanos(d.items || [])).catch(() => []);
  }, []);

  const setContractStart = (dateStr) => {
    if (!dateStr) {
      setForm((f) => ({ ...f, contractStart: '', contractEnd: '' }));
      return;
    }
    const start = new Date(dateStr);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    setForm((f) => ({
      ...f,
      contractStart: dateStr,
      contractEnd: end.toISOString().slice(0, 10),
    }));
  };

  useEffect(() => {
    const q = roleFilter ? `?role=${roleFilter}` : '';
    apiGet(`/users${q}`)
      .then(setUsers)
      .catch(() => toast.error('Erro ao carregar usuários'))
      .finally(() => setLoading(false));
  }, [roleFilter]);

  useEffect(() => {
    if ((showCreate && form.role === 'student') || (editUser && editUser.role === 'student')) {
      apiGet('/users').then(setAllUsersForProfessor).catch(() => setAllUsersForProfessor([]));
    }
  }, [showCreate, form.role, editUser]);

  const professorPapelId = papeisItems.find((p) => p.label.toLowerCase().includes('professor'))?.id || 'professor';
  const professores = allUsersForProfessor.filter((u) => u.role === 'admin' || u.papel === professorPapelId);

  const updateUser = async (uid, data) => {
    try {
      const updated = await apiPatch(`/users/${uid}`, data);
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, ...updated } : u)));
      toast.success('Atualizado');
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar');
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!form.displayName.trim() || !form.email.trim() || !form.password || form.password.length < 6) {
      toast.error('Preencha nome, e-mail e senha (mín. 6 caracteres).');
      return;
    }
    if (form.role === 'student') {
      const validSlots = (form.schedule || []).filter((s) => s.courtId && s.start && s.end);
      if (validSlots.length === 0) {
        toast.error('Para aluno, adicione ao menos um horário de aula (dia, horário e quadra).');
        return;
      }
      if (!form.planId) {
        toast.error('Para aluno, selecione o plano.');
        return;
      }
      if (!form.contractStart) {
        toast.error('Para aluno, informe a data de início do contrato.');
        return;
      }
      if (!form.paymentDueDay || form.paymentDueDay < 1 || form.paymentDueDay > 28) {
        toast.error('Para aluno, selecione o dia de vencimento da mensalidade (1 a 28).');
        return;
      }
    }
    setCreating(true);
    try {
      const payload = {
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        preferredSport: form.preferredSport || undefined,
        role: form.role,
        papel: form.papel || undefined,
      };
      if (form.role === 'student') {
        if (form.planId) payload.planId = form.planId;
        if (form.contractStart) {
          payload.contractStart = new Date(form.contractStart).toISOString();
          payload.contractEnd = form.contractEnd ? new Date(form.contractEnd).toISOString() : new Date(new Date(form.contractStart).getFullYear() + 1, new Date(form.contractStart).getMonth(), new Date(form.contractStart).getDate()).toISOString();
        }
        if (form.paymentDueDay) payload.paymentDueDay = Number(form.paymentDueDay);
        payload.schedule = (form.schedule || []).map((s) => ({
          dayOfWeek: s.dayOfWeek,
          start: s.start,
          end: s.end,
          courtId: s.courtId,
          ...(s.professorId ? { professorId: s.professorId } : {}),
        })).filter((s) => s.courtId && s.start && s.end);
      }
      await apiPost('/users', payload);
      toast.success('Usuário criado.');
      setForm({ displayName: '', email: '', password: '', phone: '', preferredSport: '', role: 'student', papel: '', planId: '', contractStart: '', contractEnd: '', paymentDueDay: 10, schedule: [defaultSlot()] });
      setShowCreate(false);
      const q = roleFilter ? `?role=${roleFilter}` : '';
      const list = await apiGet(`/users${q}`);
      setUsers(list);
    } catch (err) {
      toast.error(err.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const toDateStr = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    if (v?.toDate) return v.toDate().toISOString().slice(0, 10);
    return '';
  };

  const openEditUser = (u) => {
    setEditUser(u);
    const start = toDateStr(u.contractStart);
    let end = toDateStr(u.contractEnd);
    if (start && !end) {
      const d = new Date(start);
      d.setFullYear(d.getFullYear() + 1);
      end = d.toISOString().slice(0, 10);
    }
    const initialSchedule = Array.isArray(u.schedule) && u.schedule.length > 0 ? u.schedule.map((s) => ({ ...s })) : [defaultSlot()];
    const schedule = u.role === 'student' && u.planId ? resizeScheduleToPlan(u.planId, planos, initialSchedule) : initialSchedule;
    setEditForm({
      displayName: u.displayName || '',
      phone: u.phone || '',
      preferredSport: u.preferredSport || '',
      role: u.role || 'student',
      papel: u.papel || '',
      paymentStatus: u.paymentStatus || 'pending',
      planId: u.planId || '',
      contractStart: start,
      contractEnd: end,
      paymentDueDay: u.paymentDueDay ?? 10,
      schedule,
    });
  };

  const closeEditUser = () => {
    setEditUser(null);
    setEditForm(null);
  };

  const saveEditUser = async (e) => {
    e.preventDefault();
    if (!editUser || !editForm) return;
    if (!editForm.displayName?.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    if (editUser.role === 'student') {
      const validSlots = (editForm.schedule || []).filter((s) => s.courtId && s.start && s.end);
      if (validSlots.length === 0) {
        toast.error('Adicione ao menos um horário de aula.');
        return;
      }
      if (!editForm.planId) {
        toast.error('Selecione o plano.');
        return;
      }
      if (!editForm.contractStart) {
        toast.error('Informe a data de início do contrato.');
        return;
      }
    }
    setSavingEdit(true);
    try {
      const payload = {
        displayName: editForm.displayName.trim(),
        phone: editForm.phone?.trim() || undefined,
        preferredSport: editForm.preferredSport || undefined,
        role: editForm.role,
        papel: editForm.papel || undefined,
        paymentStatus: editForm.paymentStatus,
      };
      if (editUser.role === 'student') {
        payload.schedule = (editForm.schedule || []).map((s) => ({
          dayOfWeek: s.dayOfWeek,
          start: s.start,
          end: s.end,
          courtId: s.courtId,
          ...(s.professorId ? { professorId: s.professorId } : {}),
        })).filter((s) => s.courtId && s.start && s.end);
        payload.planId = editForm.planId;
        if (editForm.contractStart) {
          payload.contractStart = new Date(editForm.contractStart).toISOString();
          payload.contractEnd = editForm.contractEnd ? new Date(editForm.contractEnd).toISOString() : undefined;
        }
        if (editForm.paymentDueDay) payload.paymentDueDay = Number(editForm.paymentDueDay);
      }
      const updated = await apiPatch(`/users/${editUser.id}`, payload);
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...updated } : u)));
      toast.success('Usuário atualizado.');
      closeEditUser();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar');
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditSchedule = (u) => {
    setEditScheduleUser(u);
    setEditSchedule(Array.isArray(u.schedule) && u.schedule.length > 0 ? u.schedule.map((s) => ({ ...s })) : [defaultSlot()]);
  };

  const saveSchedule = async (e) => {
    e.preventDefault();
    const valid = editSchedule.filter((s) => s.courtId && s.start && s.end);
    setSavingSchedule(true);
    try {
      await apiPatch(`/users/${editScheduleUser.id}`, { schedule: valid });
      setUsers((prev) => prev.map((u) => (u.id === editScheduleUser.id ? { ...u, schedule: valid } : u)));
      setEditScheduleUser(null);
      toast.success('Horários atualizados.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSavingSchedule(false);
    }
  };

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Usuários</h1>
          <p className="text-gray-600">Alunos, instrutores e administradores.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((s) => !s)}
          className="px-4 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 text-sm font-medium"
        >
          {showCreate ? 'Cancelar' : 'Criar usuário'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 flex flex-col lg:flex-row gap-6">
          <form onSubmit={createUser} className="flex-1 p-6 bg-white rounded-xl border border-sand-200 space-y-4 max-w-md">
            <h2 className="font-semibold text-gray-800">Novo usuário</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha (mín. 6 caracteres) *</label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" minLength={6} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Esporte preferido</label>
              <select value={form.preferredSport} onChange={(e) => setForm((f) => ({ ...f, preferredSport: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">—</option>
                <option value="beach_tennis">Beach Tennis</option>
                <option value="futevolei">Futevôlei</option>
                <option value="volei_praia">Vôlei de Praia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel (função)</label>
              <select value={form.papel} onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">—</option>
                {papeisItems.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            {profile?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de usuário (permissões)</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="student">Aluno</option>
                  <option value="instructor">Instrutor</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Define o que a pessoa pode fazer no sistema. Só outro admin pode alterar.</p>
              </div>
            )}

            <button type="submit" disabled={creating} className="px-4 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 disabled:opacity-50">
              {creating ? 'Criando...' : 'Criar'}
            </button>
          </form>

          {form.role === 'student' && (
            <div className="lg:w-[380px] p-6 bg-white rounded-xl border-2 border-ocean-200 space-y-4 shrink-0">
              <h3 className="font-semibold text-gray-800 border-b border-sand-200 pb-2">Configurações do aluno</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plano *</label>
                <select
                  value={form.planId}
                  onChange={(e) => {
                    const planId = e.target.value;
                    setForm((f) => ({ ...f, planId, schedule: resizeScheduleToPlan(planId, planos, f.schedule) }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Selecione o plano</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} – {p.daysPerWeek} {p.daysPerWeek === 1 ? 'dia' : 'dias'}/sem – R$ {Number(p.price).toFixed(2).replace('.', ',')}</option>
                  ))}
                </select>
                {form.planId && (
                  <p className="text-xs text-gray-500 mt-1">
                    {scheduleLengthForPlan(form.planId, planos)} {scheduleLengthForPlan(form.planId, planos) === 1 ? 'linha' : 'linhas'} de horário (conforme dias do plano).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de início *</label>
                <input
                  type="date"
                  value={form.contractStart}
                  onChange={(e) => setContractStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de término</label>
                <input
                  type="date"
                  value={form.contractEnd}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-sand-50 text-gray-600"
                  title="Preenchido automaticamente (1 ano de validade)"
                />
                <p className="text-xs text-gray-500 mt-1">Preenchido automaticamente com 1 ano de validade.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dia de vencimento da mensalidade *</label>
                <select
                  value={form.paymentDueDay}
                  onChange={(e) => setForm((f) => ({ ...f, paymentDueDay: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>Dia {day}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">As mensalidades serão geradas automaticamente para 1 ano, com vencimento neste dia.</p>
              </div>
              <div className="border-t border-sand-200 pt-4">
                <h4 className="font-medium text-gray-800 mb-2">Horários de aula</h4>
                <p className="text-xs text-gray-500 mb-2">
                  {form.planId
                    ? `Uma linha por dia do plano (${scheduleLengthForPlan(form.planId, planos)} ${scheduleLengthForPlan(form.planId, planos) === 1 ? 'dia' : 'dias'}/sem). Dias, horários e quadra.`
                    : 'Selecione o plano para definir a quantidade de horários.'}
                </p>
                {(form.schedule || []).map((slot, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-sand-50 rounded-lg">
                    <select
                      value={slot.dayOfWeek}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        schedule: f.schedule.map((s, i) => (i === idx ? { ...s, dayOfWeek: Number(e.target.value) } : s)),
                      }))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    >
                      {DAY_LABELS.map((l, i) => (
                        <option key={i} value={i}>{l}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        schedule: f.schedule.map((s, i) => (i === idx ? { ...s, start: e.target.value } : s)),
                      }))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-gray-500">até</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        schedule: f.schedule.map((s, i) => (i === idx ? { ...s, end: e.target.value } : s)),
                      }))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <select
                      value={slot.courtId}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        schedule: f.schedule.map((s, i) => (i === idx ? { ...s, courtId: e.target.value } : s)),
                      }))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[100px]"
                    >
                      <option value="">Quadra</option>
                      {courts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={slot.professorId || ''}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        schedule: f.schedule.map((s, i) => (i === idx ? { ...s, professorId: e.target.value } : s)),
                      }))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[120px]"
                      title="Professor neste dia"
                    >
                      <option value="">Professor</option>
                      {professores.map((p) => (
                        <option key={p.id} value={p.id}>{p.displayName || p.email}</option>
                      ))}
                    </select>
                    {!form.planId && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, schedule: f.schedule.filter((_, i) => i !== idx) }))}
                        className="text-red-600 text-sm hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
                {!form.planId && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, schedule: [...(f.schedule || []), defaultSlot()] }))}
                    className="text-sm text-ocean-600 hover:underline mt-1"
                  >
                    + Adicionar horário
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {editUser && editForm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" onClick={() => !savingEdit && closeEditUser()}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Editar usuário – {editUser.displayName}</h2>
            <form onSubmit={saveEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input type="email" value={editUser.email || ''} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-sand-50 text-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Esporte preferido</label>
                <select
                  value={editForm.preferredSport}
                  onChange={(e) => setEditForm((f) => ({ ...f, preferredSport: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">—</option>
                  <option value="beach_tennis">Beach Tennis</option>
                  <option value="futevolei">Futevôlei</option>
                  <option value="volei_praia">Vôlei de Praia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Papel (função)</label>
                <select
                  value={editForm.papel || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, papel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">—</option>
                  {papeisItems.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de usuário (permissões)</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="student">Aluno</option>
                  <option value="instructor">Instrutor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pagamento</label>
                <select
                  value={editForm.paymentStatus}
                  onChange={(e) => setEditForm((f) => ({ ...f, paymentStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Em dia</option>
                  <option value="overdue">Inadimplente</option>
                </select>
              </div>
              {editUser.role === 'student' && (
                <div className="border-t border-sand-200 pt-4 space-y-4">
                  <h3 className="font-semibold text-gray-800">Configurações do aluno</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plano *</label>
                    <select
                      value={editForm.planId || ''}
                      onChange={(e) => {
                        const planId = e.target.value;
                        setEditForm((f) => ({ ...f, planId, schedule: resizeScheduleToPlan(planId, planos, f.schedule || []) }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Selecione o plano</option>
                      {planos.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} – {p.daysPerWeek} {p.daysPerWeek === 1 ? 'dia' : 'dias'}/sem – R$ {Number(p.price).toFixed(2).replace('.', ',')}</option>
                      ))}
                    </select>
                    {editForm.planId && (
                      <p className="text-xs text-gray-500 mt-1">
                        {scheduleLengthForPlan(editForm.planId, planos)} {scheduleLengthForPlan(editForm.planId, planos) === 1 ? 'linha' : 'linhas'} de horário (conforme dias do plano).
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data de início *</label>
                      <input
                        type="date"
                        value={editForm.contractStart || ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, contractStart: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data de término</label>
                      <input
                        type="date"
                        value={editForm.contractEnd || ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, contractEnd: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dia de vencimento da mensalidade</label>
                    <select
                      value={editForm.paymentDueDay ?? 10}
                      onChange={(e) => setEditForm((f) => ({ ...f, paymentDueDay: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>Dia {day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Horários de aula</h4>
                    <p className="text-xs text-gray-500 mb-2">
                      {editForm.planId
                        ? `Uma linha por dia do plano (${scheduleLengthForPlan(editForm.planId, planos)} ${scheduleLengthForPlan(editForm.planId, planos) === 1 ? 'dia' : 'dias'}/sem).`
                        : 'Selecione o plano para definir a quantidade de horários.'}
                    </p>
                    {(editForm.schedule || []).map((slot, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-sand-50 rounded-lg">
                        <select
                          value={slot.dayOfWeek}
                          onChange={(e) => setEditForm((f) => ({
                            ...f,
                            schedule: f.schedule.map((s, i) => (i === idx ? { ...s, dayOfWeek: Number(e.target.value) } : s)),
                          }))}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          {DAY_LABELS.map((l, i) => (
                            <option key={i} value={i}>{l}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => setEditForm((f) => ({
                            ...f,
                            schedule: f.schedule.map((s, i) => (i === idx ? { ...s, start: e.target.value } : s)),
                          }))}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-gray-500">até</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) => setEditForm((f) => ({
                            ...f,
                            schedule: f.schedule.map((s, i) => (i === idx ? { ...s, end: e.target.value } : s)),
                          }))}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                        />
                        <select
                          value={slot.courtId || ''}
                          onChange={(e) => setEditForm((f) => ({
                            ...f,
                            schedule: f.schedule.map((s, i) => (i === idx ? { ...s, courtId: e.target.value } : s)),
                          }))}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[100px]"
                        >
                          <option value="">Quadra</option>
                          {courts.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <select
                          value={slot.professorId || ''}
                          onChange={(e) => setEditForm((f) => ({
                            ...f,
                            schedule: f.schedule.map((s, i) => (i === idx ? { ...s, professorId: e.target.value } : s)),
                          }))}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[120px]"
                          title="Professor neste dia"
                        >
                          <option value="">Professor</option>
                          {professores.map((p) => (
                            <option key={p.id} value={p.id}>{p.displayName || p.email}</option>
                          ))}
                        </select>
                        {!editForm.planId && (
                          <button
                            type="button"
                            onClick={() => setEditForm((f) => ({ ...f, schedule: f.schedule.filter((_, i) => i !== idx) }))}
                            className="text-red-600 text-sm hover:underline"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    ))}
                    {!editForm.planId && (
                      <button
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, schedule: [...(f.schedule || []), defaultSlot()] }))}
                        className="text-sm text-ocean-600 hover:underline mt-1"
                      >
                        + Adicionar horário
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={closeEditUser} disabled={savingEdit} className="px-4 py-2 rounded-lg border border-gray-300">Cancelar</button>
                <button type="submit" disabled={savingEdit} className="px-4 py-2 rounded-lg bg-ocean-500 text-white disabled:opacity-50">{savingEdit ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editScheduleUser && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" onClick={() => !savingSchedule && setEditScheduleUser(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Horários de aula – {editScheduleUser.displayName}</h2>
            <p className="text-sm text-gray-500 mb-4">Esses horários aparecem na Agenda. A quadra fica ocupada nesses dias/horários.</p>
            <form onSubmit={saveSchedule}>
              {editSchedule.map((slot, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-sand-50 rounded-lg">
                  <select
                    value={slot.dayOfWeek}
                    onChange={(e) => setEditSchedule((s) => s.map((x, i) => (i === idx ? { ...x, dayOfWeek: Number(e.target.value) } : x)))}
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    {DAY_LABELS.map((l, i) => (
                      <option key={i} value={i}>{l}</option>
                    ))}
                  </select>
                  <input type="time" value={slot.start} onChange={(e) => setEditSchedule((s) => s.map((x, i) => (i === idx ? { ...x, start: e.target.value } : x)))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  <span className="text-gray-500">até</span>
                  <input type="time" value={slot.end} onChange={(e) => setEditSchedule((s) => s.map((x, i) => (i === idx ? { ...x, end: e.target.value } : x)))} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  <select
                    value={slot.courtId}
                    onChange={(e) => setEditSchedule((s) => s.map((x, i) => (i === idx ? { ...x, courtId: e.target.value } : x)))}
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[120px]"
                  >
                    <option value="">Quadra</option>
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setEditSchedule((s) => s.filter((_, i) => i !== idx))} className="text-red-600 text-sm hover:underline">Remover</button>
                </div>
              ))}
              <button type="button" onClick={() => setEditSchedule((s) => [...s, defaultSlot()])} className="text-sm text-ocean-600 hover:underline mb-4">+ Adicionar horário</button>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditScheduleUser(null)} disabled={savingSchedule} className="px-4 py-2 rounded-lg border border-gray-300">Cancelar</button>
                <button type="submit" disabled={savingSchedule} className="px-4 py-2 rounded-lg bg-ocean-500 text-white disabled:opacity-50">{savingSchedule ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Todos os tipos</option>
          <option value="student">Tipo: Aluno</option>
          <option value="instructor">Tipo: Instrutor</option>
          <option value="admin">Tipo: Admin</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-sand-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand-100">
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Telefone</th>
                <th className="text-left p-3">Esporte</th>
                <th className="text-left p-3">Tipo de usuário</th>
                <th className="text-left p-3">Papel (função)</th>
                <th className="text-left p-3">Horários (aluno)</th>
                <th className="text-left p-3">Pagamento</th>
                {profile?.role === 'admin' && <th className="text-left p-3">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.displayName}{u.id === currentUid && <span className="ml-1 text-xs text-ocean-600">(você)</span>}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.phone || '-'}</td>
                  <td className="p-3">{sportLabels[u.preferredSport] || u.preferredSport || '-'}</td>
                  <td className="p-3">
                    {u.id === currentUid ? (
                      <span className="text-gray-500" title="Tipo só pode ser alterado por outro admin">{tipoLabels[u.role]}</span>
                    ) : profile?.role === 'admin' ? (
                      <select
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                        className="border rounded px-2 py-1"
                      >
                        <option value="student">Aluno</option>
                        <option value="instructor">Instrutor</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      tipoLabels[u.role]
                    )}
                  </td>
                  <td className="p-3">
                    {u.id === currentUid ? (
                      <span className="text-gray-500">{papelLabels[u.papel] || u.papel || '-'}</span>
                    ) : (profile?.role === 'admin' || profile?.role === 'instructor') ? (
                      <select
                        value={u.papel || ''}
                        onChange={(e) => updateUser(u.id, { papel: e.target.value || null })}
                        className="border rounded px-2 py-1"
                      >
                        <option value="">—</option>
                        {papeisItems.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    ) : (
                      (papelLabels[u.papel] || u.papel || '-')
                    )}
                  </td>
                  <td className="p-3">
                    {u.role === 'student' && (profile?.role === 'admin' || profile?.role === 'instructor') ? (
                      <button
                        type="button"
                        onClick={() => openEditSchedule(u)}
                        className="text-ocean-600 hover:underline text-sm"
                      >
                        {(Array.isArray(u.schedule) && u.schedule.length) ? `${u.schedule.length} horário(s)` : 'Definir horários'}
                      </button>
                    ) : u.role === 'student' && Array.isArray(u.schedule) && u.schedule.length > 0 ? (
                      <span className="text-gray-600">{u.schedule.length} horário(s)</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3">
                    {u.id === currentUid ? (
                      <span className="text-gray-500">{u.paymentStatus || '-'}</span>
                    ) : profile?.role === 'admin' ? (
                      <select
                        value={u.paymentStatus}
                        onChange={(e) => updateUser(u.id, { paymentStatus: e.target.value })}
                        className="border rounded px-2 py-1"
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Em dia</option>
                        <option value="overdue">Inadimplente</option>
                      </select>
                    ) : (
                      (u.paymentStatus || '-')
                    )}
                  </td>
                  {profile?.role === 'admin' && (
                    <td className="p-3">
                      {u.id !== currentUid ? (
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="text-ocean-600 hover:underline text-sm font-medium"
                        >
                          Editar
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
