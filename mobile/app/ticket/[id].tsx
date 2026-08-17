import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { rmaApi, type RmaTicket } from '@/lib/api';
import { TicketDetail } from './detail';

export default function TicketRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<RmaTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) return;
    rmaApi.getTicket(ticketId).then(setTicket).catch((e) => setError(e instanceof Error ? e.message : 'Kayıt alınamadı.'));
  }, [id]);

  if (error) return <View style={{ padding: 20 }}><Text>{error}</Text></View>;
  if (!ticket) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <TicketDetail ticket={ticket} />;
}
