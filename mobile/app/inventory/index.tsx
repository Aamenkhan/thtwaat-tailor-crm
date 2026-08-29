import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  X,
  Layers,
  Download,
  UploadCloud
} from 'lucide-react-native';

export default function InventoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [activeItem, setActiveItem] = useState<any>(null);

  // New Item State
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('FABRIC');
  const [unit, setUnit] = useState('meter');
  const [initialStock, setInitialStock] = useState('50');
  const [minStockAlert, setMinStockAlert] = useState('10');
  const [unitCost, setUnitCost] = useState('450');
  const [supplierName, setSupplierName] = useState('');

  // Stock Movement State
  const [movementType, setMovementType] = useState<'PURCHASE_IN' | 'PRODUCTION_CONSUMPTION' | 'DAMAGE_WASTAGE'>('PURCHASE_IN');
  const [movementQty, setMovementQty] = useState('10');
  const [movementNotes, setMovementNotes] = useState('');

  // Fetch Inventory
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', selectedCategory, search],
    queryFn: async () => {
      const params: any = {};
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (search) params.search = search;
      const res = await api.get('/inventory', { params });
      return res.data.data;
    }
  });

  // Create Item Mutation
  const createItemMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/inventory', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setModalVisible(false);
      Alert.alert('Material Added', 'New inventory item added successfully');
      setName('');
      setSku('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to add item');
    }
  });

  // Stock Movement Mutation
  const stockMutation = useMutation({
    mutationFn: async ({ itemId, payload }: { itemId: string; payload: any }) => {
      const res = await api.post(`/inventory/${itemId}/movements`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setStockModalVisible(false);
      setMovementQty('10');
      Alert.alert('Stock Updated', 'Inventory quantity updated');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Stock movement failed');
    }
  });

  const handleCreateItem = () => {
    if (!name || !unit) {
      Alert.alert('Required', 'Please enter item name and unit');
      return;
    }
    createItemMutation.mutate({
      name,
      sku: sku || null,
      category,
      unit,
      currentStock: parseFloat(initialStock || '0'),
      minStockAlert: parseFloat(minStockAlert || '10'),
      unitCost: parseFloat(unitCost || '0'),
      supplierName: supplierName || null
    });
  };

  const handleStockMovement = () => {
    const qty = parseFloat(movementQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Required', 'Enter a valid quantity');
      return;
    }
    stockMutation.mutate({
      itemId: activeItem.id,
      payload: {
        movementType,
        quantity: qty,
        notes: movementNotes
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Search & Action Bar */}
      <View style={styles.topActions}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <AppInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search fabrics, trims, SKUs..."
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Quick Bulk Import / Export Bar */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 7,
            backgroundColor: '#EFF6FF',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#BFDBFE'
          }}
          onPress={() => router.push('/imports' as any)}
        >
          <UploadCloud size={14} color={Colors.accent} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.accent }}>Import Excel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 7,
            backgroundColor: '#F8FAFC',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: Colors.border
          }}
          onPress={() => Linking.openURL(`${API_BASE_URL}/exports/inventory`)}
        >
          <Download size={14} color={Colors.text} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.text }}>Export Excel</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {['ALL', 'FABRIC', 'BUTTON', 'ZIPPER', 'THREAD', 'LINING', 'LABEL', 'PACKING_MATERIAL'].map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCategory(cat)}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={inventoryData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isLow = item.currentStock <= item.minStockAlert;
            return (
              <Card style={styles.itemCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSku}>
                      {item.sku || 'No SKU'} • Supplier: {item.supplierName || 'General'}
                    </Text>
                  </View>
                  <Badge label={item.category} variant="slate" />
                </View>

                <View style={styles.stockRow}>
                  <View>
                    <Text style={styles.stockLabel}>Current Stock</Text>
                    <Text style={[styles.stockValue, isLow && { color: Colors.danger }]}>
                      {item.currentStock} {item.unit}
                    </Text>
                    {isLow && (
                      <View style={styles.lowBadge}>
                        <AlertTriangle size={12} color={Colors.danger} />
                        <Text style={styles.lowText}>Low Stock (Min: {item.minStockAlert})</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.stockLabel}>Unit Cost</Text>
                    <Text style={styles.costValue}>₹{item.unitCost?.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Stock Movement Action */}
                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => {
                    setActiveItem(item);
                    setStockModalVisible(true);
                  }}
                >
                  <Text style={styles.adjustBtnText}>+ / - Adjust Stock (In / Out)</Text>
                </TouchableOpacity>
              </Card>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Package size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No inventory items</Text>
              <Text style={styles.emptySub}>Add fabrics & trims to track material consumption</Text>
            </View>
          }
        />
      )}

      {/* Add Item Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Material / Trim</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingBottom: 20 }}>
              <AppInput label="Material Name *" value={name} onChangeText={setName} placeholder="e.g. Linen Fabric, Mother of Pearl Buttons" />
              <AppInput label="SKU / Item Code" value={sku} onChangeText={setSku} placeholder="e.g. FAB-LIN-003" />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <AppInput label="Unit *" value={unit} onChangeText={setUnit} placeholder="meter, pcs, roll" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput label="Initial Stock" value={initialStock} onChangeText={setInitialStock} keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <AppInput label="Cost per Unit (₹)" value={unitCost} onChangeText={setUnitCost} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput label="Low Stock Alert Threshold" value={minStockAlert} onChangeText={setMinStockAlert} keyboardType="numeric" />
                </View>
              </View>

              <AppInput label="Supplier Name" value={supplierName} onChangeText={setSupplierName} placeholder="e.g. Raymond Mills" />

              <AppButton title="Save Material" onPress={handleCreateItem} loading={createItemMutation.isPending} variant="accent" style={{ marginTop: 10 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal visible={stockModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjust Stock: {activeItem?.name}</Text>
              <TouchableOpacity onPress={() => setStockModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.typeRow}>
              {[
                { id: 'PURCHASE_IN', label: '+ Stock In (Purchase)' },
                { id: 'PRODUCTION_CONSUMPTION', label: '- Used in Cutting' },
                { id: 'DAMAGE_WASTAGE', label: '- Wastage' }
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setMovementType(m.id as any)}
                  style={[styles.typePill, movementType === m.id && styles.typePillActive]}
                >
                  <Text style={[styles.typePillText, movementType === m.id && styles.typePillTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <AppInput
              label={`Quantity (${activeItem?.unit}) *`}
              value={movementQty}
              onChangeText={setMovementQty}
              keyboardType="numeric"
            />

            <AppInput
              label="Notes / PO Number"
              value={movementNotes}
              onChangeText={setMovementNotes}
              placeholder="e.g. Purchase order PO-401 or cutting wastage"
            />

            <AppButton
              title="Confirm Stock Update"
              onPress={handleStockMovement}
              loading={stockMutation.isPending}
              variant="primary"
              style={{ marginTop: 14 }}
            />
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
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 46
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    marginLeft: 6
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterScroll: {
    maxHeight: 38,
    marginBottom: 10
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    padding: 16,
    paddingTop: 6
  },
  itemCard: {
    padding: 14,
    marginBottom: 10
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  itemName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  itemSku: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  stockLabel: {
    fontSize: 11,
    color: Colors.textMuted
  },
  stockValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2
  },
  costValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2
  },
  lowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  lowText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.danger
  },
  adjustBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9'
  },
  adjustBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text
  },
  formRow: {
    flexDirection: 'row',
    gap: 10
  },
  typeRow: {
    marginBottom: 14,
    gap: 6
  },
  typePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border
  },
  typePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted
  },
  typePillTextActive: {
    color: '#FFFFFF'
  }
});
