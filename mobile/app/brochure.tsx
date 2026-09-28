import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { colors, inr, radius, shadow, space, type } from '../lib/theme';

type Item = {
  sku: string;
  name: string;
  category: string | null;
  size_label: string | null;
  image_url: string | null;
  detail: string | null;
  notes: string | null;
  mrp: number | null;
  b2b_price: number | null;
};

export default function BrochureScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: Item[] }>('/api/app/v2/brochure', { auth: true })
      .then((d) => setItems(d.items || []))
      .catch((e: any) => setError(e?.message || 'Could not load the brochure.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="brochure-loading">
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      testID="brochure-screen"
      style={{ flex: 1, backgroundColor: colors.parchment }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
    >
      {error ? (
        <Text testID="brochure-error" style={{ ...type.small, color: colors.danger }}>
          {error}
        </Text>
      ) : null}

      {items.length === 0 && !error ? (
        <Text
          testID="brochure-empty"
          style={{ ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xl }}
        >
          The brochure is being prepared. Please check back shortly.
        </Text>
      ) : null}

      {items.map((i) => (
        <View
          key={i.sku}
          testID={`brochure-card-${i.sku}`}
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.md,
            marginBottom: space.md,
            overflow: 'hidden',
            ...shadow.card,
          }}
        >
          {i.image_url ? (
            <Image
              source={{ uri: i.image_url }}
              style={{ width: '100%', height: 190, backgroundColor: colors.parchmentDim }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ padding: space.md }}>
            <Text style={{ ...type.h2, color: colors.text }}>{i.name}</Text>
            {i.notes ? (
              <Text style={{ ...type.small, color: colors.navy, marginTop: 4, fontWeight: '700' }}>
                {i.notes}
              </Text>
            ) : null}
            {i.detail ? (
              <Text style={{ ...type.body, color: colors.textMuted, marginTop: space.sm, lineHeight: 21 }}>
                {i.detail}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: space.md,
                paddingTop: space.sm,
                borderTopWidth: 1,
                borderTopColor: colors.parchmentDim,
              }}
            >
              <Text style={{ ...type.small, color: colors.textMuted }}>
                {[i.size_label, i.category].filter(Boolean).join(' · ')}
              </Text>
              <Text style={{ ...type.label, color: colors.navy }}>
                {inr(i.b2b_price)} <Text style={{ ...type.small, color: colors.textMuted }}>/box</Text>
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
