import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton } from '../../src/components/CommonUI';
import {
  Layers,
  Scissors,
  CheckCircle2,
  ArrowRight,
  QrCode,
  UserCheck,
  Clock,
  Sparkles
} from 'lucide-react-native';

const STAGES = [
  { id: 'CUTTING', label: '1. Cutting', next: 'STITCHING', color: Colors.purple },
  { id: 'STITCHING', label: '2. Stitching', next: 'FINISHING', color: Colors.accent },
  { id: 'FINISHING', label: '3. Finishing', next: 'QC_INSPECTION', color: Colors.info },
  { id: 'QC_INSPECTION', label: '4. QC Inspection', next: 'IRONING_PACKING', color: Colors.warning },
  { id: 'IRONING_PACKING', label: '5. Ironing & Packing', next: 'COMPLETED', color: Colors.success },
  { id: 'COMPLETED', label: 'Completed', next: null, color: Colors.textMuted }
];

export default function ProductionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState('CUTTING');

  const { data: jobCardsData, isLoading, refetch } = useQuery({
    queryKey: ['job-cards', selectedStage],
    queryFn: async () => {
      const res = await api.get('/production/job-cards', { params: { stage: selectedStage } });
      return res.data.data;
    }
  });

  // Advance Stage Mutation
  const advanceMutation = useMutation({
    mutationFn: async ({ jobCardId, nextStage }: { jobCardId: string; nextStage: string }) => {
      const res = await api.post(`/production/job-cards/${jobCardId}/advance-stage`, {
        nextStage,
        completedQuantity: 1
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      Alert.alert('Stage Updated', `Job moved to ${data.jobCard?.currentStage}`);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to advance stage');
    }
  });

  const currentStageObj = STAGES.find(s => s.id === selectedStage);

  return (
    <View style={styles.container}>
      {/* Top Stage Horizontal Scroll Bar */}
      <View style={styles.stageTabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {STAGES.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSelectedStage(s.id)}
              style={[
                styles.stageTab,
                selectedStage === s.id && [styles.stageTabActive, { borderColor: s.color }]
              ]}
            >
              <Text
                style={[
                  styles.stageTabText,
                  selectedStage === s.id && styles.stageTabTextActive
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Action Header */}
      <View style={styles.actionHeader}>
        <Text style={styles.stageTitle}>{currentStageObj?.label} Stage</Text>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push('/production/scan')}
        >
          <QrCode size={16} color="#FFFFFF" />
          <Text style={styles.scanBtnText}>Scan Job QR</Text>
        </TouchableOpacity>
      </View>

      {/* Job Cards List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobCardsData || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.jobCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.jobCardNum}>{item.jobCardNumber}</Text>
                  <Text style={styles.orderRef}>
                    Order: {item.order?.orderNumber} • {item.order?.customer?.name}
                  </Text>
                </View>
                <Badge
                  label={item.priority}
                  variant={item.priority === 'URGENT' ? 'danger' : item.priority === 'HIGH' ? 'warning' : 'slate'}
                />
              </View>

              <View style={styles.itemDetailBox}>
                <Text style={styles.itemTitle}>
                  {item.plannedQuantity}x {item.orderItem?.customItemName}
                </Text>
                {item.orderItem?.color && (
                  <Text style={styles.itemSub}>Color: {item.orderItem.color}</Text>
                )}
              </View>

              {/* Worker Assignment & Stage Logs */}
              <View style={styles.metaRow}>
                <View style={styles.workerInfo}>
                  <UserCheck size={14} color={Colors.accent} />
                  <Text style={styles.workerName}>
                    {item.assignedWorker?.name || 'Unassigned Worker'}
                  </Text>
                </View>

                <View style={styles.timeInfo}>
                  <Clock size={13} color={Colors.textMuted} />
                  <Text style={styles.timeText}>
                    Started: {new Date(item.startedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {/* Stage Progression Action Buttons */}
              <View style={styles.cardActions}>
                {selectedStage === 'QC_INSPECTION' ? (
                  <AppButton
                    title="Open QC Inspection"
                    variant="accent"
                    onPress={() => router.push('/production/qc')}
                    icon={<CheckCircle2 size={16} color="#FFFFFF" />}
                    style={{ flex: 1 }}
                  />
                ) : currentStageObj?.next ? (
                  <AppButton
                    title={`Move to ${STAGES.find(s => s.id === currentStageObj.next)?.label}`}
                    variant="primary"
                    onPress={() =>
                      advanceMutation.mutate({
                        jobCardId: item.id,
                        nextStage: currentStageObj.next!
                      })
                    }
                    loading={advanceMutation.isPending}
                    icon={<ArrowRight size={16} color="#FFFFFF" />}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Badge label="Finished" variant="success" style={{ alignSelf: 'center' }} />
                )}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Layers size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Job Cards in {currentStageObj?.label}</Text>
              <Text style={styles.emptySub}>All garments in this stage have been progressed</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  stageTabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10
  },
  stageTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginRight: 8
  },
  stageTabActive: {
    backgroundColor: '#F1F5F9'
  },
  stageTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted
  },
  stageTabTextActive: {
    color: Colors.text
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  scanBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  listContent: {
    padding: 16,
    paddingTop: 8
  },
  jobCard: {
    padding: 14,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  jobCardNum: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  orderRef: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  itemDetailBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  itemSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  workerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  workerName: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600'
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  timeText: {
    fontSize: 11,
    color: Colors.textMuted
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4
  }
});
