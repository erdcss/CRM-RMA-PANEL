import { StyleSheet, View } from 'react-native';

import { RmaCard } from '@/components/rma/RmaCard';
import type { RmaTicket } from '@/lib/api';

type RecentRmaCardProps = {
  ticket: RmaTicket;
  onPress: () => void;
};

export function RecentRmaCard({ ticket, onPress }: RecentRmaCardProps) {
  return <RmaCard ticket={ticket} onPress={onPress} compact />;
}

export function RecentRmaList({
  tickets,
  onPressTicket,
}: {
  tickets: RmaTicket[];
  onPressTicket: (id: number) => void;
}) {
  return (
    <View style={styles.list}>
      {tickets.map((ticket) => (
        <RecentRmaCard key={ticket.id} ticket={ticket} onPress={() => onPressTicket(ticket.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
});
