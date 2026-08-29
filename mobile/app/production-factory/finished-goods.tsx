import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  Package,
  CheckCircle2,
  Plus,
  Search,
  Truck,
  Building,
  X
} from 'lucide-react-native';

export default function FinishedGoodsScreen() {
  const queryClient = useQueryClient();
  const [completeModal, setCompleteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [warehouse, setWarehouse] = useState('Main FG Warehouse');
  const [location, setLocation] = useState('Rack FG-01');

  // Queries
  const { data: fgData, isLoading } = useQuery({
    queryKey: ['factory-finished-goods-report'],
    queryFn: async () => {
      const res = await api.get('/factory/reports/finished-goods');
      return res.data.data;
    }
  });

  const { data: ordersData } = useQuery({
    queryKey: ['factory-planning-orders'],
    queryFn: async () => {
      const res = await api.get('/factory/planning/orders');
      return res.data.data;
    }
  });

  // Mutation
  const completeMutation = useMutation({
    mutationFn: async ({ orderId, payload }: any) => {
      const res = await api.post(`/factory/orders/${orderId}/complete`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-finished-goods-report'] });
      queryClient.invalidateQueries({ queryKey: ['factory-planning-orders'] });
      setCompleteModal(false);
      Alert.alert('Production Completed', 'Order marked as COMPLETED and moved to Finished Goods Inventory!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to complete production order');
    }
  });

  const handleCompleteOrder = () => {
    if (!selectedOrder) {
      Alert.alert('Required', 'Please select a production order');
      return;
    }

    completeMutation.mutate({
      orderId: selectedOrder,
      payload: { warehouse, location }
    });
  };

  const activeOrders = (ordersData || []).filter((o: any) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Finished Goods Warehouse</Text>
          <Text style={styles.subtitle}>Packed Inventory & Ready for Dispatch</Text>
        </View>
        <TouchableOpacity style={styles.completeBtn} onPress={() => setCompleteModal(true)}>
          <CheckCircle2 size={16} color="#FFFFFF" />
          <Text style={styles.completeBtnText}>Receive from Floor</Text>
        </TouchableOpacity>
      </View>

      {/* Finished Goods Inventory List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={fgData || []}
          keyExtractor={(item, idx) => idx.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.fgCard}>
              <View style={styles.fgTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fgSku}>{item['SKU']}</Text>
                  <Text style={styles.fgName}>{item['Product Name'] || item['Style']}</Text>
                  <Text style={styles.fgBatch}>Batch: {item['Batch #']}</Text>
                </View>
                <Badge label={`${item['In-Stock Qty']} pcs`} variant="success" />
              </View>

              <View style={styles.fgMeta}>
                <Text style={styles.metaText}>Godown: {item['Warehouse']}</Text>
                <Text style={styles.metaText}>Location: {item['Location']}</Text>
                <Text style={styles.metaText}>Packed: {item['Packed Date']}</Text>
              </View>
            </Card>
          )}
        />
      )}

      {/* Modal: Complete Order to FG */}
      <Modal visible={completeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive Lot into Finished Goods</Text>
              <TouchableOpacity onPress={() => setCompleteModal(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Select Completed Production Order</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                {activeOrders.map((ord: any) => (
                  <TouchableOpacity
                    key={ord.id}
                    style={[styles.selectChip, selectedOrder === ord.id && styles.selectChipActive]}
                    onPress={() => setSelectedOrder(ord.id)}
                  >
                    <Text style={[styles.selectChipText, selectedOrder === ord.id && styles.selectChipTextActive]}>
                      {ord.productionOrderNumber} ({ord.totalQuantity} pcs)
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <AppInput label="Target Warehouse / Godown" value={warehouse} onChangeText={setWarehouse} />
              <AppInput label="Rack / Bin Location" value={location} onChangeText={setLocation} />

              <AppButton
                title={completeMutation.isPending ? 'Processing...' : 'Transfer to Finished Goods'}
                onPress={handleCompleteOrder}
                loading={completeMutation.isPending}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.success,
    borderRadius: 8
  },
  completeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10
  },
  fgCard: {
    padding: 14
  },
  fgTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  fgSku: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary
  },
  fgName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 2
  },
  fgBatch: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  fgMeta: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  metaText: {
    fontSize: 11,
    color: Colors.textMuted
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text
  },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8
  },
  selectChipActive: {
    backgroundColor: Colors.primary
  },
  selectChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  selectChipTextActive: {
    color: '#FFFFFF'
  }
});
