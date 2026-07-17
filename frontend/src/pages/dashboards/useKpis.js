import { useEffect, useState } from 'react';
import api from '../../api/axios';

export function useKpiOverview(blockId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/kpis/overview', { params: blockId ? { blockId } : {} })
      .then((res) => setData(res.data))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [blockId]);

  return { data, loading, error };
}

export function usePhysicianKpis(physicianId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!physicianId) return;
    api.get(`/kpis/physician/${physicianId}`).then((res) => setData(res.data));
  }, [physicianId]);
  return data;
}
