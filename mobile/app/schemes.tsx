import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { fetchSchemes, type Scheme } from '../lib/data';
import { colors, radius, shadow, space, type } from '../lib/theme';

export default function SchemesScreen() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchemes()
      .then(setSchemes)
      .catch((e: any) => setError(e?.message || 'Could not load schemes.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="schemes-loading">
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      testID="schemes-screen"
      style={{ flex: 1, backgroundColor: colors.parchment }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
    >
      {error ? (
        <Text testID="schemes-error" style={{ ...type.small, color: colors.danger }}>
          {error}
        </Text>
      ) : null}

      {schemes.length === 0 && !error ? (
        <View testID="schemes-empty" style={{ marginTop: space.xl, alignItems: 'center' }}>
          <Text style={{ ...type.h1, color: colors.text, textAlign: 'center' }}>
            No schemes running right now
          </Text>
          <Text
            style={{
              ...type.body,
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: space.sm,
              lineHeight: 21,
            }}
          >
            When Aarohmm publishes a trade offer it will appear here, and your
            order pad will price it automatically.
          </Text>
        </View>
      ) : null}

      {schemes.map((s) => (
        <View
          key={s.id}
          testID={`scheme-card-${s.id}`}
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.md,
            padding: space.md,
            marginBottom: space.sm,
            ...shadow.card,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ ...type.h2, color: colors.text, flex: 1, paddingRight: space.sm }}>
              {s.title}
            </Text>
            {s.discount_pct ? (
              <View
                style={{
                  backgroundColor: colors.navy,
                  borderRadius: radius.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ ...type.small, color: colors.gold, fontWeight: '700' }}>
                  {s.discount_pct}% off
                </Text>
              </View>
            ) : null}
          </View>
          {s.description ? (
            <Text style={{ ...type.body, color: colors.textMuted, marginTop: space.sm, lineHeight: 21 }}>
              {s.description}
            </Text>
          ) : null}
          {s.min_boxes ? (
            <Text style={{ ...type.small, color: colors.navy, marginTop: space.sm, fontWeight: '700' }}>
              Applies automatically on {s.min_boxes} boxes or more
            </Text>
          ) : s.min_cartons ? (
            <Text style={{ ...type.small, color: colors.navy, marginTop: space.sm, fontWeight: '700' }}>
              Minimum {s.min_cartons} cartons
            </Text>
          ) : (
            <Text style={{ ...type.small, color: colors.navy, marginTop: space.sm, fontWeight: '700' }}>
              Applied automatically at checkout
            </Text>
          )}
          {s.valid_to ? (
            <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.xs }}>
              Valid till {new Date(s.valid_to).toLocaleDateString('en-IN')}
            </Text>
          ) : null}
          {s.terms ? (
            <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.sm, fontStyle: 'italic' }}>
              {s.terms}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
