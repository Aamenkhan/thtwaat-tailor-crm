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
  Layers,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  Calendar,
  X,
  User,
  Package,
  ChevronRight
} from 'lucide-react-native';

export default function ProductionPlanningScreen() {
  const queryClient = useQueryClient();

  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // New Order Form State
  const [styleNumber, setStyleNumber] = useState('');
  const [productName, setProductName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('500');
  const [plannedDays, setPlannedDays] = useState('14');
  const [priority, setPriority] = useState('NORMAL');
  const [productionUnit, setProductionUnit] = useState('Main Production Unit');
  const [notes, setNotes] = useState('');

  // Fetch Production Orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['factory-planning-orders', selectedStatus, search],
    queryFn: async () => {
      const params: any = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (search) params.search = search;
      const res = await api.get('/factory/planning/orders', { params });
      return res.data.data;
    }
  });

  // Create Production Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/planning/orders', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-planning-orders'] });
      setModalVisible(false);
      Alert.alert('Production Order Created', 'Order & Auto BOM material requirements generated successfully!');
      setStyleNumber('');
      setProductName('');
      setTotalQuantity('500');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create production order');
    }
  });

  // Convert Shortage to Purchase Requisition Mutation
  const purchaseReqMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/planning/create-purchase-requisition', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-planning-orders'] });
      Alert.alert('Purchase Requisition', 'Material shortages converted into Purchase Requirements!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create purchase requirement');
    }
  });

  const handleCreateOrder = () => {
    if (!styleNumber || !productName || !totalQuantity) {
      Alert.alert('Required', 'Please fill Style Number, Product Name, and Quantity');
      return;
    }

    const qty = parseInt(totalQuantity) || 100;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (parseInt(plannedDays) || 14));

    // Sample Size x Color matrix
    const matrix = {
      'White': { 'S': Math.round(qty * 0.1), 'M': Math.round(qty * 0.2), 'L': Math.round(qty * 0.15) },
      'Navy Blue': { 'S': Math.round(qty * 0.1), 'M': Math.round(qty * 0.25), 'L': Math.round(qty * 0.2) }
    };

    createOrderMutation.mutate({
      styleNumber,
      productName,
      totalQuantity: qty,
      plannedCompletionDate: targetDate,
      priority,
      productionUnit,
      matrix,
      notes
    });
  };

  const handleConvertShortage = (order: any) => {
    const shortages = (order.materialRequirements || []).filter((r: any) => r.shortageQuantity > 0);
    if (shortages.length === 0) {
      Alert.alert('Stock Available', 'All required raw materials are currently in stock.');
      return;
    }

    purchaseReqMutation.mutate({
      productionOrderId: order.id,
      requirements: shortages.map((s: any) => ({
        materialName: s.materialName,
        inventoryItemId: s.inventoryItemId,
        requiredQuantity: s.shortageQuantity,
        unit: s.unit,
        estimatedUnitCost: 150
      }))
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Search & Create Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <AppInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search style, order no..."
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {['ALL', 'PLANNED', 'MATERIAL_PENDING', 'READY_FOR_CUTTING', 'CUTTING', 'STITCHING', 'COMPLETED'].map((st) => (
          <TouchableOpacity
            key={st}
            onPress={() => setSelectedStatus(st)}
            style={[styles.filterChip, selectedStatus === st && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedStatus === st && styles.filterChipTextActive]}>
              {st.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Production Order Cards */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={ordersData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const hasShortage = item.status === 'MATERIAL_PENDING';
            return (
              <Card style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNum}>{item.productionOrderNumber}</Text>
                    <Text style={styles.styleTitle}>{item.styleNumber} — {item.productName}</Text>
                  </View>
                  <Badge
                    label={item.status}
                    variant={item.status === 'COMPLETED' ? 'success' : hasShortage ? 'danger' : 'info'}
                  />
                </View>

                {/* Details Grid */}
                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Planned Qty</Text>
                    <Text style={styles.metaVal}>{item.totalQuantity} pcs</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Target Date</Text>
                    <Text style={styles.metaVal}>{item.plannedCompletionDate?.split('T')[0]}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Unit</Text>
                    <Text style={styles.metaVal}>{item.productionUnit || 'Unit 1'}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  {hasShortage && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                      onPress={() => handleConvertShortage(item)}
                    >
                      <ShoppingCart size={14} color={Colors.danger} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.danger }}>
                        Purchase Shortages
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                    onPress={() => setSelectedOrder(item)}
                  >
                    <Layers size={14} color={Colors.accent} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.accent }}>
                      View BOM & Matrix
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Modal: Create Production Order */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Production Order</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <AppInput
                label="Style / Design Number *"
                placeholder="e.g. STY-SHIRT-902"
                value={styleNumber}
                onChangeText={setStyleNumber}
              />
              <AppInput
                label="Product Name *"
                placeholder="e.g. Premium Linen Shirt"
                value={productName}
                onChangeText={setProductName}
              />
              <AppInput
                label="Planned Total Quantity (Pcs) *"
                placeholder="e.g. 500"
                keyboardType="numeric"
                value={totalQuantity}
                onChangeText={setTotalQuantity}
              />
              <AppInput
                label="Production Lead Days"
                placeholder="14"
                keyboardType="numeric"
                value={plannedDays}
                onChangeText={setPlannedDays}
              />
              <AppInput
                label="Production Unit / Factory"
                placeholder="Unit 1 - Main Floor"
                value={productionUnit}
                onChangeText={setProductionUnit}
              />

              <AppButton
                title={createOrderMutation.isPending ? 'Generating Plan...' : 'Create Plan & Calculate BOM'}
                onPress={handleCreateOrder}
                loading={createOrderMutation.isPending}
                style={{ marginTop: 10 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: View BOM & Matrix */}
      <Modal visible={!!selectedOrder} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Breakdown: {selectedOrder?.productionOrderNumber}</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Size & Color Allocation</Text>
              <Card style={{ padding: 10, marginBottom: 14 }}>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  Total Planned: {selectedOrder?.totalQuantity} garments
                </Text>
                <Text style={{ fontSize: 11, color: Colors.text, marginTop: 4 }}>
                  Matrix: {selectedOrder?.matrixJson || 'Standard Assortment'}
                </Text>
              </Card>

              <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Auto Calculated BOM Materials (+5% Wastage)</Text>
              {(selectedOrder?.materialRequirements || []).map((req: any, i: number) => (
                <View key={i} style={styles.bomRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700' }}>{req.materialName}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      Required: {req.grossRequired} {req.unit} | In Stock: {req.currentStock} {req.unit}
                    </Text>
                  </View>
                  <Badge
                    label={req.status}
                    variant={req.status === 'AVAILABLE' ? 'success' : 'danger'}
                  />
                </View>
              ))}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    gap: 10
  },
  searchBox: {
    flex: 1
  },
  searchInput: {
    marginBottom: 0
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: 8
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    alignSelf: 'center'
  },
  filterChipActive: {
    backgroundColor: Colors.primary
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12
  },
  orderCard: {
    padding: 14
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  orderNum: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.accent
  },
  styleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2
  },
  metaGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  metaItem: {
    flex: 1
  },
  metaLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
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
  bomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  }
});
