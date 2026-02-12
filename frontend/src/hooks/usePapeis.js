import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';

const defaultItems = [
  { id: 'professor', label: 'Professor' },
  { id: 'aluno', label: 'Aluno' },
  { id: 'gerente', label: 'Gerente' },
  { id: 'recepcionista', label: 'Recepcionista' },
  { id: 'outro', label: 'Outro' },
];

export function usePapeis() {
  const [items, setItems] = useState(defaultItems);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/settings/papeis')
      .then((data) => setItems(data.items?.length ? data.items : defaultItems))
      .catch(() => setItems(defaultItems))
      .finally(() => setLoading(false));
  }, []);

  const labelMap = items.reduce((acc, p) => ({ ...acc, [p.id]: p.label }), {});
  return { items, loading, labelMap };
}
