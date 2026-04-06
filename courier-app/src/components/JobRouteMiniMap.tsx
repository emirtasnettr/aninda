import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { staticMapUri } from '../lib/geo/staticMapUri';
import { colors } from '../theme/colors';

type Props = {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  onPress: () => void;
};

export function JobRouteMiniMap({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  onPress,
}: Props) {
  const [imgErr, setImgErr] = useState(false);
  const centerLat = (pickupLat + deliveryLat) / 2;
  const centerLng = (pickupLng + deliveryLng) / 2;
  const markers = [
    { lat: pickupLat, lng: pickupLng, color: 'lightblue1' },
    { lat: deliveryLat, lng: deliveryLng, color: 'red1' },
  ];
  const uri = staticMapUri(centerLat, centerLng, 12, markers, '640x200');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      {!imgErr ? (
        <Image
          source={{ uri }}
          style={styles.img}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[styles.img, styles.fallback]}>
          <Ionicons name="map-outline" size={28} color={colors.muted} />
        </View>
      )}
      <View style={styles.overlay}>
        <Text style={styles.hint}>Alış → Teslim</Text>
        <Ionicons name="open-outline" size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 112,
    backgroundColor: colors.surfaceTint,
  },
  pressed: { opacity: 0.92 },
  img: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  hint: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
