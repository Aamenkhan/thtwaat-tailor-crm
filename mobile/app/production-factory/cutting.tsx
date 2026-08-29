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
  Scissors,
  QrCode,
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Package,
  X,
  Printer
} from 'lucide-react-native';

export default function CuttingBundlingScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'PLANS' | 'ROLLS' | 'BUNDLES'>('PLANS');
  const [modalVisible, setModalVisible] = useState(false);
  const [rollModalVisible, setRollModalVisible] = useState(false);

  // New Cutting Plan Form State
  const [productionOrderId, setProductionOrderId] = useState('');
  const [styleNumber, setStyleNumber] = useState('');
  const [fabricName, setFabricName] = useState('Italian Cotton');
  const [markerLength, setMarkerLength] = useState('4.5');
  const [layQuantityPlies, setLayQuantityPlies] = useState('50');
  const [plannedCutQty, setPlannedCutQty] = useState('200');
  const [wastageMeters, setWastageMeters] = useState('2.5');

  // Fabric Roll Form State
  const [rollNumber, setRollNumber] = useState('');
  const [fabricType, setFabricType] = useState('Cotton 100%');
  const [rollColor, setRollColor] = useState('Navy Blue');
  const [widthInches, setWidthInches] = useState('58');
  const [gsm, setGsm] = useState('180');
  const [lengthMeters, setLengthMeters] = useState('120');

  // Queries
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['factory-cutting-plans'],
    queryFn: async () => {
      const res = await api.get('/factory/cutting-plans');
      return res.data.data;
    }
  });

  const { data: rollsData, isLoading: rollsLoading } = useQuery({
    queryKey: ['factory-rolls'],
    queryFn: async () => {
      const res = await api.get('/factory/rolls');
      return res.data.data;
    }
  });

  const { data: bundlesData, isLoading: bundlesLoading } = useQuery({
    queryKey: ['factory-bundles'],
    queryFn: async () => {
      const res = await api.get('/factory/bundles');
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

  // Create Cutting Plan Mutation
  const createPlanMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/cutting-plans', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-cutting-plans'] });
      queryClient.invalidateQueries({ queryKey: ['factory-bundles'] });
      setModalVisible(false);
      Alert.alert('Cutting Plan Saved', 'Cutting record created & bundles with QR codes generated!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create cutting plan');
    }
  });

  // Create Fabric Roll Mutation
  const createRollMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/rolls', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-rolls'] });
      setRollModalVisible(false);
      Alert.alert('Fabric Roll Registered', 'New fabric lot added with GSM & width tracking!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to register roll');
    }
  });

  const handleCreatePlan = () => {
    if (!productionOrderId || !styleNumber || !plannedCutQty) {
      Alert.alert('Required', 'Please select production order and enter planned cut quantity');
      return;
    }

    createPlanMutation.mutate({
      productionOrderId,
      styleNumber,
      fabricName,
      markerLengthMeters: parseFloat(markerLength) || 4.5,
      layQuantityPlies: parseInt(layQuantityPlies) || 50,
      plannedCutQuantity: parseInt(plannedCutQty) || 200,
      wastageMeters: parseFloat(wastageMeters) || 0
    });
  };

  const handleCreateRoll = () => {
    if (!fabricType || !rollColor || !lengthMeters) {
      Alert.alert('Required', 'Please fill fabric type, color, and initial meters');
      return;
    }

    createRollMutation.mutate({
      rollNumber: rollNumber || undefined,
      fabricType,
      color: rollColor,
      widthInches: parseFloat(widthInches) || 58,
      gsm: parseFloat(gsm) || 180,
      initialLengthMeters: parseFloat(lengthMeters) || 100
    });
  };

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PLANS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PLANS')}
        >
          <Text style={[styles.tabText, activeTab === 'PLANS' && styles.tabTextActive]}>Cutting Plans</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ROLLS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ROLLS')}
        >
          <Text style={[styles.tabText, activeTab === 'ROLLS' && styles.tabTextActive]}>Fabric Rolls (GSM)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'BUNDLES' && styles.tabBtnActive]}
          onPress={() => setActiveTab('BUNDLES')}
        >
          <Text style={[styles.tabText, activeTab === 'BUNDLES' && styles.tabTextActive]}>Bundles & QR</Text>
        </TouchableOpacity>
      </View>

      {/* Action Header */}
      <View style={styles.actionHeader}>
        <Text style={styles.sectionHeading}>
          {activeTab === 'PLANS' ? 'Recent Cutting Spreads' : activeTab === 'ROLLS' ? 'Fabric Roll Lot Inventory' : 'Generated Bundle Barcodes'}
        </Text>
        {activeTab === 'PLANS' && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.createBtnText}>New Cut Plan</Text>
          </TouchableOpacity>
        )}
        {activeTab === 'ROLLS' && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setRollModalVisible(true)}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Add Roll</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab 1: Cutting Plans */}
      {activeTab === 'PLANS' && (
        plansLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={plansData || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Card style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View>
                    <Text style={styles.itemTitle}>{item.styleNumber} — {item.fabricName}</Text>
                    <Text style={styles.itemSub}>Marker: {item.markerLengthMeters}m | Plies: {item.layQuantityPlies}</Text>
                  </View>
                  <Badge label={`${item.actualCutQuantity} cut`} variant="purple" />
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Wastage: {item.wastageMeters}m</Text>
                  <Text style={styles.metaText}>Bundles: {(item.bundles || []).length} tags</Text>
                  <Text style={styles.metaText}>Date: {item.cutDate?.split('T')[0]}</Text>
                </View>
              </Card>
            )}
          />
        )
      )}

      {/* Tab 2: Fabric Rolls */}
      {activeTab === 'ROLLS' && (
        rollsLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={rollsData || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Card style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View>
                    <Text style={styles.itemTitle}>{item.rollNumber}</Text>
                    <Text style={styles.itemSub}>{item.fabricType} ({item.color})</Text>
                  </View>
                  <Badge label={`${item.currentLengthMeters}m left`} variant={item.currentLengthMeters > 20 ? 'success' : 'danger'} />
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Width: {item.widthInches}"</Text>
                  <Text style={styles.metaText}>GSM: {item.gsm}</Text>
                  <Text style={styles.metaText}>Initial: {item.initialLengthMeters}m</Text>
                </View>
              </Card>
            )}
          />
        )
      )}

      {/* Tab 3: Bundles & QR */}
      {activeTab === 'BUNDLES' && (
        bundlesLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={bundlesData || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Card style={styles.bundleCard}>
                <View style={styles.bundleLeft}>
                  <View style={styles.qrBadge}>
                    <QrCode size={24} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bundleNum}>{item.bundleNumber}</Text>
                    <Text style={styles.bundleDetails}>
                      {item.styleNumber} | Size: {item.size} | Color: {item.color}
                    </Text>
                    <Text style={styles.bundleQty}>Batch Quantity: <Text style={{ fontWeight: '800' }}>{item.quantity} pcs</Text></Text>
                  </View>
                </View>
                <Badge label={item.currentStage} variant="info" />
              </Card>
            )}
          />
        )
      )}

      {/* Modal: New Cutting Plan */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Cutting Plan & Spreading</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Select Production Order</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                {(ordersData || []).map((ord: any) => (
                  <TouchableOpacity
                    key={ord.id}
                    style={[styles.selectChip, productionOrderId === ord.id && styles.selectChipActive]}
                    onPress={() => {
                      setProductionOrderId(ord.id);
                      setStyleNumber(ord.styleNumber);
                    }}
                  >
                    <Text style={[styles.selectChipText, productionOrderId === ord.id && styles.selectChipTextActive]}>
                      {ord.productionOrderNumber} ({ord.styleNumber})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <AppInput label="Fabric Name *" value={fabricName} onChangeText={setFabricName} />
              <AppInput label="Marker Length (Meters)" value={markerLength} onChangeText={setMarkerLength} keyboardType="numeric" />
              <AppInput label="Lay Quantity / Plies *" value={layQuantityPlies} onChangeText={setLayQuantityPlies} keyboardType="numeric" />
              <AppInput label="Planned Cut Quantity (Pcs) *" value={plannedCutQty} onChangeText={setPlannedCutQty} keyboardType="numeric" />
              <AppInput label="Estimated Wastage (Meters)" value={wastageMeters} onChangeText={setWastageMeters} keyboardType="numeric" />

              <AppButton
                title={createPlanMutation.isPending ? 'Generating Bundles...' : 'Execute Cut & Generate Bundles'}
                onPress={handleCreatePlan}
                loading={createPlanMutation.isPending}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: New Fabric Roll */}
      <Modal visible={rollModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Fabric Roll Lot</Text>
              <TouchableOpacity onPress={() => setRollModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <AppInput label="Roll / Lot Number (Optional)" placeholder="ROLL-2026-001" value={rollNumber} onChangeText={setRollNumber} />
              <AppInput label="Fabric Type *" placeholder="e.g. Linen 100%" value={fabricType} onChangeText={setFabricType} />
              <AppInput label="Color *" placeholder="e.g. Royal Navy" value={rollColor} onChangeText={setRollColor} />
              <AppInput label="Fabric Width (Inches)" placeholder="58" value={widthInches} onChangeText={setWidthInches} keyboardType="numeric" />
              <AppInput label="Fabric GSM" placeholder="180" value={gsm} onChangeText={setGsm} keyboardType="numeric" />
              <AppInput label="Initial Length (Meters) *" placeholder="120" value={lengthMeters} onChangeText={setLengthMeters} keyboardType="numeric" />

              <AppButton
                title={createRollMutation.isPending ? 'Saving...' : 'Register Fabric Roll'}
                onPress={handleCreateRoll}
                loading={createRollMutation.isPending}
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
  tabBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF'
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted
  },
  tabTextActive: {
    color: Colors.accent
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.accent,
    borderRadius: 8
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 40,
    gap: 10
  },
  itemCard: {
    padding: 14
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  itemSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  metaText: {
    fontSize: 11,
    color: Colors.textMuted
  },
  bundleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12
  },
  bundleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  qrBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  bundleNum: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary
  },
  bundleDetails: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  bundleQty: {
    fontSize: 11,
    color: Colors.text,
    marginTop: 2
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
