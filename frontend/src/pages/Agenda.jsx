import { useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '../services/api';
import { useAuth } from '../context/AuthContext';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});

function toDate(v) {
  if (!v) return new Date();
  if (typeof v.toDate === 'function') return v.toDate();
  if (v.seconds != null) return new Date(v.seconds * 1000);
  return new Date(v);
}

export default function Agenda() {
  const { isAdmin, isInstructor } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSport, setFilterSport] = useState('');
  const [filterCourt, setFilterCourt] = useState('');
  const [courts, setCourts] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAluguelModal, setShowAluguelModal] = useState(false);
  const [aluguelForm, setAluguelForm] = useState({
    courtId: '',
    userId: '',
    start: '',
    end: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedProfessorEvent, setSelectedProfessorEvent] = useState(null);

  const canManageAluguel = isAdmin || isInstructor;

  useEffect(() => {
    apiGet('/quadras').then(setCourts).catch(() => []);
    if (canManageAluguel) apiGet('/users').then((r) => setUsers(r.users || r || [])).catch(() => []);
  }, [canManageAluguel]);

  const loadEvents = () => {
    const from = new Date();
    from.setMonth(from.getMonth() - 1);
    const to = new Date();
    to.setMonth(to.getMonth() + 2);
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    setLoading(true);
    const paramsAulas = new URLSearchParams();
    paramsAulas.set('from', fromStr);
    paramsAulas.set('to', toStr);
    if (filterSport) paramsAulas.set('sport', filterSport);
    if (filterCourt) paramsAulas.set('courtId', filterCourt);

    const paramsReservas = new URLSearchParams();
    paramsReservas.set('from', fromStr);
    paramsReservas.set('to', toStr);
    if (filterCourt) paramsReservas.set('courtId', filterCourt);

    const paramsProfessor = new URLSearchParams();
    paramsProfessor.set('from', fromStr);
    paramsProfessor.set('to', toStr);
    if (filterCourt) paramsProfessor.set('courtId', filterCourt);

    Promise.all([
      apiGet(`/aulas?${paramsAulas}`).catch(() => []),
      apiGet(`/reservas?${paramsReservas}`).catch(() => []),
      apiGet(`/agenda/professor-classes?${paramsProfessor}`).catch(() => []),
    ])
      .then(([classes, reservas, professorClasses]) => {
        const courtNames = Object.fromEntries(courts.map((c) => [c.id, c.name]));
        const aulaEvents = (classes || []).map((c) => ({
          id: `aula-${c.id}`,
          title: c.title || 'Aula',
          start: toDate(c.start),
          end: toDate(c.end),
          resource: { type: 'aula', ...c },
        }));
        const reservaEvents = (reservas || []).map((b) => ({
          id: `reserva-${b.id}`,
          title: `Aluguel – ${courtNames[b.courtId] || 'Quadra'}`,
          start: toDate(b.start),
          end: toDate(b.end),
          resource: { type: 'reserva', ...b },
        }));
        const professorEvents = (professorClasses || []).map((e) => ({
          id: e.id,
          title: e.title,
          start: toDate(e.start),
          end: toDate(e.end),
          resource: {
            type: 'professor_class',
            professorName: e.professorName,
            courtId: e.courtId,
            courtName: e.courtName,
            students: e.students || [],
          },
        }));
        setEvents([...aulaEvents, ...reservaEvents, ...professorEvents]);
      })
      .catch(() => toast.error('Erro ao carregar agenda'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, [filterSport, filterCourt, courts.length]);

  const handleCreateAluguel = async (e) => {
    e.preventDefault();
    if (!aluguelForm.courtId || !aluguelForm.userId || !aluguelForm.start || !aluguelForm.end) {
      toast.error('Preencha quadra, usuário, início e fim.');
      return;
    }
    const start = new Date(aluguelForm.start);
    const end = new Date(aluguelForm.end);
    if (end <= start) {
      toast.error('O fim deve ser após o início.');
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/reservas', {
        courtId: aluguelForm.courtId,
        userId: aluguelForm.userId,
        start: start.toISOString(),
        end: end.toISOString(),
        description: aluguelForm.description || null,
      });
      toast.success('Aluguel agendado. A quadra aparecerá como "Alugada" no mapa no horário do aluguel.');
      setShowAluguelModal(false);
      setAluguelForm({ courtId: '', userId: '', start: '', end: '', description: '' });
      loadEvents();
    } catch (err) {
      toast.error(err.message || 'Erro ao agendar aluguel');
    } finally {
      setSubmitting(false);
    }
  };

  const eventStyleGetter = (event) => {
    const type = event.resource?.type;
    const color = type === 'reserva' ? '#d97706' : type === 'professor_class' ? '#0d9488' : type === 'student_class' ? '#059669' : '#0d9488';
    return {
      style: {
        backgroundColor: color,
        borderRadius: 4,
        cursor: type === 'professor_class' ? 'pointer' : undefined,
        textDecoration: type === 'professor_class' ? 'underline' : undefined,
      },
    };
  };

  const handleSelectEvent = (event) => {
    if (event.resource?.type === 'professor_class') {
      setSelectedProfessorEvent({
        ...event.resource,
        start: event.start,
        end: event.end,
      });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Agenda</h1>
          <p className="text-gray-600">Aulas, aluguéis e eventos. Aluguéis agendados aqui aparecem como &quot;Alugada&quot; no mapa de quadras no dia/horário.</p>
        </div>
        {canManageAluguel && (
          <button
            type="button"
            onClick={() => setShowAluguelModal(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600"
          >
            Novo aluguel
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <select
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Todos os esportes</option>
          <option value="beach_tennis">Beach Tennis</option>
          <option value="futevolei">Futevôlei</option>
          <option value="volei_praia">Vôlei de Praia</option>
        </select>
        <select
          value={filterCourt}
          onChange={(e) => setFilterCourt(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Todas as quadras</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-sand-200 p-4 min-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">Carregando...</div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 500 }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={handleSelectEvent}
            messages={{
              next: 'Próximo',
              previous: 'Anterior',
              today: 'Hoje',
              month: 'Mês',
              week: 'Semana',
              day: 'Dia',
              agenda: 'Agenda',
              date: 'Data',
              time: 'Hora',
              event: 'Evento',
              noEventsInRange: 'Nenhum evento no período.',
            }}
          />
        )}
      </div>

      {selectedProfessorEvent && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedProfessorEvent(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">{selectedProfessorEvent.professorName}</h2>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Quadra:</span> {selectedProfessorEvent.courtName}
            </p>
            {selectedProfessorEvent.start && selectedProfessorEvent.end && (
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-medium">Horário:</span>{' '}
                {format(new Date(selectedProfessorEvent.start), 'HH:mm')} – {format(new Date(selectedProfessorEvent.end), 'HH:mm')}
                {' · '}
                {format(new Date(selectedProfessorEvent.start), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            )}
            <h3 className="font-semibold text-gray-800 mb-2">Alunos neste horário</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              {(selectedProfessorEvent.students || []).map((s) => (
                <li key={s.id}>{s.displayName || s.id}</li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProfessorEvent(null)}
                className="px-4 py-2 rounded-lg bg-ocean-500 text-white font-medium hover:bg-ocean-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAluguelModal && canManageAluguel && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setShowAluguelModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Agendar aluguel</h2>
            <form onSubmit={handleCreateAluguel}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quadra</label>
              <select
                value={aluguelForm.courtId}
                onChange={(e) => setAluguelForm((f) => ({ ...f, courtId: e.target.value }))}
                className="w-full border border-sand-300 rounded-lg px-3 py-2 mb-3"
                required
              >
                <option value="">Selecione</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente / Usuário</label>
              <select
                value={aluguelForm.userId}
                onChange={(e) => setAluguelForm((f) => ({ ...f, userId: e.target.value }))}
                className="w-full border border-sand-300 rounded-lg px-3 py-2 mb-3"
                required
              >
                <option value="">Selecione</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName || u.email || u.id}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
              <input
                type="datetime-local"
                value={aluguelForm.start}
                onChange={(e) => setAluguelForm((f) => ({ ...f, start: e.target.value }))}
                className="w-full border border-sand-300 rounded-lg px-3 py-2 mb-3"
                required
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
              <input
                type="datetime-local"
                value={aluguelForm.end}
                onChange={(e) => setAluguelForm((f) => ({ ...f, end: e.target.value }))}
                className="w-full border border-sand-300 rounded-lg px-3 py-2 mb-3"
                required
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
              <input
                type="text"
                value={aluguelForm.description}
                onChange={(e) => setAluguelForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-sand-300 rounded-lg px-3 py-2 mb-4"
                placeholder="Ex: Torneio"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAluguelModal(false)} disabled={submitting} className="px-4 py-2 rounded-lg border border-sand-300 text-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium disabled:opacity-50">
                  {submitting ? 'Agendando...' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
