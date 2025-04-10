/**
 * Enhanced hook for accessing and managing the file system including native access
 */
import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import logger from '../utils/logger';
import NativeFileSystem from '../native-modules/NativeFileSystem';

export default function useFileSystem() {
  const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory);
  const [fileList, setFileList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pathHistory, setPathHistory] = useState([]);
  const [systemDirectories, setSystemDirectories] = useState(null);
  const [hasNativeAccess, setHasNativeAccess] = useState(false);
  
  // Initialize native file system access on component mount
  useEffect(() => {
    const initializeNative = async () => {
      try {
        if (Platform.OS === 'android') {
          // Request permission for full storage access
          const permissionGranted = await NativeFileSystem.requestStoragePermission();
          setHasNativeAccess(permissionGranted);
          
          if (permissionGranted) {
            // Get system directories
            const directories = await NativeFileSystem.getStorageDirectories();
            setSystemDirectories(directories);
            logger.success('Native file system access enabled');
          } else {
            logger.warning('Storage permission not granted');
          }
        }
      } catch (error) {
        logger.error(`Failed to initialize native file system: ${error.message}`);
      }
    };
    
    initializeNative();
  }, []);
  
  /**
   * List files in a directory
   * @param {string} path - Directory path
   * @returns {Promise<Array>} List of files
   */
  const listFiles = useCallback(async (path) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Ensure path ends with a slash
      const normalizedPath = path.endsWith('/') ? path : `${path}/`;
      
      // Get info about this path
      const pathInfo = await FileSystem.getInfoAsync(normalizedPath);
      if (!pathInfo.exists) {
        throw new Error(`Path does not exist: ${normalizedPath}`);
      }
      
      if (!pathInfo.isDirectory) {
        throw new Error(`Path is not a directory: ${normalizedPath}`);
      }
      
      // Read directory contents
      const files = await FileSystem.readDirectoryAsync(normalizedPath);
      
      // Get info for each file
      const fileDetails = await Promise.all(
        files.map(async (filename) => {
          const filePath = `${normalizedPath}${filename}`;
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
      const sortedFiles = fileDetails.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setCurrentPath(normalizedPath);
      setFileList(sortedFiles);
      logger.info(`Listed ${sortedFiles.length} files in ${normalizedPath}`);
      return sortedFiles;
    } catch (error) {
      const errorMsg = `Failed to list files: ${error.message}`;
      logger.error(errorMsg);
      setError(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Navigate to a directory
   * @param {string} path - Directory path
   */
  const navigateTo = useCallback(async (path) => {
    try {
      // Add current path to history before navigating
      setPathHistory(prev => [...prev, currentPath]);
      await listFiles(path);
    } catch (error) {
      logger.error(`Navigation error: ${error.message}`);
    }
  }, [currentPath, listFiles]);
  
  /**
   * Navigate to parent directory
   */
  const navigateUp = useCallback(async () => {
    try {
      if (currentPath === FileSystem.documentDirectory) {
        logger.warning('Already at root directory');
        return;
      }
      
      // Remove trailing slash
      const pathWithoutTrailingSlash = currentPath.endsWith('/') 
        ? currentPath.slice(0, -1) 
        : currentPath;
      
      // Get parent path
      const parentPath = pathWithoutTrailingSlash.substring(
        0, pathWithoutTrailingSlash.lastIndexOf('/')
      ) + '/';
      
      await listFiles(parentPath);
    } catch (error) {
      logger.error(`Navigate up error: ${error.message}`);
    }
  }, [currentPath, listFiles]);
  
  /**
   * Navigate back to previous directory
   */
  const navigateBack = useCallback(async () => {
    try {
      if (pathHistory.length === 0) {
        logger.warning('No navigation history');
        return;
      }
      
      // Get last path from history
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(prev => prev.slice(0, -1));
      
      await listFiles(previousPath);
    } catch (error) {
      logger.error(`Navigate back error: ${error.message}`);
    }
  }, [pathHistory, listFiles]);
  
  /**
   * Read file content
   * @param {string} path - File path
   * @returns {Promise<string>} File content
   */
  const readFile = useCallback(async (path) => {
    try {
      const content = await FileSystem.readAsStringAsync(path);
      logger.info(`Read file: ${path}`);
      return content;
    } catch (error) {
      logger.error(`Read file error: ${error.message}`);
      throw error;
    }
  }, []);
  
  /**
   * Create a file with content
   * @param {string} path - File path
   * @param {string} content - File content
   * @returns {Promise<string>} File URI
   */
  const createFile = useCallback(async (path, content) => {
    try {
      await FileSystem.writeAsStringAsync(path, content);
      logger.info(`Created file: ${path}`);
      
      // Refresh file list
      await listFiles(currentPath);
      
      return path;
    } catch (error) {
      logger.error(`Create file error: ${error.message}`);
      throw error;
    }
  }, [currentPath, listFiles]);
  
  /**
   * Create a temporary file
   * @param {string} content - File content
   * @param {string} filename - File name
   * @returns {Promise<string>} File URI
   */
  const createTempFile = useCallback(async (content, filename) => {
    try {
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, content);
      logger.info(`Created temp file: ${path}`);
      return path;
    } catch (error) {
      logger.error(`Create temp file error: ${error.message}`);
      throw error;
    }
  }, []);
  
  /**
   * Download file from URL
   * @param {string} url - File URL
   * @param {string} filename - Destination filename
   * @returns {Promise<string>} Downloaded file path
   */
  const downloadFile = useCallback(async (url, filename) => {
    try {
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          logger.debug(`Download progress: ${Math.round(progress * 100)}%`);
        }
      );
      
      const result = await downloadResumable.downloadAsync();
      logger.info(`Downloaded file: ${result.uri}`);
      
      return result.uri;
    } catch (error) {
      logger.error(`Download error: ${error.message}`);
      throw error;
    }
  }, []);
  
  /**
   * Save a file to media library
   * @param {string} fileUri - File URI
   * @param {string} album - Album name (optional)
   * @returns {Promise<Object>} Media asset
   */
  const saveToMediaLibrary = useCallback(async (fileUri, album) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        throw new Error('Media library permission not granted');
      }
      
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      
      if (album) {
        const albums = await MediaLibrary.getAlbumAsync(album);
        if (albums === null) {
          await MediaLibrary.createAlbumAsync(album, asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], albums, false);
        }
      }
      
      logger.info(`Saved to media library: ${fileUri}`);
      return asset;
    } catch (error) {
      logger.error(`Save to media library error: ${error.message}`);
      throw error;
    }
  }, []);
  
  /**
   * List files in system directories (like DCIM, Pictures, etc.)
   * @param {string} dirType - Directory type ('dcim', 'pictures', 'downloads', etc.)
   * @returns {Promise<Array>} List of files
   */
  const listSystemFiles = useCallback(async (dirType) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!hasNativeAccess || !systemDirectories) {
        throw new Error('Native file system access not available');
      }
      
      const dirPath = systemDirectories[dirType];
      if (!dirPath) {
        throw new Error(`System directory not found: ${dirType}`);
      }
      
      // Use native module to list files
      const files = await NativeFileSystem.listSystemDirectoryFiles(dirPath);
      
      setCurrentPath(dirPath);
      setFileList(files);
      logger.info(`Listed ${files.length} files in system directory: ${dirType}`);
      
      return files;
    } catch (error) {
      const errorMsg = `Failed to list system files: ${error.message}`;
      logger.error(errorMsg);
      setError(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [hasNativeAccess, systemDirectories]);
  
  /**
   * Get available system directories
   * @returns {Object} System directories
   */
  const getSystemDirectories = useCallback(() => {
    return systemDirectories || {};
  }, [systemDirectories]);
  
  /**
   * Check if external storage (SD card) is available
   * @returns {Promise<boolean>} Whether external storage is available
   */
  const checkExternalStorage = useCallback(async () => {
    try {
      if (!hasNativeAccess) {
        return false;
      }
      
      return await NativeFileSystem.isExternalStorageAvailable();
    } catch (error) {
      logger.error(`Failed to check external storage: ${error.message}`);
      return false;
    }
  }, [hasNativeAccess]);

  /**
   * Get media files (images, videos, etc.)
   * @param {string} mediaType - Media type ('images', 'videos', 'audio')
   * @param {number} limit - Maximum number of files to retrieve
   * @returns {Promise<Array>} List of media files
   */
  const getMediaFiles = useCallback(async (mediaType, limit = 50) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!hasNativeAccess) {
        // Fall back to Expo MediaLibrary
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Media library permission not granted');
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
      } else {
        // In a real implementation, we would use NativeFileSystem.getMediaFiles
        // For now, we'll use Expo MediaLibrary
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Media library permission not granted');
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
      }
    } catch (error) {
      const errorMsg = `Failed to get media files: ${error.message}`;
      logger.error(errorMsg);
      setError(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [hasNativeAccess]);

  return {
    currentPath,
    fileList,
    isLoading,
    error,
    pathHistory,
    systemDirectories,
    hasNativeAccess,
    listFiles,
    navigateTo,
    navigateUp,
    navigateBack,
    readFile,
    createFile,
    createTempFile,
    downloadFile,
    saveToMediaLibrary,
    listSystemFiles,
    getSystemDirectories,
    checkExternalStorage,
    getMediaFiles
  };
}
