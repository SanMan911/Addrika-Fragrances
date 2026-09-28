import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch } from '../lib/api';
import { colors, radius, shadow, space, type } from '../lib/theme';

type Message = {
  id: string;
  author: 'retailer' | 'admin';
  author_name: string | null;
  body: string;
  created_at: string;
  is_origin: boolean;
};

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  order_number: string | null;
  closed_at: string | null;
  thread: Message[];
};

const fmt = (v: string) =>
  new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function GrievanceThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setTicket(await apiFetch<Ticket>(`/api/app/v2/grievances/${id}`, { auth: true }));
    } catch (e: any) {
      setError(e?.message || 'Could not load this grievance.');
    }
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function send() {
    if (body.trim().length < 2 || sending) return;
    setSending(true);
    try {
      await apiFetch(`/api/app/v2/grievances/${id}/reply`, {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not send your reply.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        testID="thread-loading"
      >
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  const isClosed = ticket?.status === 'closed';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.parchment }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        testID="grievance-thread-screen"
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}
      >
        {error ? (
          <Text testID="thread-error" style={{ ...type.small, color: colors.danger, marginBottom: space.sm }}>
            {error}
          </Text>
        ) : null}

        {ticket ? (
          <>
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: radius.md,
                padding: space.md,
                marginBottom: space.md,
                ...shadow.card,
              }}
            >
              <Text style={{ ...type.h2, color: colors.text }}>{ticket.subject}</Text>
              <Text style={{ ...type.small, color: colors.textMuted, marginTop: 3 }}>
                {ticket.category}
                {ticket.order_number ? ` · Order ${ticket.order_number}` : ''}
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: space.sm,
                  backgroundColor: isClosed ? colors.successBg : colors.warnBg,
                  borderRadius: radius.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text
                  testID="thread-status"
                  style={{
                    ...type.small,
                    fontWeight: '700',
                    color: isClosed ? colors.success : colors.warn,
                  }}
                >
                  {ticket.status.replace('_', ' ')}
                </Text>
              </View>
            </View>

            {ticket.thread.map((m) => {
              const mine = m.author === 'retailer';
              return (
                <View
                  key={m.id}
                  testID={`thread-msg-${m.id}`}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '86%',
                    backgroundColor: mine ? colors.white : colors.navy,
                    borderRadius: radius.md,
                    padding: space.md,
                    marginBottom: space.sm,
                    ...shadow.card,
                  }}
                >
                  <Text
                    style={{
                      ...type.micro,
                      color: mine ? colors.textMuted : colors.gold,
                    }}
                  >
                    {mine ? 'YOU' : 'AAROHMM TEAM'}
                    {m.is_origin ? ' · ORIGINAL COMPLAINT' : ''}
                  </Text>
                  <Text
                    style={{
                      ...type.body,
                      color: mine ? colors.text : colors.textOnDark,
                      marginTop: 5,
                      lineHeight: 21,
                    }}
                  >
                    {m.body}
                  </Text>
                  <Text
                    style={{
                      ...type.small,
                      color: mine ? colors.textMuted : colors.textOnDarkMuted,
                      marginTop: 6,
                      fontSize: 11,
                    }}
                  >
                    {fmt(m.created_at)}
                  </Text>
                </View>
              );
            })}

            {isClosed ? (
              <View
                testID="thread-closed-notice"
                style={{
                  backgroundColor: colors.successBg,
                  borderRadius: radius.md,
                  padding: space.md,
                  marginTop: space.sm,
                }}
              >
                <Text style={{ ...type.small, color: colors.success, fontWeight: '700' }}>
                  This grievance has been resolved and closed.
                </Text>
                <Text style={{ ...type.small, color: colors.textMuted, marginTop: 4 }}>
                  Need more help? Raise a new grievance from the More tab.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radius.md,
                  padding: space.md,
                  marginTop: space.sm,
                  ...shadow.card,
                }}
              >
                <TextInput
                  testID="thread-reply-input"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  placeholder="Write a reply…"
                  placeholderTextColor="#b4ada0"
                  style={{
                    backgroundColor: colors.parchment,
                    borderRadius: radius.sm,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm + 3,
                    fontSize: 15,
                    color: colors.text,
                    minHeight: 78,
                    textAlignVertical: 'top',
                  }}
                />
                <Pressable
                  testID="thread-send-reply"
                  disabled={body.trim().length < 2 || sending}
                  onPress={send}
                  style={{
                    marginTop: space.md,
                    backgroundColor: body.trim().length >= 2 ? colors.navy : colors.parchmentDim,
                    borderRadius: radius.pill,
                    paddingVertical: space.md,
                    alignItems: 'center',
                  }}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.gold} />
                  ) : (
                    <Text
                      style={{
                        ...type.label,
                        color: body.trim().length >= 2 ? colors.gold : colors.textMuted,
                      }}
                    >
                      Send reply
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
