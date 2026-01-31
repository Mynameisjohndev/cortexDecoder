import React, { useEffect, useRef, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

import {
  CDCamera,
  CDCameraView,
  CDDecoder,
  CDLicense,
  CDResult,
} from 'cortex-decoder-react-native';

type ScannerType = 'cortex' | 'vision';

function ScannerScreen() {
  const insets = useSafeAreaInsets();

  const [scannerType, setScannerType] = useState<ScannerType>('cortex');
  const [lastResult, setLastResult] = useState('');
  const [androidPermission, setAndroidPermission] = useState(
    Platform.OS !== 'android'
  );

  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const licenseActivatedRef = useRef(false);

  /* ======================
     VISION CAMERA
  ====================== */

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (codes.length > 0) {
        setLastResult(codes[0].value ?? '');
      }
    },
  });

  /* ======================
     CORTEX
  ====================== */

  const ensureLicenseActivated = async () => {
    if (licenseActivatedRef.current) return;

    const customerId =
      process.env.EXPO_PUBLIC_CORTEX_CUSTOMER_ID ?? 'ReplaceExpirationLib';
    const licenseKey = process.env.EXPO_PUBLIC_CORTEX_LICENSE_KEY;

    if (!licenseKey) {
      throw new Error('Missing EXPO_PUBLIC_CORTEX_LICENSE_KEY');
    }

    CDLicense.setCustomerId(customerId);
    await CDLicense.activateLicense(licenseKey);
    licenseActivatedRef.current = true;
  };

  const startCortex = async () => {
    await ensureLicenseActivated();

    if (!subscriptionRef.current) {
      subscriptionRef.current = CDDecoder.addListener(
        'onDecodeResult',
        (results: CDResult[]) => {
          if (results?.[0]?.status === CDResult.CDDecodeStatus.success) {
            setLastResult(results[0].barcodeData);
          }
        }
      );
    }

    CDCamera.startCamera();
    CDCamera.startPreview();
    CDCamera.setVideoCapturing(true);
    CDDecoder.setDecoding(true);
  };

  const stopAllCameras = () => {
    try {
      CDDecoder.setDecoding(false);
      CDCamera.setVideoCapturing(false);
      CDCamera.stopPreview();
      CDCamera.stopCamera();
    } catch {}

    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  };

  /* ======================
     PERMISSÕES
  ====================== */

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        setAndroidPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      }

      if (!hasPermission) {
        await requestPermission();
      }
    })();
  }, []);

  /* ======================
     CONTROLE DE TROCA
  ====================== */

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      stopAllCameras();
      if (!mounted) return;

      if (scannerType === 'cortex') {
        await startCortex();
      }
    };

    start();

    return () => {
      mounted = false;
      stopAllCameras();
    };
  }, [scannerType]);

  /* ======================
     UI
  ====================== */

  if (!androidPermission || !hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Permissão de câmera não concedida</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* CAMERA */}
      {scannerType === 'cortex' ? (
        <CDCameraView style={StyleSheet.absoluteFillObject} />
      ) : (
        device && (
          <Camera
            style={StyleSheet.absoluteFillObject}
            device={device}
            isActive={true}
            codeScanner={codeScanner}
          />
        )
      )}

      {/* OVERLAY */}
      <View
        style={[
          styles.overlay,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.switchRow}>
          <Pressable
            style={[
              styles.switchButton,
              scannerType === 'cortex' && styles.active,
            ]}
            onPress={() => {
              setLastResult('');
              setScannerType('cortex');
            }}
          >
            <Text style={styles.switchText}>CORTEX</Text>
          </Pressable>

          <Pressable
            style={[
              styles.switchButton,
              scannerType === 'vision' && styles.active,
            ]}
            onPress={() => {
              setLastResult('');
              setScannerType('vision');
            }}
          >
            <Text style={styles.switchText}>VISION</Text>
          </Pressable>
        </View>

        {!!lastResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{lastResult}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ScannerScreen />
    </SafeAreaProvider>
  );
}

/* ======================
   STYLES
====================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    gap: 12,
  },

  switchRow: {
    flexDirection: 'row',
    gap: 12,
  },

  switchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1f2937',
    alignItems: 'center',
  },

  active: {
    backgroundColor: '#2563eb',
  },

  switchText: {
    color: '#fff',
    fontWeight: '600',
  },

  resultBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 12,
  },

  resultText: { color: '#fff' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
