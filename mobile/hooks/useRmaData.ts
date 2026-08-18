import { useCallback, useEffect, useState } from 'react';

import { rmaApi, type DashboardStats, type RmaCustomer, type RmaTicket, type CatalogProduct } from '@/lib/api';
import { countCompletedProducts, countOpenProducts } from '@/lib/format';

export function useTickets() {
  const [tickets, setTickets] = useState<RmaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await rmaApi.listTickets();
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıtlar alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { tickets, loading, refreshing, error, reload: () => load(true), refresh: () => load(true) };
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<RmaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [statsData, ticketsData] = await Promise.all([
        rmaApi.getDashboardStats(),
        rmaApi.listTickets(),
      ]);
      setStats(statsData);
      setTickets(ticketsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard verileri alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = {
    openRecords: countOpenProducts(tickets),
    inService: stats?.inService ?? 0,
    exchangePending: stats?.activeExchanges ?? 0,
    completed: countCompletedProducts(tickets),
  };

  return {
    stats,
    tickets,
    kpis,
    loading,
    refreshing,
    error,
    refresh: () => load(true),
  };
}

export function useCustomers() {
  const [customers, setCustomers] = useState<RmaCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await rmaApi.listCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Müşteriler alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { customers, loading, refreshing, error, refresh: () => load(true) };
}

export function useCatalogProducts(query = '') {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await rmaApi.listCatalogProducts(query.trim() || undefined);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ürünler alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  return { products, loading, refreshing, error, refresh: () => load(true) };
}

export function useTicket(id: number) {
  const [ticket, setTicket] = useState<RmaTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return;
    try {
      setLoading(true);
      setError(null);
      const data = await rmaApi.getTicket(id);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ticket, loading, error, reload: load, setTicket };
}

export function useCustomerDetail(customerId: number) {
  const [customer, setCustomer] = useState<RmaCustomer | null>(null);
  const [tickets, setTickets] = useState<RmaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(customerId)) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [customerData, allTickets] = await Promise.all([
          rmaApi.getCustomer(customerId),
          rmaApi.listTickets(),
        ]);
        if (!active) return;
        setCustomer(customerData);
        setTickets(allTickets.filter((ticket) => ticket.customer.id === customerId));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Müşteri bilgisi alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [customerId]);

  const openCount = tickets.filter((ticket) =>
    ticket.products.some((p) => !['teslim_edildi', 'iptal'].includes(p.status)),
  ).length;
  const completedCount = tickets.filter((ticket) =>
    ticket.products.every((p) => p.status === 'teslim_edildi' || p.status === 'iptal'),
  ).length;

  return { customer, tickets, loading, error, openCount, completedCount };
}
