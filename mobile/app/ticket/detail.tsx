import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RmaTicket } from '@/lib/api';
import { shareTicketPdf } from '@/lib/pdf';

export function TicketDetail({ ticket }: { ticket: RmaTicket }) {
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    setSharing(true);
    try {
      await shareTicketPdf(ticket);
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{ticket.receiptNumber || `RMA-${ticket.id}`}</Text>
      <Text style={styles.customer}>{ticket.customer.name}</Text>
      <Text style={styles.meta}>{ticket.products.length} ürün</Text>
      <Pressable style={styles.button} onPress={onShare} disabled={sharing}>
        <Text style={styles.buttonText}>{sharing ? 'PDF hazırlanıyor…' : 'PDF Oluştur ve Gönder'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9fafb', gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  customer: { fontSize: 17, fontWeight: '600', color: '#374151' },
  meta: { color: '#6b7280' },
  button: { marginTop: 20, minHeight: 52, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
