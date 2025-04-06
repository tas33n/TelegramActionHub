/**
 * Service for device-related operations
 */
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Battery from 'expo-battery';
import * as Cellular from 'expo-cellular';
import * as Network from 'expo-network';
import * as ScreenCapture from 'expo-screen-capture';
import * as FileSystem from 'expo-file-system';
import logger from '../utils/logger';

/**
 * Get complete device information
 * @returns {Promise<Object>} Device information
 */
export const getDeviceInfo = async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    const ipAddress = await Network.getIpAddressAsync();
    
    let batteryLevel = 'unknown';
    try {
      batteryLevel = `${Math.round((await Battery.getBatteryLevelAsync()) * 100)}%`;
    } catch (error) {
      logger.warning(`Battery info error: ${error.message}`);
    }
    
    let cellularInfo = {};
    try {
      if (Device.osName === 'Android') {
        const carrier = await Cellular.getCarrierNameAsync();
        const mobileCountryCode = await Cellular.getMobileCountryCodeAsync();
        const mobileNetworkCode = await Cellular.getMobileNetworkCodeAsync();
        
        cellularInfo = {
          carrier,
          mobileCountryCode,
          mobileNetworkCode
        };
      }
    } catch (error) {
      logger.warning(`Cellular info error: ${error.message}`);
    }
    
    // Calculate uptime in a readable format
    const uptimeSeconds = Device.uptime;
    let uptime = '';
    
    if (uptimeSeconds < 60) {
      uptime = `${Math.round(uptimeSeconds)}s`;
    } else if (uptimeSeconds < 3600) {
      uptime = `${Math.floor(uptimeSeconds / 60)}m ${Math.round(uptimeSeconds % 60)}s`;
    } else {
      uptime = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;
    }
    
    const deviceInfo = {
      // Device hardware
      deviceName: Device.deviceName || 'Unknown device',
      brand: Device.brand || 'Unknown',
      manufacturer: Device.manufacturer || 'Unknown',
      modelName: Device.modelName || 'Unknown',
      designName: Device.designName || 'Unknown',
      productName: Device.productName || 'Unknown',
      deviceYearClass: Device.deviceYearClass || 'Unknown',
      totalMemory: Device.totalMemory 
        ? `${Math.round(Device.totalMemory / (1024 * 1024))} MB` 
        : 'Unknown',
      supportedCpuArchitectures: Device.supportedCpuArchitectures || ['Unknown'],
      isDevice: Device.isDevice,
      
      // OS info
      osName: Device.osName || 'Android',
      osVersion: Device.osVersion || 'Unknown',
      osBuildId: Device.osBuildId || 'Unknown',
      osInternalBuildId: Device.osInternalBuildId || 'Unknown',
      osBuildFingerprint: Device.osBuildFingerprint || 'Unknown',
      
      // App info
      appName: Application.applicationName || 'Telegram Monitor',
      appVersion: Application.nativeApplicationVersion || '1.0.0',
      appBuildVersion: Application.nativeBuildVersion || '1',
      appInstallationTime: Application.installationTimeAsync 
        ? new Date(await Application.installationTimeAsync()).toLocaleString() 
        : 'Unknown',
      
      // Network
      ipAddress,
      networkType: networkState.type,
      isConnected: networkState.isConnected,
      isInternetReachable: networkState.isInternetReachable,
      
      // Power
      batteryLevel,
      
      // Other
      uptime,
      timestamp: new Date().toISOString(),
      
      // Cellular (Android only)
      ...cellularInfo
    };
    
    logger.info('Device info collected');
    return deviceInfo;
  } catch (error) {
    logger.error(`Failed to get device info: ${error.message}`);
    throw error;
  }
};

/**
 * Format device info as a string
 * @param {Object} deviceInfo - Device information
 * @returns {string} Formatted device info
 */
export const formatDeviceInfo = (deviceInfo) => {
  if (!deviceInfo) return 'No device info available';
  
  return `📱 Device Information

• Hardware 
  - Name: ${deviceInfo.deviceName}
  - Model: ${deviceInfo.modelName}
  - Brand: ${deviceInfo.brand}
  - Manufacturer: ${deviceInfo.manufacturer}
  - Year Class: ${deviceInfo.deviceYearClass}
  - Memory: ${deviceInfo.totalMemory}

• Operating System
  - OS: ${deviceInfo.osName} ${deviceInfo.osVersion}
  - Build ID: ${deviceInfo.osBuildId}
  - Internal Build: ${deviceInfo.osInternalBuildId}

• Application
  - Name: ${deviceInfo.appName}
  - Version: ${deviceInfo.appVersion} (${deviceInfo.appBuildVersion})
  - Installed: ${deviceInfo.appInstallationTime}

• Network
  - IP: ${deviceInfo.ipAddress}
  - Type: ${deviceInfo.networkType}
  - Connected: ${deviceInfo.isConnected ? 'Yes' : 'No'}
  - Internet: ${deviceInfo.isInternetReachable ? 'Reachable' : 'Unreachable'}

• Status
  - Battery: ${deviceInfo.batteryLevel}
  - Uptime: ${deviceInfo.uptime}
  - Timestamp: ${new Date(deviceInfo.timestamp).toLocaleString()}

• Cellular
  - Carrier: ${deviceInfo.carrier || 'Unknown'}`;
};

/**
 * Take a screenshot (requires native module on a real device)
 * @returns {Promise<string>} Screenshot file URI
 * Note: This will only work on Android with a real screenshot module.
 * In Expo, this is not available out of the box.
 */
export const takeScreenshot = async () => {
  try {
    // First check if we can take screenshots (this will always fail in Expo)
    // But we'll implement it for completeness
    const isScreenshotAvailable = false; // Placeholder
    
    if (!isScreenshotAvailable) {
      logger.warning('Screenshot functionality is not available in Expo');
      return null;
    }
    
    // This would be the implementation if we had a native module
    const screenshotPath = `${FileSystem.cacheDirectory}screenshot_${Date.now()}.jpg`;
    
    // Placeholder for actual implementation
    throw new Error('Screenshot functionality requires a native module');
    
    return screenshotPath;
  } catch (error) {
    logger.error(`Screenshot error: ${error.message}`);
    throw error;
  }
};

/**
 * Check if screenshots are disabled on the device
 * @returns {Promise<boolean>} Whether screenshots are disabled
 */
export const areScreenshotsDisabled = async () => {
  try {
    return await ScreenCapture.isScreenCaptureEnabledAsync();
  } catch (error) {
    logger.error(`Screen capture check error: ${error.message}`);
    return false;
  }
};

/**
 * Prevent screenshots (security feature)
 */
export const preventScreenshots = async () => {
  try {
    await ScreenCapture.preventScreenCaptureAsync();
    logger.info('Screenshot prevention enabled');
  } catch (error) {
    logger.error(`Prevent screenshots error: ${error.message}`);
  }
};

/**
 * Allow screenshots
 */
export const allowScreenshots = async () => {
  try {
    await ScreenCapture.allowScreenCaptureAsync();
    logger.info('Screenshot prevention disabled');
  } catch (error) {
    logger.error(`Allow screenshots error: ${error.message}`);
  }
};

export default {
  getDeviceInfo,
  formatDeviceInfo,
  takeScreenshot,
  areScreenshotsDisabled,
  preventScreenshots,
  allowScreenshots
};
