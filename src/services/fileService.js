/**
 * Service for file system operations
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import logger from '../utils/logger';

/**
 * Get file directory contents
 * @param {string} path - Directory path
 * @returns {Promise<Array>} Array of file objects
 */
export const getDirectoryContents = async (path) => {
  try {
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    
    // Check if path exists and is a directory
    const info = await FileSystem.getInfoAsync(normalizedPath);
    if (!info.exists) {
      throw new Error(`Path doesn't exist: ${normalizedPath}`);
    }
    
    if (!info.isDirectory) {
      throw new Error(`Path is not a directory: ${normalizedPath}`);
    }
    
    // Get file list
    const files = await FileSystem.readDirectoryAsync(normalizedPath);
    
    // Get detailed info for each file
    const fileObjects = await Promise.all(
      files.map(async (fileName) => {
        const filePath = `${normalizedPath}${fileName}`;
        try {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          return {
            name: fileName,
            path: filePath,
            uri: fileInfo.uri,
            size: fileInfo.size || 0,
            isDirectory: fileInfo.isDirectory || false,
            modificationTime: fileInfo.modificationTime,
            exists: fileInfo.exists
          };
        } catch (error) {
          return {
            name: fileName,
            path: filePath,
            error: error.message
          };
        }
      })
    );
    
    // Sort: directories first, then files alphabetically
    return fileObjects.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    logger.error(`Failed to get directory contents: ${error.message}`);
    throw error;
  }
};

/**
 * Get file content as string
 * @param {string} path - File path
 * @returns {Promise<string>} File content
 */
export const readFileContent = async (path) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(path);
    
    if (!fileInfo.exists) {
      throw new Error(`File doesn't exist: ${path}`);
    }
    
    if (fileInfo.isDirectory) {
      throw new Error(`Path is a directory, not a file: ${path}`);
    }
    
    // Check file size to avoid loading very large files
    if (fileInfo.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error(`File too large (${(fileInfo.size / 1024 / 1024).toFixed(2)} MB): ${path}`);
    }
    
    return await FileSystem.readAsStringAsync(path);
  } catch (error) {
    logger.error(`Failed to read file: ${error.message}`);
    throw error;
  }
};

/**
 * Create a file with content
 * @param {string} path - File path
 * @param {string} content - File content
 * @returns {Promise<Object>} File info
 */
export const createFile = async (path, content) => {
  try {
    await FileSystem.writeAsStringAsync(path, content);
    const fileInfo = await FileSystem.getInfoAsync(path);
    
    logger.info(`Created file: ${path} (${fileInfo.size} bytes)`);
    return fileInfo;
  } catch (error) {
    logger.error(`Failed to create file: ${error.message}`);
    throw error;
  }
};

/**
 * Create a directory
 * @param {string} path - Directory path
 * @returns {Promise<Object>} Directory info
 */
export const createDirectory = async (path) => {
  try {
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    
    // Check if directory already exists
    const info = await FileSystem.getInfoAsync(normalizedPath);
    if (info.exists) {
      if (info.isDirectory) {
        return info; // Directory already exists
      } else {
        throw new Error(`Path exists but is not a directory: ${normalizedPath}`);
      }
    }
    
    // Create directory
    await FileSystem.makeDirectoryAsync(normalizedPath, { intermediates: true });
    const dirInfo = await FileSystem.getInfoAsync(normalizedPath);
    
    logger.info(`Created directory: ${normalizedPath}`);
    return dirInfo;
  } catch (error) {
    logger.error(`Failed to create directory: ${error.message}`);
    throw error;
  }
};

/**
 * Create a temporary file
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @returns {Promise<string>} File URI
 */
export const createTempFile = async (content, filename) => {
  try {
    const path = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, content);
    
    logger.info(`Created temporary file: ${path}`);
    return path;
  } catch (error) {
    logger.error(`Failed to create temp file: ${error.message}`);
    throw error;
  }
};

/**
 * Generate a CSV file from data
 * @param {Array} data - Array of objects to convert to CSV
 * @param {Array} headers - Array of header names
 * @param {string} filename - CSV filename
 * @returns {Promise<string>} CSV file URI
 */
export const generateCSV = async (data, headers, filename) => {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid data for CSV generation');
    }
    
    // If headers not provided, use keys from first object
    const csvHeaders = headers || Object.keys(data[0]);
    
    // Create CSV header row
    let csv = csvHeaders.map(header => `"${header}"`).join(',') + '\n';
    
    // Add data rows
    data.forEach(item => {
      const row = csvHeaders.map(key => {
        const value = item[key] || '';
        // Escape quotes and format
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
      
      csv += row + '\n';
    });
    
    // Save to temp file
    return await createTempFile(csv, filename || 'data.csv');
  } catch (error) {
    logger.error(`Failed to generate CSV: ${error.message}`);
    throw error;
  }
};

/**
 * Share a file
 * @param {string} fileUri - File URI
 * @param {string} contentType - Content type (MIME type)
 * @returns {Promise<Object>} Share result
 */
export const shareFile = async (fileUri, contentType = 'text/plain') => {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }
    
    return await Sharing.shareAsync(fileUri, {
      mimeType: contentType,
      UTI: contentType // For iOS
    });
  } catch (error) {
    logger.error(`Failed to share file: ${error.message}`);
    throw error;
  }
};

/**
 * Save a file to media library
 * @param {string} fileUri - File URI
 * @returns {Promise<Object>} Media asset info
 */
export const saveToMediaLibrary = async (fileUri) => {
  try {
    // Request permissions if needed
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission not granted');
    }
    
    // Save file to media library
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    logger.info(`Saved file to media library: ${asset.filename}`);
    return asset;
  } catch (error) {
    logger.error(`Failed to save to media library: ${error.message}`);
    throw error;
  }
};

export default {
  getDirectoryContents,
  readFileContent,
  createFile,
  createDirectory,
  createTempFile,
  generateCSV,
  shareFile,
  saveToMediaLibrary
};
