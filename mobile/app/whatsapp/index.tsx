import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  MessageSquare,
  Send,
  Sliders,
  History,
  FileText,
  CheckCheck,
  AlertCircle,
  ExternalLink,
  Phone,
  ShieldCheck,
  Save,
  Clock,
  Sparkles
} from 'lucide-react-native';

type TabType = 'messages' | 'templates' | 'quickSend' | 'settings';

export default function WhatsAppHubScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('messages');

  // Quick Send Form State
  const [quickPhone, setQuickPhone] = useState('');
  const [quickCustomer, setQuickCustomer] = useState('');
  const [quickCategory, setQuickCategory] = useState('ORDER_CONFIRM');
  const [quickCustomText, setQuickCustomText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Settings State
  const [ownerPhone, setOwnerPhone] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Template Editing State
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editedBody, setEditedBody] = useState('');

  // 1. Fetch Config
  const { data: configData, isLoading: isConfigLoading } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const res = await api.get('/whatsapp/config');
      const data = res.data.data;
      setOwnerPhone(data.ownerWhatsApp || '');
      setPhoneId(data.phoneNumberId || '');
      setAccountId(data.businessAccountId || '');
      return data;
    }
  });

  // 2. Fetch Messages
  const { data: messagesData, isLoading: isMessagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['whatsapp-messages'],
    queryFn: async () => {
      const res = await api.get('/whatsapp/messages');
      return res.data.data.messages;
    }
  });

  // 3. Fetch Templates
  const { data: templatesData, isLoading: isTemplatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const res = await api.get('/whatsapp/templates');
      return res.data.data;
    }
  });

  // Save Settings Mutation
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await api.post('/whatsapp/config', {
        ownerWhatsApp: ownerPhone,
        phoneNumberId: phoneId,
        businessAccountId: accountId,
        apiToken: apiToken || undefined
      });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      Alert.alert('Settings Saved', 'WhatsApp configuration updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Quick Send Action
  const handleQuickSend = async () => {
    if (!quickPhone || quickPhone.length < 10) {
      Alert.alert('Phone Required', 'Please enter a valid 10-digit customer mobile number.');
      return;
    }

    setIsSending(true);
    try {
      let res;
      if (quickCategory === 'CUSTOM') {
        if (!quickCustomText.trim()) {
          Alert.alert('Message Required', 'Please type a message to send.');
          setIsSending(false);
          return;
        }
        res = await api.post('/whatsapp/send-text', {
          to: quickPhone,
          recipientName: quickCustomer || 'Customer',
          text: quickCustomText
        });
      } else {
        res = await api.post('/whatsapp/send-template', {
          to: quickPhone,
          recipientName: quickCustomer || 'Customer',
          templateCategory: quickCategory,
          variables: {
            customer_name: quickCustomer || 'Valued Customer',
            order_number: 'ORD-101',
            invoice_number: 'INV-101',
            amount: '2,500',
            paid: '1,000',
            balance: '1,500',
            delivery_date: new Date().toISOString().split('T')[0]
          }
        });
      }

      if (res.data.data?.waLink && res.data.data?.provider !== 'WHATSAPP_BUSINESS_API') {
        Linking.openURL(res.data.data.waLink);
      }

      Alert.alert('Sent', 'WhatsApp message processed and logged to Message History!');
      refetchMessages();
      setQuickCustomText('');
    } catch (err: any) {
      Alert.alert('Send Error', err.response?.data?.error || err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Save Template Action
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editedBody.trim()) return;
    try {
      await api.post('/whatsapp/templates', {
        category: editingTemplate.category,
        name: editingTemplate.name,
        bodyText: editedBody
      });
      Alert.alert('Success', 'Template updated successfully!');
      setEditingTemplate(null);
      refetchTemplates();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>WhatsApp Message Center</Text>
          <Text style={styles.subtitle}>
            Cloud API delivery & Web links for invoices, receipts & production alerts
          </Text>
        </View>
        <Badge
          label={configData?.isConfigured ? 'API Connected' : 'Web Link Mode'}
          variant={configData?.isConfigured ? 'success' : 'purple'}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { id: 'messages', label: 'History', icon: <History size={14} color={activeTab === 'messages' ? '#FFF' : Colors.textMuted} /> },
          { id: 'templates', label: 'Templates', icon: <FileText size={14} color={activeTab === 'templates' ? '#FFF' : Colors.textMuted} /> },
          { id: 'quickSend', label: 'Quick Send', icon: <Send size={14} color={activeTab === 'quickSend' ? '#FFF' : Colors.textMuted} /> },
          { id: 'settings', label: 'Settings', icon: <Sliders size={14} color={activeTab === 'settings' ? '#FFF' : Colors.textMuted} /> }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as TabType)}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
          >
            {tab.icon}
            <Text style={[styles.tabItemText, activeTab === tab.id && styles.tabItemTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TAB 1: MESSAGE HISTORY LOGS */}
      {activeTab === 'messages' && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          {isMessagesLoading ? (
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
          ) : messagesData && messagesData.length > 0 ? (
            messagesData.map((msg: any) => (
              <Card key={msg.id} style={styles.msgCard}>
                <View style={styles.msgHeader}>
                  <View>
                    <Text style={styles.msgRecipient}>{msg.recipientName || 'Customer'} (📞 {msg.recipientPhone})</Text>
                    <Text style={styles.msgTime}>
                      {new Date(msg.createdAt).toLocaleString()} • {msg.provider === 'WHATSAPP_BUSINESS_API' ? 'Cloud API' : 'Web Fallback'}
                    </Text>
                  </View>
                  <Badge
                    label={msg.status}
                    variant={msg.status === 'SENT' || msg.status === 'DELIVERED' ? 'success' : msg.status === 'FAILED' ? 'danger' : 'warning'}
                  />
                </View>
                <View style={styles.msgBodyBox}>
                  <Text style={styles.msgBodyText}>{msg.messageText}</Text>
                </View>
                {msg.failureReason && (
                  <Text style={styles.failureText}>⚠️ Reason: {msg.failureReason}</Text>
                )}
              </Card>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <MessageSquare size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No messages sent yet</Text>
              <Text style={styles.emptySub}>Messages sent for invoices, orders, and receipts will appear here.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* TAB 2: TEMPLATES */}
      {activeTab === 'templates' && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.sectionHeading}>Standard Notification Templates (8 Categories)</Text>
          <Text style={styles.sectionSub}>
            Variables like <Text style={{ color: Colors.accent, fontWeight: '700' }}>{'{{customer_name}}'}</Text>,{' '}
            <Text style={{ color: Colors.accent, fontWeight: '700' }}>{'{{order_number}}'}</Text>,{' '}
            <Text style={{ color: Colors.accent, fontWeight: '700' }}>{'{{amount}}'}</Text>,{' '}
            <Text style={{ color: Colors.accent, fontWeight: '700' }}>{'{{balance}}'}</Text> are automatically replaced.
          </Text>

          {isTemplatesLoading ? (
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
          ) : (
            templatesData?.map((tpl: any) => (
              <Card key={tpl.id} style={styles.templateCard}>
                <View style={styles.templateHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tplName}>{tpl.name}</Text>
                    <Text style={styles.tplCategory}>Category: {tpl.category}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => {
                      setEditingTemplate(tpl);
                      setEditedBody(tpl.bodyText);
                    }}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.tplBodyPreview}>
                  <Text style={styles.tplBodyPreviewText}>{tpl.bodyText}</Text>
                </View>
              </Card>
            ))
          )}

          {/* Template Edit Modal / Drawer */}
          {editingTemplate && (
            <Card style={styles.editorCard}>
              <Text style={styles.editorTitle}>Edit: {editingTemplate.name}</Text>
              <AppInput
                value={editedBody}
                onChangeText={setEditedBody}
                multiline
                numberOfLines={6}
                placeholder="Template text with {{variables}}..."
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AppButton
                  title="Cancel"
                  variant="outline"
                  onPress={() => setEditingTemplate(null)}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="Save Template"
                  variant="accent"
                  onPress={handleSaveTemplate}
                  icon={<Save size={15} color="#FFFFFF" />}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}
        </ScrollView>
      )}

      {/* TAB 3: QUICK SEND */}
      {activeTab === 'quickSend' && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          <Card style={{ padding: 16 }}>
            <Text style={styles.sectionHeading}>Send Direct WhatsApp Message</Text>

            <AppInput
              label="Recipient Mobile Number (10 digits)"
              placeholder="e.g. 9876543210"
              value={quickPhone}
              onChangeText={setQuickPhone}
              keyboardType="phone-pad"
            />

            <AppInput
              label="Customer Name (Optional)"
              placeholder="e.g. Rahul Sharma"
              value={quickCustomer}
              onChangeText={setQuickCustomer}
            />

            <Text style={styles.fieldLabel}>Select Template or Custom</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {[
                { id: 'ORDER_CONFIRM', label: 'Order Confirm' },
                { id: 'INVOICE', label: 'Tax Invoice' },
                { id: 'PAYMENT_RECEIPT', label: 'Payment Receipt' },
                { id: 'PAYMENT_REMINDER', label: 'Payment Due' },
                { id: 'ORDER_READY', label: 'Order Ready' },
                { id: 'THANK_YOU', label: 'Thank You' },
                { id: 'CUSTOM', label: 'Custom Text' }
              ].map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setQuickCategory(c.id)}
                  style={[styles.categoryChip, quickCategory === c.id && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, quickCategory === c.id && styles.categoryChipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {quickCategory === 'CUSTOM' && (
              <AppInput
                label="Custom Message Body"
                placeholder="Type your message..."
                value={quickCustomText}
                onChangeText={setQuickCustomText}
                multiline
                numberOfLines={4}
              />
            )}

            <AppButton
              title="Send via WhatsApp"
              onPress={handleQuickSend}
              variant="success"
              loading={isSending}
              icon={<Send size={16} color="#FFFFFF" />}
              style={{ marginTop: 8 }}
            />
          </Card>
        </ScrollView>
      )}

      {/* TAB 4: SETTINGS & OWNER NUMBER */}
      {activeTab === 'settings' && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          <Card style={{ padding: 16 }}>
            <View style={styles.settingsSectionHeader}>
              <Phone size={20} color={Colors.accent} />
              <Text style={styles.sectionHeading}>1. Owner / Boutique WhatsApp Copy</Text>
            </View>
            <Text style={styles.settingsExplainer}>
              When clicking "Send to My WhatsApp" on invoices or orders, messages will be delivered to this number:
            </Text>
            <AppInput
              label="Owner WhatsApp Number"
              placeholder="e.g. 9876543210 (10 digits)"
              value={ownerPhone}
              onChangeText={setOwnerPhone}
              keyboardType="phone-pad"
            />
          </Card>

          <Card style={{ padding: 16, marginTop: 12 }}>
            <View style={styles.settingsSectionHeader}>
              <ShieldCheck size={20} color={Colors.primary} />
              <Text style={styles.sectionHeading}>2. Meta WhatsApp Cloud API (Optional)</Text>
            </View>
            <Text style={styles.settingsExplainer}>
              Connect your Meta Business WhatsApp Cloud API for automated background sending. If left blank, the system automatically uses instant web/app links.
            </Text>

            <AppInput
              label="Phone Number ID"
              placeholder="e.g. 104829381928374"
              value={phoneId}
              onChangeText={setPhoneId}
            />

            <AppInput
              label="WhatsApp Business Account ID"
              placeholder="e.g. 293847291039485"
              value={accountId}
              onChangeText={setAccountId}
            />

            <AppInput
              label="Permanent System User API Token"
              placeholder={configData?.hasToken ? '•••••••••••••••• (Token configured)' : 'Paste EAAG... token'}
              value={apiToken}
              onChangeText={setApiToken}
              secureTextEntry
            />

            <AppButton
              title="Save WhatsApp Settings"
              onPress={handleSaveSettings}
              variant="primary"
              loading={isSavingSettings}
              icon={<Save size={16} color="#FFFFFF" />}
              style={{ marginTop: 8 }}
            />
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    padding: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8
  },
  tabItemActive: {
    backgroundColor: Colors.primary
  },
  tabItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  tabItemTextActive: {
    color: '#FFFFFF'
  },
  msgCard: {
    padding: 14,
    marginBottom: 10
  },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  msgRecipient: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  msgTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  msgBodyBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  msgBodyText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18
  },
  failureText: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 6
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 14,
    lineHeight: 16
  },
  templateCard: {
    padding: 14,
    marginBottom: 10
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  tplName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text
  },
  tplCategory: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 6
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary
  },
  tplBodyPreview: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6
  },
  tplBodyPreviewText: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16
  },
  editorCard: {
    padding: 14,
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  editorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.border
  },
  categoryChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  categoryChipTextActive: {
    color: '#FFFFFF'
  },
  settingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  settingsExplainer: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 12,
    lineHeight: 16
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 10
  },
  emptySub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20
  }
});
