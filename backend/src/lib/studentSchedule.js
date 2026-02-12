/**
 * Helpers para horários de aula de alunos (schedule em users com role student).
 * Formato: { dayOfWeek: 0-6 (0=Dom), start: "HH:mm", end: "HH:mm", courtId: string }
 */

function timeToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.trim().split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function timesOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && e1 > s2;
}

function dateToTimeStr(d) {
  const date = d instanceof Date ? d : new Date(d);
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Verifica se um horário (courtId, start Date, end Date) conflita com algum slot de alunos */
function rentalConflictsWithStudentSchedule(rentalCourtId, rentalStart, rentalEnd, studentsWithSchedule) {
  const day = rentalStart.getDay();
  const startStr = dateToTimeStr(rentalStart);
  const endStr = dateToTimeStr(rentalEnd);

  for (const user of studentsWithSchedule) {
    const schedule = user.schedule;
    if (!Array.isArray(schedule)) continue;
    for (const slot of schedule) {
      if (slot.courtId !== rentalCourtId) continue;
      if (slot.dayOfWeek !== day) continue;
      if (timesOverlap(startStr, endStr, slot.start || '', slot.end || '')) {
        return true;
      }
    }
  }
  return false;
}

/** Verifica se neste momento (date) a quadra courtId está em horário de aula de algum aluno */
function isCourtInStudentClassNow(courtId, now, studentsWithSchedule) {
  const day = now.getDay();
  const timeStr = dateToTimeStr(now);

  for (const user of studentsWithSchedule) {
    const schedule = user.schedule;
    if (!Array.isArray(schedule)) continue;
    for (const slot of schedule) {
      if (slot.courtId !== courtId) continue;
      if (slot.dayOfWeek !== day) continue;
      const slotStart = (slot.start || '').trim();
      const slotEnd = (slot.end || '').trim();
      if (!slotStart || !slotEnd) continue;
      const t = timeToMinutes(timeStr);
      const s = timeToMinutes(slotStart);
      const e = timeToMinutes(slotEnd);
      if (t >= s && t < e) return true;
    }
  }
  return false;
}

/** Gera eventos de aula de alunos para um intervalo [from, to] */
function expandStudentSchedulesToEvents(studentsWithSchedule, from, to) {
  const events = [];
  const fromDate = from instanceof Date ? from : new Date(from);
  const toDate = to instanceof Date ? to : new Date(to);

  for (const user of studentsWithSchedule) {
    const schedule = user.schedule;
    if (!Array.isArray(schedule)) continue;
    const name = user.displayName || user.email || user.id;

    for (const slot of schedule) {
      if (!slot.courtId || slot.dayOfWeek == null) continue;
      const startMin = timeToMinutes(slot.start || '00:00');
      const endMin = timeToMinutes(slot.end || '00:00');
      if (endMin <= startMin) continue;

      let d = new Date(fromDate);
      d.setHours(0, 0, 0, 0);
      while (d <= toDate) {
        if (d.getDay() === slot.dayOfWeek) {
          const start = new Date(d);
          start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
          const end = new Date(d);
          end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
          if (end <= fromDate || start >= toDate) {
            d.setDate(d.getDate() + 1);
            continue;
          }
          events.push({
            id: `student-${user.id}-${slot.dayOfWeek}-${slot.start}-${slot.end}-${start.getTime()}`,
            type: 'student_class',
            title: `Aula – ${name}`,
            start,
            end,
            courtId: slot.courtId,
            userId: user.id,
            displayName: name,
          });
        }
        d.setDate(d.getDate() + 1);
      }
    }
  }
  return events;
}

/**
 * Agrupa horários de alunos por (professorId, courtId, dayOfWeek, start, end) e gera eventos
 * para a agenda com título "Professor X: HH:mm - HH:mm", para clicar e ver quadra e alunos.
 * usersById: { [uid]: { displayName, ... } }, courtsById: { [courtId]: { name } }
 */
function expandProfessorSlotsToEvents(studentsWithSchedule, from, to, usersById, courtsById) {
  const fromDate = from instanceof Date ? from : new Date(from);
  const toDate = to instanceof Date ? to : new Date(to);
  const key = (p, c, d, s, e) => `${p || ''}|${c}|${d}|${s}|${e}`;
  const groups = new Map();

  for (const user of studentsWithSchedule) {
    const schedule = user.schedule;
    if (!Array.isArray(schedule)) continue;
    const studentInfo = { id: user.id, displayName: user.displayName || user.email || user.id };

    for (const slot of schedule) {
      if (!slot.courtId || slot.dayOfWeek == null) continue;
      const startMin = timeToMinutes(slot.start || '00:00');
      const endMin = timeToMinutes(slot.end || '00:00');
      if (endMin <= startMin) continue;

      const k = key(slot.professorId, slot.courtId, slot.dayOfWeek, slot.start, slot.end);
      if (!groups.has(k)) {
        groups.set(k, {
          professorId: slot.professorId || null,
          courtId: slot.courtId,
          dayOfWeek: slot.dayOfWeek,
          start: slot.start || '08:00',
          end: slot.end || '09:00',
          startMin,
          endMin,
          students: [],
        });
      }
      const g = groups.get(k);
      if (!g.students.some((s) => s.id === user.id)) {
        g.students.push(studentInfo);
      }
    }
  }

  const events = [];
  for (const g of groups.values()) {
    if (g.students.length === 0) continue;
    const professorName = (g.professorId && usersById[g.professorId]?.displayName) || usersById[g.professorId]?.email || 'Professor';
    const courtName = (courtsById[g.courtId] && courtsById[g.courtId].name) || 'Quadra';
    const title = `${professorName}: ${g.start} - ${g.end}`;

    let d = new Date(fromDate);
    d.setHours(0, 0, 0, 0);
    while (d <= toDate) {
      if (d.getDay() === g.dayOfWeek) {
        const start = new Date(d);
        start.setHours(Math.floor(g.startMin / 60), g.startMin % 60, 0, 0);
        const end = new Date(d);
        end.setHours(Math.floor(g.endMin / 60), g.endMin % 60, 0, 0);
        if (end > fromDate && start < toDate) {
          events.push({
            id: `prof-${g.professorId || 'sem'}-${g.courtId}-${g.dayOfWeek}-${g.start}-${g.end}-${start.getTime()}`,
            type: 'professor_class',
            title,
            start,
            end,
            professorId: g.professorId,
            professorName,
            courtId: g.courtId,
            courtName,
            students: g.students,
          });
        }
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return events;
}

export {
  timeToMinutes,
  timesOverlap,
  dateToTimeStr,
  rentalConflictsWithStudentSchedule,
  isCourtInStudentClassNow,
  expandStudentSchedulesToEvents,
  expandProfessorSlotsToEvents,
};
