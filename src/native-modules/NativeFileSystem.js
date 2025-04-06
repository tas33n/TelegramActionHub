/**
 * Native File System Module
 * Provides enhanced file system access for Android devices through JSI
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import logger from '../utils/logger';

// In a real implementation, this would integrate with the native module
// via a native bridge. For now, we'll simulate the functionality.

/**
 * Initialize the native module
 * This must be called once at app startup
 */
export const initializeNativeFileSystem = async () => {
  if (Platform.OS !== 'android') {
    logger.warning('Native file system access is only available on Android');
    return false;
  }
  
  logger.info('Initializing native file system access');
  
  try {
    // In a real implementation, this would initialize the native module
    // For now, we'll just check if we have storage permission
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    logger.error(`Failed to initialize native file system: ${error.message}`);
    return false;
  }
};

/**
 * Get Android-specific directories
 * @returns {Object} Directory paths
 */
export const getStorageDirectories = async () => {
  if (Platform.OS !== 'android') {
    return {
      internal: FileSystem.documentDirectory,
      sdcard: null,
      dcim: null,
      pictures: null,
      downloads: null
    };
  }
  
  try {
    // On a real Android device with native modules, we'd return actual paths
    // For now, we'll return simulated paths
    return {
      internal: FileSystem.documentDirectory,
      sdcard: null, // Would be determined by native code
      dcim: `${FileSystem.documentDirectory}dcim/`,
      pictures: `${FileSystem.documentDirectory}pictures/`,
      downloads: `${FileSystem.documentDirectory}downloads/`
    };
  } catch (error) {
    logger.error(`Failed to get storage directories: ${error.message}`);
    return {
      internal: FileSystem.documentDirectory,
      sdcard: null,
      dcim: null,
      pictures: null,
      downloads: null
    };
  }
};

/**
 * List files in system directories that are not accessible 
 * through regular Expo FileSystem
 * @param {string} path - Directory path
 * @returns {Promise<Array>} List of files
 */
export const listSystemDirectoryFiles = async (path) => {
  try {
    // For the demo without native modules, we'll use the regular FileSystem
    // This would be replaced with native code in a real implementation
    const files = await FileSystem.readDirectoryAsync(path)
      .catch(() => []);
    
    // Get info for each file
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = `${path}${filename}`;
        try {
          const info = await FileSystem.getInfoAsync(filePath);
          return {
            name: filename,
            path: filePath,
            size: info.size || 0,
            isDirectory: info.isDirectory || false,
            modificationTime: info.modificationTime || null,
            uri: info.uri
          };
        } catch (error) {
          // If we can't get info, return basic info
          return {
            name: filename,
            path: filePath,
            size: 0,
            isDirectory: false,
            error: error.message
          };
        }
      })
    );
    
    // Sort directories first, then files alphabetically
    return fileDetails.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    logger.error(`Failed to list system directory files: ${error.message}`);
    return [];
  }
};

/**
 * Check if external storage is available
 * @returns {Promise<boolean>} Whether external storage is available
 */
export const isExternalStorageAvailable = async () => {
  if (Platform.OS !== 'android') {
    return false;
  }
  
  try {
    // In a real implementation, this would check the device's physical storage
    // For now, we'll just return false as we can't detect it without native code
    return false;
  } catch (error) {
    logger.error(`Failed to check external storage: ${error.message}`);
    return false;
  }
};

/**
 * Request storage permissions for Android 10+ scoped storage
 * @returns {Promise<boolean>} Whether permissions were granted
 */
export const requestStoragePermission = async () => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    logger.error(`Failed to request storage permission: ${error.message}`);
    return false;
  }
};

/**
 * Get media files
 * @param {string} mediaType - Media type ('images', 'videos', 'audio')
 * @param {number} limit - Maximum number of files to retrieve
 * @returns {Promise<Array>} Media files
 */
export const getMediaFiles = async (mediaType, limit = 50) => {
  try {
    // Request permission
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      logger.warning('Media library permission not granted');
      return [];
    }
    
    // Get media assets
    const media = await MediaLibrary.getAssetsAsync({
      mediaType: mediaType === 'images' ? 'photo' : 
                mediaType === 'videos' ? 'video' : 
                'unknown',
      first: limit,
      sortBy: MediaLibrary.SortBy.creationTime
    });
    
    return media.assets.map(asset => ({
      name: asset.filename,
      uri: asset.uri,
      path: asset.uri,
      size: asset.fileSize,
      type: mediaType,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
      creationTime: asset.creationTime
    }));
  } catch (error) {
    logger.error(`Failed to get media files: ${error.message}`);
    return [];
  }
};

// Combine all exports into a default object
export default {
  initializeNativeFileSystem,
  getStorageDirectories,
  listSystemDirectoryFiles,
  isExternalStorageAvailable,
  requestStoragePermission,
  getMediaFiles
};