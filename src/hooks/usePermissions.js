/**
 * Hook for managing app permissions
 */
import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Permissions from 'expo-permissions';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import logger from '../utils/logger';

export default function usePermissions() {
  const [permissionStatus, setPermissionStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // List of permissions we want to request
  const requiredPermissions = [
    'location',
    'camera',
    'mediaLibrary',
    'contacts',
    'storage',
  ];
  
  /**
   * Check if SMS access is available
   * @returns {Promise<boolean>}
   */
  const checkSmsAvailable = useCallback(async () => {
    try {
      return await SMS.isAvailableAsync();
    } catch (error) {
      logger.warning(`SMS check error: ${error.message}`);
      return false;
    }
  }, []);
  
  /**
   * Request a single permission
   * @param {string} permission - Permission name
   * @returns {Promise<string>} Permission status
   */
  const requestPermission = useCallback(async (permission) => {
    try {
      let status;
      
      switch (permission) {
        case 'location':
          const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
          status = locationStatus;
          break;
          
        case 'camera':
          const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
          status = cameraStatus;
          break;
          
        case 'mediaLibrary':
          const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
          status = mediaStatus;
          break;
          
        case 'contacts':
          const { status: contactsStatus } = await Contacts.requestPermissionsAsync();
          status = contactsStatus;
          break;
          
        case 'storage':
          // Storage permissions are automatic on iOS, need requesting on Android
          if (Platform.OS === 'android') {
            // On Android, we don't have a direct way to request storage permissions in Expo
            // FileSystem permissions are typically included in the app.json
            // We'll just check if we can write a test file
            try {
              const testPath = `${FileSystem.cacheDirectory}permission_test.txt`;
              await FileSystem.writeAsStringAsync(testPath, 'test');
              await FileSystem.deleteAsync(testPath);
              status = 'granted';
            } catch (error) {
              status = 'denied';
            }
          } else {
            status = 'granted'; // Auto-granted on iOS
          }
          break;
          
        default:
          status = 'unknown';
      }
      
      setPermissionStatus(prev => ({
        ...prev,
        [permission]: status
      }));
      
      logger.info(`Permission ${permission}: ${status}`);
      return status;
    } catch (error) {
      logger.error(`Permission request error for ${permission}: ${error.message}`);
      
      setPermissionStatus(prev => ({
        ...prev,
        [permission]: 'error'
      }));
      
      return 'error';
    }
  }, []);
  
  /**
   * Request all required permissions
   * @returns {Promise<Object>} Permission statuses
   */
  const requestAllPermissions = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Request permissions one by one to ensure better UX
      const statuses = {};
      
      for (const permission of requiredPermissions) {
        statuses[permission] = await requestPermission(permission);
      }
      
      // Check SMS availability
      statuses.sms = await checkSmsAvailable() ? 'available' : 'unavailable';
      
      setPermissionStatus(statuses);
      return statuses;
    } catch (error) {
      logger.error(`Failed to request all permissions: ${error.message}`);
      return permissionStatus;
    } finally {
      setIsLoading(false);
    }
  }, [requestPermission, checkSmsAvailable, permissionStatus]);
  
  /**
   * Check if a permission is granted
   * @param {string} permission - Permission name
   * @returns {boolean} Whether permission is granted
   */
  const isPermissionGranted = useCallback((permission) => {
    return permissionStatus[permission] === 'granted';
  }, [permissionStatus]);
  
  /**
   * Check if all required permissions are granted
   * @returns {boolean} Whether all permissions are granted
   */
  const areAllPermissionsGranted = useCallback(() => {
    return requiredPermissions.every(permission => 
      permissionStatus[permission] === 'granted'
    );
  }, [permissionStatus]);
  
  // Load initial permission status on mount
  useEffect(() => {
    const loadInitialStatus = async () => {
      setIsLoading(true);
      
      try {
        const statuses = {};
        
        // Check initial status of each permission
        for (const permission of requiredPermissions) {
          try {
            let status;
            
            switch (permission) {
              case 'location':
                const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
                status = locationStatus;
                break;
                
              case 'camera':
                const { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();
                status = cameraStatus;
                break;
                
              case 'mediaLibrary':
                const { status: mediaStatus } = await MediaLibrary.getPermissionsAsync();
                status = mediaStatus;
                break;
                
              case 'contacts':
                const { status: contactsStatus } = await Contacts.getPermissionsAsync();
                status = contactsStatus;
                break;
                
              case 'storage':
                // As with requesting, we just check if we can use the file system
                try {
                  const testPath = `${FileSystem.cacheDirectory}permission_test.txt`;
                  await FileSystem.writeAsStringAsync(testPath, 'test');
                  await FileSystem.deleteAsync(testPath);
                  status = 'granted';
                } catch (error) {
                  status = 'denied';
                }
                break;
                
              default:
                status = 'unknown';
            }
            
            statuses[permission] = status;
          } catch (error) {
            statuses[permission] = 'error';
            logger.error(`Error checking ${permission} permission: ${error.message}`);
          }
        }
        
        // Check SMS availability
        statuses.sms = await checkSmsAvailable() ? 'available' : 'unavailable';
        
        setPermissionStatus(statuses);
      } catch (error) {
        logger.error(`Failed to load initial permission status: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialStatus();
  }, [checkSmsAvailable]);
  
  return {
    permissionStatus,
    isLoading,
    requestPermission,
    requestAllPermissions,
    isPermissionGranted,
    areAllPermissionsGranted
  };
}
