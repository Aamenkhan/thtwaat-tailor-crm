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
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  Users2,
  Plus,
  DollarSign,
  Scissors,
  CheckCircle2,
  Phone,
  X,
  Layers
} from 'lucide-react-native';

export default function WorkersScreen() {
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [pieceRateModalVisible, setPieceRateModalVisible] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);

  // New Worker State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'TAILOR' | 'CUTTER' | 'MASTER' | 'FINISHER'>('TAILOR');
  const [wageType, setWageType] = useState<'PIECE_RATE' | 'MONTHLY_SALARY'>('PIECE_RATE');
  const [defaultPieceRate, setDefaultPieceRate] = useState('150');
  const [monthlySalary, setMonthlySalary] = useState('18000');

  // Manual Piece Rate Log State
  const [stage, setStage] = useState<'CUTTING' | 'STITCHING' | 'FINISHING'>('STITCHING');
  const [quantity, setQuantity] = useState('5');
  const [ratePerPiece, setRatePerPiece] = useState('150');
  const [notes, setNotes] = useState('');

  // Fetch Workers
  const { data: workersData, isLoading } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const res = await api.get('/workers');
      return res.data.data;
    }
  });

  // Create Worker Mutation
  const createWorkerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/workers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setModalVisible(false);
      Alert.alert('Worker Added', 'Artisan added to staff roster');
      setName('');
      setPhone('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to add worker');
    }
  });

  // Log Piece Rate Mutation
  const logPieceRateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/workers/piece-rate-logs', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setPieceRateModalVisible(false);
      Alert.alert('Earning Logged', 'Piece rate task successfully recorded');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to log piece rate');
    }
  });

  const handleCreateWorker = () => {
    if (!name || !phone) {
      Alert.alert('Required', 'Please enter artisan name and phone');
      return;
    }
    createWorkerMutation.mutate({
      name,
      phone,
      role,
      wageType,
      defaultPieceRate: parseFloat(defaultPieceRate || '0'),
      monthlySalary: parseFloat(monthlySalary || '0')
    });
  };

  const handleLogPieceRate = () => {
    if (!selectedWorker) return;
    const qty = parseInt(quantity || '1', 10);
    const rate = parseFloat(ratePerPiece || '0');

    logPieceRateMutation.mutate({
      workerId: selectedWorker.id,
      stage,
      quantity: qty,
      ratePerPiece: rate,
      notes
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Banner & Add Button */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.barTitle}>Artisans & Production Staff</Text>
          <Text style={styles.barSub}>Track piece-rate outputs and weekly earnings</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Workers List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={workersData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.workerCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{item.name}</Text>
                  <Text style={styles.workerPhone}>📞 {item.phone}</Text>
                </View>
                <Badge label={item.role} variant="purple" />
              </View>

              <View style={styles.wageBox}>
                <View>
                  <Text style={styles.wageLabel}>Wage Model</Text>
                  <Text style={styles.wageType}>{item.wageType.replace(/_/g, ' ')}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.wageLabel}>Rate / Salary</Text>
                  <Text style={styles.wageValue}>
                    {item.wageType === 'PIECE_RATE'
                      ? `₹${item.defaultPieceRate}/pc`
                      : `₹${item.monthlySalary?.toLocaleString()}/mo`}
                  </Text>
                </View>
              </View>

              {/* Action */}
              <TouchableOpacity
                style={styles.logBtn}
                onPress={() => {
                  setSelectedWorker(item);
                  setRatePerPiece(item.defaultPieceRate?.toString() || '150');
                  setPieceRateModalVisible(true);
                }}
              >
                <DollarSign size={14} color={Colors.accent} />
                <Text style={styles.logBtnText}>+ Log Piece-Rate Task</Text>
              </TouchableOpacity>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Users2 size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No workers registered</Text>
              <Text style={styles.emptySub}>Add cutters and tailors to allocate job card tasks</Text>
            </View>
          }
        />
      )}

      {/* Add Worker Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Artisan / Staff</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingBottom: 20 }}>
              <AppInput label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. Master Imran Khan" />
              <AppInput label="Mobile Phone *" value={phone} onChangeText={setPhone} placeholder="9876543210" keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>Artisan Role</Text>
              <View style={styles.typeRow}>
                {['TAILOR', 'CUTTER', 'MASTER', 'FINISHER'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r as any)}
                    style={[styles.typePill, role === r && styles.typePillActive]}
                  >
                    <Text style={[styles.typePillText, role === r && styles.typePillTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Compensation Model</Text>
              <View style={styles.typeRow}>
                {['PIECE_RATE', 'MONTHLY_SALARY'].map((w) => (
                  <TouchableOpacity
                    key={w}
                    onPress={() => setWageType(w as any)}
                    style={[styles.typePill, wageType === w && styles.typePillActive]}
                  >
                    <Text style={[styles.typePillText, wageType === w && styles.typePillTextActive]}>
                      {w.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {wageType === 'PIECE_RATE' ? (
                <AppInput
                  label="Default Piece Rate (₹ per garment) *"
                  value={defaultPieceRate}
                  onChangeText={setDefaultPieceRate}
                  keyboardType="numeric"
                />
              ) : (
                <AppInput
                  label="Monthly Salary (₹) *"
                  value={monthlySalary}
                  onChangeText={setMonthlySalary}
                  keyboardType="numeric"
                />
              )}

              <AppButton title="Save Artisan" onPress={handleCreateWorker} loading={createWorkerMutation.isPending} variant="accent" style={{ marginTop: 14 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Piece Rate Log Modal */}
      <Modal visible={pieceRateModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Work: {selectedWorker?.name}</Text>
              <TouchableOpacity onPress={() => setPieceRateModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Production Stage Completed</Text>
            <View style={styles.typeRow}>
              {['CUTTING', 'STITCHING', 'FINISHING'].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStage(s as any)}
                  style={[styles.typePill, stage === s && styles.typePillActive]}
                >
                  <Text style={[styles.typePillText, stage === s && styles.typePillTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <AppInput label="Quantity (pcs) *" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput label="Rate / Pc (₹) *" value={ratePerPiece} onChangeText={setRatePerPiece} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.totalPreviewBox}>
              <Text style={styles.totalPreviewLabel}>Total Task Payout:</Text>
              <Text style={styles.totalPreviewVal}>
                ₹{(parseInt(quantity || '0', 10) * parseFloat(ratePerPiece || '0')).toLocaleString()}
              </Text>
            </View>

            <AppInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. 5x Bespoke Suits stitched"
            />

            <AppButton
              title="Record Piece Rate Earning"
              onPress={handleLogPieceRate}
              loading={logPieceRateMutation.isPending}
              variant="success"
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  barTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },
  barSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    padding: 16
  },
  workerCard: {
    padding: 14,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  workerName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },
  workerPhone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2
  },
  wageBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  wageLabel: {
    fontSize: 11,
    color: Colors.textMuted
  },
  wageType: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2
  },
  wageValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.success,
    marginTop: 2
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  logBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14
  },
  typePill: {
    flex: 1,
    paddingVertical: 8,
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  typePillTextActive: {
    color: '#FFFFFF'
  },
  formRow: {
    flexDirection: 'row',
    gap: 10
  },
  totalPreviewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  totalPreviewLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.success
  },
  totalPreviewVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.success
  }
});
