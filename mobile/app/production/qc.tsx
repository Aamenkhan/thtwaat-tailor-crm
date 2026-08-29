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
  CheckCircle2,
  AlertOctagon,
  RotateCcw,
  Scissors,
  X,
  User,
  ShieldCheck
} from 'lucide-react-native';

const DEFECT_TYPES = [
  { id: 'STITCHING_DEFECT', label: 'Stitching / Seam Flaw' },
  { id: 'MEASUREMENT_MISMATCH', label: 'Measurement Mismatch' },
  { id: 'FABRIC_DAMAGE', label: 'Fabric / Thread Damage' },
  { id: 'COLOR_MISMATCH', label: 'Color / Shade Deviation' },
  { id: 'STAIN', label: 'Oil / Fabric Stain' },
  { id: 'TRIM_DEFECT', label: 'Missing / Defective Trim' }
];

export default function QCScreen() {
  const queryClient = useQueryClient();

  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [reworkModalVisible, setReworkModalVisible] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState('STITCHING_DEFECT');
  const [defectNotes, setDefectNotes] = useState('');

  // Fetch QC Job Cards
  const { data: jobCards, isLoading } = useQuery({
    queryKey: ['qc-jobs'],
    queryFn: async () => {
      const res = await api.get('/production/job-cards', { params: { stage: 'QC_INSPECTION' } });
      return res.data.data;
    }
  });

  // QC Inspection Mutation
  const inspectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/qc/inspect', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qc-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setReworkModalVisible(false);
      Alert.alert('QC Logged', `Inspection marked as ${data.qcRecord?.status}`);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'QC logging failed');
    }
  });

  const handlePass = (job: any) => {
    inspectMutation.mutate({
      jobCardId: job.id,
      status: 'PASSED'
    });
  };

  const handleOpenRework = (job: any) => {
    setSelectedJob(job);
    setReworkModalVisible(true);
  };

  const handleConfirmRework = () => {
    if (!selectedJob) return;
    inspectMutation.mutate({
      jobCardId: selectedJob.id,
      status: 'REWORK_REQUIRED',
      defectType: selectedDefect,
      defectNotes
    });
  };

  const handleReject = (job: any) => {
    Alert.alert('Reject Garment', 'Are you sure you want to mark this item as Scrapped / Rejected?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm Reject',
        style: 'destructive',
        onPress: () => {
          inspectMutation.mutate({
            jobCardId: job.id,
            status: 'REJECTED',
            defectType: 'FABRIC_DAMAGE',
            defectNotes: 'Scrapped during QC'
          });
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBanner}>
        <ShieldCheck size={24} color={Colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Quality Assurance Console</Text>
          <Text style={styles.bannerSub}>Inspect finished garments before packing and handover</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobCards || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.qcCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.jobNum}>{item.jobCardNumber}</Text>
                  <Text style={styles.orderRef}>
                    Order: {item.order?.orderNumber} • {item.order?.customer?.name}
                  </Text>
                </View>
                <Badge label="Needs QC" variant="warning" />
              </View>

              <View style={styles.itemBox}>
                <Scissors size={15} color={Colors.text} />
                <Text style={styles.itemName}>
                  {item.plannedQuantity}x {item.orderItem?.customItemName}
                </Text>
              </View>

              {/* 3 QC Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.qcBtn, { backgroundColor: Colors.success }]}
                  onPress={() => handlePass(item)}
                >
                  <CheckCircle2 size={16} color="#FFF" />
                  <Text style={styles.qcBtnText}>PASS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.qcBtn, { backgroundColor: Colors.warning }]}
                  onPress={() => handleOpenRework(item)}
                >
                  <RotateCcw size={16} color="#FFF" />
                  <Text style={styles.qcBtnText}>REWORK</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.qcBtn, { backgroundColor: Colors.danger }]}
                  onPress={() => handleReject(item)}
                >
                  <AlertOctagon size={16} color="#FFF" />
                  <Text style={styles.qcBtnText}>REJECT</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <CheckCircle2 size={44} color={Colors.success} />
              <Text style={styles.emptyTitle}>All Garments QC Passed!</Text>
              <Text style={styles.emptySub}>No pending items in inspection queue</Text>
            </View>
          }
        />
      )}

      {/* Rework Defect Modal */}
      <Modal visible={reworkModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Rework Defect</Text>
              <TouchableOpacity onPress={() => setReworkModalVisible(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>Select Defect Reason</Text>
              <View style={styles.defectList}>
                {DEFECT_TYPES.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setSelectedDefect(d.id)}
                    style={[styles.defectPill, selectedDefect === d.id && styles.defectPillActive]}
                  >
                    <Text style={[styles.defectPillText, selectedDefect === d.id && styles.defectPillTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <AppInput
                label="Correction Notes for Tailor / Artisan *"
                value={defectNotes}
                onChangeText={setDefectNotes}
                placeholder="e.g. Alter sleeve length by 0.5 inch, redo collar stitching"
                multiline
                numberOfLines={3}
              />

              <AppButton
                title="Send Back to Stitching for Rework"
                onPress={handleConfirmRework}
                loading={inspectMutation.isPending}
                variant="accent"
                style={{ marginTop: 14 }}
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
  topBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },
  bannerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  listContent: {
    padding: 16
  },
  qcCard: {
    padding: 14,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  jobNum: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  orderRef: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  itemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8
  },
  qcBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8
  },
  qcBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
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
    maxHeight: '80%'
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
  defectList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14
  },
  defectPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.border
  },
  defectPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  defectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted
  },
  defectPillTextActive: {
    color: '#FFFFFF'
  }
});
