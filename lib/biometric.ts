import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export type BiometricType = 'face' | 'fingerprint' | 'none';

export async function getBiometricType(): Promise<BiometricType> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return 'none';
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return 'none';
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  return 'none';
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return val === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Identität bestätigen',
    fallbackLabel: 'Passwort verwenden',
    cancelLabel: 'Abbrechen',
  });
  return result.success;
}
