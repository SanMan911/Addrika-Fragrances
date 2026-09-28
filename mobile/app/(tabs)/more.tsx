import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { FontAwesome } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { fetchMyProfile, type RetailerProfile } from '../../lib/data';
import { useAuth } from '../../lib/auth';
import { MOBILE_BRAND_NAME } from '../../lib/brand';
import { colors, radius, shadow, space, type } from '../../lib/theme';

function MenuItem({
  icon,
  label,
  hint,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  hint?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
        backgroundColor: colors.white,
        borderRadius: radius.md,
        marginBottom: space.sm,
        ...shadow.card,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.pill,
          backgroundColor: colors.parchment,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FontAwesome name={icon} size={16} color={colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.h2, color: colors.text }}>{label}</Text>
        {hint ? (
          <Text style={{ ...type.small, color: colors.textMuted, marginTop: 1 }}>{hint}</Text>
        ) : null}
      </View>
      <FontAwesome name="angle-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<RetailerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const webUrl = (Constants.expoConfig?.extra?.webUrl as string) || 'https://www.centraders.com';

  async function openBrochure() {
    router.push('/brochure');
  }

  return (
    <ScrollView
      testID="more-screen"
      style={{ flex: 1, backgroundColor: colors.parchment }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
    >
      <View
        testID="more-profile-card"
        style={{
          backgroundColor: colors.navy,
          borderRadius: radius.lg,
          padding: space.lg,
          marginBottom: space.lg,
        }}
      >
        <Text style={{ ...type.micro, color: colors.gold }}>SIGNED IN AS</Text>
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: space.sm }} />
        ) : (
          <>
            <Text style={{ ...type.h1, color: colors.parchment, marginTop: space.sm }}>
              {profile?.business_name || 'Aarohmm Retailer'}
            </Text>
            <Text style={{ ...type.small, color: colors.textOnDarkMuted, marginTop: 4 }}>
              Login ID (GSTIN): {profile?.gstin || '—'}
            </Text>
            <Text style={{ ...type.small, color: colors.textOnDarkMuted, marginTop: 2 }}>
              {[profile?.city, profile?.state].filter(Boolean).join(', ') || '—'}
            </Text>
          </>
        )}
      </View>

      <Text style={{ ...type.micro, color: colors.textMuted, marginBottom: space.sm }}>
        TRADE
      </Text>
      <MenuItem
        testID="more-schemes"
        icon="tags"
        label="Trade schemes"
        hint="Current offers and slab discounts"
        onPress={() => router.push('/schemes')}
      />
      <MenuItem
        testID="more-brochure"
        icon="book"
        label="Product brochure"
        hint="Fragrance notes, details and trade prices"
        onPress={openBrochure}
      />

      <Text style={{ ...type.micro, color: colors.textMuted, marginTop: space.md, marginBottom: space.sm }}>
        SUPPORT
      </Text>
      <MenuItem
        testID="more-grievance"
        icon="exclamation-triangle"
        label="Raise a grievance"
        hint="Damages, shortages, billing — attach photos"
        onPress={() => router.push('/grievance')}
      />
      <MenuItem
        testID="more-contact"
        icon="envelope"
        label={`Contact ${MOBILE_BRAND_NAME}`}
        hint="Message the wholesale desk"
        onPress={() => router.push('/support')}
      />
      <MenuItem
        testID="more-web"
        icon="globe"
        label="Open the web portal"
        hint="Invoices, KYC and rewards"
        onPress={() => WebBrowser.openBrowserAsync(webUrl)}
      />

      <Pressable
        testID="more-signout"
        onPress={() =>
          Alert.alert('Sign out?', 'You will need a fresh code to sign back in.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
          ])
        }
        style={{
          marginTop: space.lg,
          borderWidth: 1.5,
          borderColor: colors.danger,
          borderRadius: radius.pill,
          paddingVertical: space.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ ...type.label, color: colors.danger }}>Sign out</Text>
      </Pressable>

      <Text
        style={{
          ...type.small,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: space.lg,
        }}
      >
        {MOBILE_BRAND_NAME} · v{Constants.expoConfig?.version || '—'}
      </Text>
    </ScrollView>
  );
}
