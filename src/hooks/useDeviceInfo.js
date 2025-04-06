/**
 * Hook for accessing device information
 */
import { useState, useEffect, useCallback } from 'react';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import logger from '../utils/logger';

export default function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  /**
   * Collect device information
   */
  const collectDeviceInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare location object with default values
      let location = { coords: { latitude: null, longitude: null } };
      
      // Try to get location if permission is granted
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const locationData = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          location = locationData;
          logger.info('Location data collected');
        } else {
          logger.warning('Location permission denied');
        }
      } catch (locationError) {
        logger.warning(`Location error: ${locationError.message}`);
      }
      
      // Get network information
      const ipAddress = await Network.getIpAddressAsync();
      const networkState = await Network.getNetworkStateAsync();
      
      // Get device identifiers
      const deviceId = Device.osInternalBuildId || 
                       Device.osBuildId || 
                       Application.androidId || 
                       'unknown';
      
      // Calculate uptime in a readable format
      const uptimeMinutes = Math.floor(Device.uptime / 60);
      const uptime = uptimeMinutes > 60 
        ? `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}m` 
        : `${uptimeMinutes}m`;
      
      // Build device info object
      const info = {
        deviceName: Device.deviceName || 'Unknown device',
        brand: Device.brand || 'Unknown brand',
        model: Device.modelName || Device.modelId || 'Unknown model',
        osName: Device.osName || 'Android',
        osVersion: Device.osVersion || 'Unknown',
        osBuild: Device.osBuildId || 'Unknown',
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        appBuild: Application.nativeBuildVersion || '1',
        ipAddress: ipAddress || 'Unknown',
        networkType: networkState.type,
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
        location: location.coords || { latitude: null, longitude: null },
        deviceId: deviceId,
        uptime: uptime,
        memoryUsage: process.memoryUsage?.() || {},
        batteryLevel: 'Unknown', // Would require native module
        timestamp: new Date().toISOString()
      };
      
      setDeviceInfo(info);
      logger.debug('Device info collected successfully');
      return info;
    } catch (error) {
      const errorMsg = `Failed to collect device info: ${error.message}`;
      logger.error(errorMsg);
      setError(errorMsg);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Collect device info on mount
  useEffect(() => {
    collectDeviceInfo();
  }, [collectDeviceInfo]);
  
  return {
    deviceInfo,
    isLoading,
    error,
    refreshDeviceInfo: collectDeviceInfo
  };
}
