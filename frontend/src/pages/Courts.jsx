import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPut } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLS = 4;
const ROWS = 3;
const TOTAL_SLOTS = ROWS * COLS;

function slotToRowCol(slot) {
  const index = slot - 1;
  return { row: Math.floor(index / COLS), col: index % COLS };
}
function rowColToSlot(row, col) {
  return row * COLS + col + 1;
}
function getCourtSlot(court) {
  const pos = court.position;
  if (typeof pos === 'number') return slotToRowCol(pos);
  if (pos && typeof pos.row === 'number' && typeof pos.col === 'number') return { row: pos.row, col: pos.col };
  return null;
}
function getCourtPositionNumber(court, row, col) {
  if (typeof court.position === 'number') return court.position;
  return rowColToSlot(row, col);
}
const statusColors = {
  disponivel: 'bg-green-500',
  alugada: 'bg-amber-500',
  em_aula: 'bg-teal-500',
  manutencao: 'bg-red-500',
};
const statusLabels = { disponivel: 'Disponível', alugada: 'Alugada', em_aula: 'Em aula', manutencao: 'Manutenção' };

// Desenho de quadra de vôlei (retângulo + rede no meio) para caber no card
function VolleyballCourtSvg({ className = 'w-full h-full' }) {
  return (
    <svg viewBox="0 0 100 50" className={className} preserveAspectRatio="xMidYMid meet">
      <rect x="2" y="2" width="96" height="46" rx="2" fill="#e8dcc8" stroke="#c4a574" strokeWidth="1.5" />
      <line x1="50" y1="2" x2="50" y2="48" stroke="#8b7355" strokeWidth="2" strokeDasharray="4 2" />
      <circle cx="50" cy="25" r="3" fill="#8b7355" />
    </svg>
  );
}

function CourtMarkers({ courts, onSelect }) {
  if (!courts?.length) return null;
  return (
    <div className="absolute bottom-4 left-4 right-4 z-[1000] flex flex-wrap gap-2 justify-center">
      {courts.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c)}
          className={`px-4 py-2 rounded-lg text-white text-sm font-medium shadow ${statusColors[c.status] || 'bg-gray-500'}`}
        >
          {c.name} – {statusLabels[c.status] || c.status}
        </button>
      ))}
    </div>
  );
}

export default function Courts() {
  const { isAdmin } = useAuth();
  const [courts, setCourts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', position: 1, sport: 'multiuso' });
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const fetchCourts = () => {
    return apiGet('/quadras').then(setCourts).catch(() => toast.error('Erro ao carregar quadras'));
  };

  useEffect(() => {
    fetchCourts().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchCourts(), 30000);
    return () => clearInterval(interval);
  }, []);

  const gridMap = useMemo(() => {
    const map = {};
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) map[`${r}-${c}`] = null;
    const withoutPosition = [];
    courts.forEach((court) => {
      const slot = getCourtSlot(court);
      if (slot && slot.row >= 0 && slot.row < ROWS && slot.col >= 0 && slot.col < COLS) {
        const key = `${slot.row}-${slot.col}`;
        if (key in map) map[key] = court;
      } else {
        withoutPosition.push(court);
      }
    });
    let slot = 0;
    withoutPosition.forEach((court) => {
      while (slot < TOTAL_SLOTS) {
        const r = Math.floor(slot / COLS);
        const c = slot % COLS;
        const key = `${r}-${c}`;
        if (!map[key]) {
          map[key] = court;
          break;
        }
        slot++;
      }
    });
    return map;
  }, [courts]);

  const handleAddCourt = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      toast.error('Informe o nome da quadra');
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/quadras', {
        name: addForm.name.trim(),
        position: addForm.position,
        sport: addForm.sport,
      });
      toast.success('Quadra criada');
      setShowAddModal(false);
      setAddForm({ name: '', position: 1, sport: 'multiuso' });
      const list = await apiGet('/quadras');
      setCourts(list);
    } catch (err) {
      toast.error(err.message || 'Erro ao criar quadra');
    } finally {
      setSubmitting(false);
    }
  };

  const openAddAtPosition = (row, col) => {
    setAddForm((f) => ({ ...f, position: rowColToSlot(row, col) }));
    setShowAddModal(true);
  };

  const openEditCourt = (court, e) => {
    e?.stopPropagation?.();
    const slot = getCourtSlot(court);
    const position = typeof court.position === 'number' ? court.position : (slot ? rowColToSlot(slot.row, slot.col) : 1);
    setEditForm({
      id: court.id,
      name: court.name,
      position,
      sport: court.sport || 'multiuso',
    });
    setShowEditModal(true);
  };

  const handleEditCourt = async (e) => {
    e.preventDefault();
    if (!editForm?.name?.trim()) {
      toast.error('Informe o nome da quadra');
      return;
    }
    setSubmittingEdit(true);
    try {
      await apiPut(`/quadras/${editForm.id}`, {
        name: editForm.name.trim(),
        position: editForm.position,
        sport: editForm.sport,
      });
      toast.success('Quadra atualizada');
      setShowEditModal(false);
      setEditForm(null);
      const list = await apiGet('/quadras');
      setCourts(list);
      if (selected?.id === editForm.id) setSelected(list.find((c) => c.id === editForm.id) || null);
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar quadra');
    } finally {
      setSubmittingEdit(false);
    }
  };

  if (loading) return <div className="p-4">Carregando quadras...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mapa de Quadras</h1>
          <p className="text-gray-600">Status em tempo real. Clique em uma quadra para ver detalhes.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-ocean-500 text-white font-medium hover:bg-ocean-600"
          >
            Adicionar quadra
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-sand-200 overflow-hidden min-h-[400px] relative">
        <div
          className="grid gap-2 sm:gap-3 p-3 sm:p-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            const court = gridMap[`${row}-${col}`];
            const isEmpty = !court;
            return (
              <div
                key={`${row}-${col}`}
                className={`rounded-xl border-2 min-h-[120px] sm:min-h-[140px] flex flex-col overflow-hidden transition ${
                  selected?.id === court?.id ? 'border-ocean-500 bg-ocean-50' : 'border-sand-200 hover:border-ocean-300'
                } ${isEmpty && isAdmin ? 'cursor-pointer' : court ? 'cursor-pointer' : ''}`}
                onClick={() => (court ? setSelected(court) : isAdmin ? openAddAtPosition(row, col) : null)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (court) setSelected(court);
                  else if (isAdmin) openAddAtPosition(row, col);
                }}
                role="button"
                tabIndex={0}
              >
                {court ? (
                  <>
                    <div className="flex-1 min-h-0 p-2 flex items-center justify-center bg-sand-50">
                      <VolleyballCourtSvg className="w-full max-h-20" />
                    </div>
                    <div className="p-2 border-t border-sand-200 bg-white min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className={`inline-block w-2 h-2 rounded-full align-middle ${statusColors[court.status] || 'bg-gray-400'}`} />
                          <span className="font-medium text-sm text-gray-800 ml-1">
                            <span className="text-ocean-600 font-semibold">{getCourtPositionNumber(court, row, col)}</span>
                            <span className="mx-1">–</span>
                            <span className="break-words">{court.name}</span>
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">{statusLabels[court.status] || court.status}</p>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => openEditCourt(court, e)}
                            className="shrink-0 text-ocean-600 hover:text-ocean-700 text-xs font-medium py-1 px-2 rounded hover:bg-ocean-50"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-4 text-gray-400">
                    {isAdmin ? (
                      <span className="text-sm">Clique para adicionar quadra (pos. {rowColToSlot(row, col)})</span>
                    ) : (
                      <span className="text-sm">Vazio</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {courts.length > 0 && <CourtMarkers courts={courts} onSelect={setSelected} />}
      </div>

      {showEditModal && editForm && isAdmin && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" onClick={() => !submittingEdit && setShowEditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Editar quadra</h2>
            <form onSubmit={handleEditCourt}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da quadra</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-sand-300 rounded-lg px-3 py-2 mb-3"
                placeholder="Ex: Quadra 1"
              />
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Posição no mapa</label>
                <select
                  value={editForm.position}
                  onChange={(e) => setEditForm((f) => ({ ...f, position: Number(e.target.value) }))}
                  className="w-full border border-sand-300 rounded-lg px-3 py-2"
                >
                  {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                    <option key={i} value={i + 1}>Quadra {i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowEditModal(false)} disabled={submittingEdit} className="px-4 py-2 rounded-lg border border-sand-300 text-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={submittingEdit} className="px-4 py-2 rounded-lg bg-ocean-500 text-white font-medium disabled:opacity-50">
                  {submittingEdit ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && isAdmin && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nova quadra</h2>
            <form onSubmit={handleAddCourt}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da quadra</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-sand-300 rounded-lg px-3 py-2 mb-3"
                placeholder="Ex: Quadra 1"
              />
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Posição no mapa</label>
                <select
                  value={addForm.position}
                  onChange={(e) => setAddForm((f) => ({ ...f, position: Number(e.target.value) }))}
                  className="w-full border border-sand-300 rounded-lg px-3 py-2"
                >
                  {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                    <option key={i} value={i + 1}>Quadra {i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} disabled={submitting} className="px-4 py-2 rounded-lg border border-sand-300 text-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-ocean-500 text-white font-medium disabled:opacity-50">
                  {submitting ? 'Criando...' : 'Criar quadra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-6 bg-white rounded-xl border border-sand-200 p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800">
            <span className="text-ocean-600 font-semibold">
              {typeof selected.position === 'number' ? selected.position : (selected.position?.row != null ? rowColToSlot(selected.position.row, selected.position.col) : '–')}
            </span>
            <span className="mx-2">–</span>
            <span className="break-words">{selected.name}</span>
          </h2>
          <p className="text-gray-600 mt-1">Status atual: {statusLabels[selected.status] || selected.status}</p>
          {selected.currentRental && selected.currentRental.type === 'student_class' && (
            <p className="text-sm text-gray-500 mt-1">Aula em andamento (horários de alunos).</p>
          )}
          {selected.currentRental && selected.currentRental.type !== 'student_class' && selected.status === 'alugada' && (
            <p className="text-sm text-gray-500 mt-1">Aluguel em andamento (agendado na Agenda).</p>
          )}
        </div>
      )}
    </div>
  );
}
