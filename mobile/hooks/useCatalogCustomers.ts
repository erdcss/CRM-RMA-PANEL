import { useCallback, useEffect, useState } from 'react';

import { rmaApi, type CatalogCustomer } from '@/lib/api';

export function useCatalogCustomers(query = '') {
  const [customers, setCustomers] = useState<CatalogCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await rmaApi.listCatalogCustomers(query.trim() || undefined);
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cari listesi alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { customers, loading, refreshing, error, refresh };
}
