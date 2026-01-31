import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

type ScreenState = 'idle' | 'scanning' | 'result';
type ScannerType = 'cortex' | 'vision';

function ScannerScreen() {
  const [state, setState] = useState<ScreenState>('idle');
  const [scannerType, setScannerType] = useState<ScannerType>('cortex');
  const [result, setResult] = useState('');

  const [androidPermission, setAndroidPermission] = useState(
    Platform.OS !== 'android'
  );

  /* ======================
     VISION CAMERA
  ====================== */

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (codes[0]?.value) {
        setResult(codes[0].value);
        setState('result');
      }
    },
  });

  /* ======================
     CORTEX
  ====================== */

  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const licenseActivatedRef = useRef(false);

  const ensureLicenseActivated = async () => {
    if (licenseActivatedRef.current) return;

    const customerId =
      process.env.EXPO_PUBLIC_CORTEX_CUSTOMER_ID ?? 'ReplaceExpirationLib';
    const licenseKey = process.env.EXPO_PUBLIC_CORTEX_LICENSE_KEY;

    if (!licenseKey) throw new Error('Missing Cortex license key');

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
            setResult(results[0].barcodeData);
            stopAll();
            setState('result');
          }
        }
      );
    }

    CDCamera.startCamera();
    CDCamera.startPreview();
    CDCamera.setVideoCapturing(true);
    CDDecoder.setDecoding(true);
  };

  /* ======================
     CONTROLE GERAL
  ====================== */

  const stopAll = () => {
    try {
      // Cortex
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

    return stopAll;
  }, []);

  if (!androidPermission || !hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Permissão de câmera não concedida</Text>
      </View>
    );
  }

  /* ======================
     UI
  ====================== */

  return (
    <View style={styles.container}>
      {/* IDLE */}
      {state === 'idle' && (
        <View style={styles.center}>
          <Ionicons name="qr-code-outline" size={96} color="#2563eb" />
          <Text style={styles.title}>Leitor de QR Code</Text>

          {/* Seletor */}
          <View style={styles.switchRow}>
            {(['cortex', 'vision'] as ScannerType[]).map(type => (
              <Pressable
                key={type}
                style={[
                  styles.switchButton,
                  scannerType === type && styles.active,
                ]}
                onPress={() => setScannerType(type)}
              >
                <Text style={styles.switchText}>
                  {type.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={async () => {
              setResult('');
              setState('scanning');

              if (scannerType === 'cortex') {
                await startCortex();
              }
            }}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.primaryText}>Ler QR Code</Text>
          </Pressable>
        </View>
      )}

      {/* SCANNING */}
      {state === 'scanning' && (
        <>
          {scannerType === 'cortex' ? (
            <CDCameraView style={StyleSheet.absoluteFillObject} />
          ) : (
            device && (
              <Camera
                style={StyleSheet.absoluteFillObject}
                device={device}
                isActive
                codeScanner={codeScanner}
              />
            )
          )}

          <Pressable
            style={styles.closeButton}
            onPress={() => {
              stopAll();
              setState('idle');
            }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </>
      )}

      {/* RESULT */}
      {state === 'result' && (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={96} color="#16a34a" />
          <Text style={styles.title}>QR Code lido</Text>

          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{result}</Text>
          </View>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => setState('idle')}
          >
            <Text style={styles.secondaryText}>Ler outro QR</Text>
          </Pressable>
        </View>
      )}
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
  container: { flex: 1, backgroundColor: '#0f172a' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },

  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  switchRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  switchButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#1f2937',
  },

  active: {
    backgroundColor: '#2563eb',
  },

  switchText: {
    color: '#fff',
    fontWeight: '600',
  },

  primaryButton: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
  },

  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  secondaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },

  secondaryText: {
    color: '#cbd5f5',
  },

  resultBox: {
    marginTop: 12,
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },

  resultText: {
    color: '#e5e7eb',
    textAlign: 'center',
  },

  closeButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
  },
});
