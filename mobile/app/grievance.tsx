import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch } from '../lib/api';
import {
  fetchGrievances,
  fetchMyProfile,
  uploadGrievanceImage,
  type Grievance,
} from '../lib/data';
import { colors, radius, shadow, space, type } from '../lib/theme';

const CATEGORIES = [
  { key: 'damaged', label: 'Damaged goods' },
  { key: 'shortage', label: 'Short supply' },
  { key: 'billing', label: 'Billing' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'quality', label: 'Quality' },
  { key: 'other', label: 'Other' },
];

export default function GrievanceScreen() {
  const router = useRouter();
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [category, setCategory] = useState('damaged');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [localImages, setLocalImages] = useState<{ uri: string; mime: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Grievance[]>([]);

  useEffect(() => {
    fetchMyProfile()
      .then((p) => setRetailerId(p?.id ?? null))
      .catch(() => setRetailerId(null));
    fetchGrievances()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  async function pickImage() {
    if (localImages.length >= 6) {
      Alert.alert('Limit reached', 'You can attach up to 6 photos.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to attach images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setLocalImages((prev) => [...prev, { uri: a.uri, mime: a.mimeType || 'image/jpeg' }]);
  }

  async function submit() {
    if (!ready || busy) return;
    if (!retailerId) {
      Alert.alert('Not ready', 'We could not confirm your account. Please try again.');
      return;
    }
    setBusy(true);
    try {
      // Upload first: the ticket records the object paths, and storage RLS
      // confines every write to this retailer's own folder.
      const paths: string[] = [];
      for (const img of localImages) {
        paths.push(await uploadGrievanceImage(retailerId, img.uri, img.mime));
      }
      await apiFetch('/api/app/v2/grievances', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          order_number: orderNumber.trim() || null,
          image_paths: paths,
        }),
      });
      setSubject('');
      setMessage('');
      setOrderNumber('');
      setLocalImages([]);
      setHistory(await fetchGrievances());
      Alert.alert('Grievance raised', 'Our team will get back to you shortly.');
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const ready = subject.trim().length >= 3 && message.trim().length >= 5;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.parchment }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        testID="grievance-screen"
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
          <Text style={{ ...type.micro, color: colors.textMuted }}>CATEGORY</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                testID={`grievance-cat-${c.key}`}
                onPress={() => setCategory(c.key)}
                style={{
                  backgroundColor: category === c.key ? colors.navy : colors.parchment,
                  borderRadius: radius.pill,
                  paddingHorizontal: space.md,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{
                    ...type.small,
                    fontWeight: '700',
                    color: category === c.key ? colors.gold : colors.text,
                  }}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ ...type.label, color: colors.text, marginTop: space.lg, marginBottom: space.sm }}>
            Subject
          </Text>
          <TextInput
            testID="grievance-subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. 3 boxes crushed in transit"
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
            Order number (optional)
          </Text>
          <TextInput
            testID="grievance-order"
            value={orderNumber}
            onChangeText={setOrderNumber}
            placeholder="B2B-20260627-A1B2C3"
            placeholderTextColor="#b4ada0"
            autoCapitalize="characters"
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
            What happened?
          </Text>
          <TextInput
            testID="grievance-message"
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Describe the issue in a few lines"
            placeholderTextColor="#b4ada0"
            style={{
              backgroundColor: colors.parchment,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm + 3,
              fontSize: 15,
              color: colors.text,
              minHeight: 96,
              textAlignVertical: 'top',
            }}
          />

          <Text style={{ ...type.label, color: colors.text, marginTop: space.md, marginBottom: space.sm }}>
            Photos ({localImages.length}/6)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {localImages.map((img, i) => (
              <Pressable
                key={img.uri}
                testID={`grievance-image-${i}`}
                onPress={() => setLocalImages((p) => p.filter((x) => x.uri !== img.uri))}
              >
                <Image
                  source={{ uri: img.uri }}
                  style={{ width: 66, height: 66, borderRadius: radius.sm }}
                />
              </Pressable>
            ))}
            <Pressable
              testID="grievance-add-image"
              onPress={pickImage}
              style={{
                width: 66,
                height: 66,
                borderRadius: radius.sm,
                borderWidth: 1.5,
                borderColor: colors.parchmentDim,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.parchment,
              }}
            >
              <Text style={{ fontSize: 22, color: colors.navy }}>+</Text>
            </Pressable>
          </View>
          {localImages.length > 0 ? (
            <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.xs }}>
              Tap a photo to remove it.
            </Text>
          ) : null}

          <Pressable
            testID="grievance-submit"
            disabled={!ready || busy}
            onPress={submit}
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
                Submit grievance
              </Text>
            )}
          </Pressable>
        </View>

        {history.length > 0 ? (
          <>
            <Text style={{ ...type.micro, color: colors.textMuted, marginTop: space.lg, marginBottom: space.sm }}>
              YOUR PAST TICKETS
            </Text>
            {history.map((g) => (
              <Pressable
                key={g.id}
                testID={`grievance-history-${g.id}`}
                onPress={() => router.push({ pathname: '/grievance-thread', params: { id: g.id } })}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radius.md,
                  padding: space.md,
                  marginBottom: space.sm,
                  ...shadow.card,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ ...type.h2, color: colors.text, flex: 1, paddingRight: space.sm }}>
                    {g.subject}
                  </Text>
                  <View
                    style={{
                      backgroundColor: g.status === 'open' ? colors.warnBg : colors.successBg,
                      borderRadius: radius.pill,
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        ...type.small,
                        fontWeight: '700',
                        color: g.status === 'open' ? colors.warn : colors.success,
                      }}
                    >
                      {g.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.xs }}>
                  {g.category} · {new Date(g.created_at).toLocaleDateString('en-IN')}
                </Text>
                {g.admin_reply ? (
                  <View
                    style={{
                      marginTop: space.sm,
                      backgroundColor: colors.parchment,
                      borderRadius: radius.sm,
                      padding: space.sm + 2,
                    }}
                  >
                    <Text style={{ ...type.micro, color: colors.navy }}>AAROHMM REPLIED</Text>
                    <Text style={{ ...type.body, color: colors.text, marginTop: 4 }}>
                      {g.admin_reply}
                    </Text>
                  </View>
                ) : null}
                <Text style={{ ...type.small, color: colors.navy, fontWeight: '700', marginTop: space.sm }}>
                  Open conversation →
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
