import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch } from '../lib/api';
import { MOBILE_BRAND_NAME } from '../lib/brand';
import { colors, radius, shadow, space, type } from '../lib/theme';

export default function SupportScreen() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = subject.trim().length >= 3 && message.trim().length >= 5;

  async function send() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await apiFetch('/api/app/v2/support/contact', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      setSubject('');
      setMessage('');
      Alert.alert('Message sent', `The ${MOBILE_BRAND_NAME} wholesale desk will reply by email.`);
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.parchment }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        testID="support-screen"
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.md,
            padding: space.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...type.h2, color: colors.text }}>Message the wholesale desk</Text>
          <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.xs, lineHeight: 18 }}>
            For pricing, dispatch timelines, credit terms or anything else. We
            reply to your registered email.
          </Text>

          <Text style={{ ...type.label, color: colors.text, marginTop: space.lg, marginBottom: space.sm }}>
            Subject
          </Text>
          <TextInput
            testID="support-subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Dispatch date for my last order"
            placeholderTextColor="#b4ada0"
            style={{
              backgroundColor: colors.parchment,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm + 3,
              fontSize: 15,
              color: colors.text,
            }}
          />

          <Text style={{ ...type.label, color: colors.text, marginTop: space.md, marginBottom: space.sm }}>
            Message
          </Text>
          <TextInput
            testID="support-message"
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Type your message"
            placeholderTextColor="#b4ada0"
            style={{
              backgroundColor: colors.parchment,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm + 3,
              fontSize: 15,
              color: colors.text,
              minHeight: 120,
              textAlignVertical: 'top',
            }}
          />

          <Pressable
            testID="support-send"
            disabled={!ready || busy}
            onPress={send}
            style={{
              marginTop: space.lg,
              backgroundColor: ready ? colors.navy : colors.parchmentDim,
              borderRadius: radius.pill,
              paddingVertical: space.md + 2,
              alignItems: 'center',
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Text style={{ ...type.label, fontSize: 15, color: ready ? colors.gold : colors.textMuted }}>
                Send message
              </Text>
            )}
          </Pressable>
        </View>

        <Text
          style={{
            ...type.small,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: space.lg,
            lineHeight: 18,
          }}
        >
          Or email contact.us@centraders.com directly.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
