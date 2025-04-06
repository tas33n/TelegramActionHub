/**
 * Native Module Configuration
 * Contains the Java code snippets that would be used in a native module
 * 
 * Note: This code is for reference and demonstration only. It would need to be
 * implemented in a separate Android native module project and then integrated
 * with Expo via config plugins.
 */

/**
 * Java code for accessing SMS messages
 * This would be implemented in a native Android module
 */
export const SMS_READER_JAVA_CODE = `
package com.telegrammonitor.smsreader;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class SmsReaderModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "SmsReader";
    private static final String TAG = "SmsReaderModule";
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());

    public SmsReaderModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void getSmsMessages(int maxCount, boolean includeInbox, boolean includeSent, 
                              String afterDate, String phoneFilter, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            ContentResolver contentResolver = context.getContentResolver();
            WritableArray messages = Arguments.createArray();
            
            long afterTimestamp = 0;
            if (afterDate != null && !afterDate.isEmpty()) {
                try {
                    afterTimestamp = dateFormat.parse(afterDate).getTime();
                } catch (Exception e) {
                    Log.e(TAG, "Invalid date format: " + afterDate);
                }
            }
            
            // Query inbox messages
            if (includeInbox) {
                Uri inboxUri = Uri.parse("content://sms/inbox");
                getMessages(contentResolver, inboxUri, messages, maxCount, afterTimestamp, 
                           phoneFilter, "inbox");
            }
            
            // Query sent messages
            if (includeSent) {
                Uri sentUri = Uri.parse("content://sms/sent");
                getMessages(contentResolver, sentUri, messages, maxCount, afterTimestamp, 
                           phoneFilter, "sent");
            }
            
            promise.resolve(messages);
        } catch (Exception e) {
            Log.e(TAG, "Error getting SMS messages", e);
            promise.reject("SMS_ERROR", "Failed to get SMS messages: " + e.getMessage());
        }
    }
    
    private void getMessages(ContentResolver contentResolver, Uri uri, WritableArray messages,
                            int maxCount, long afterTimestamp, String phoneFilter, String type) {
        String selection = null;
        String[] selectionArgs = null;
        
        if (afterTimestamp > 0 && phoneFilter != null && !phoneFilter.isEmpty()) {
            selection = "date > ? AND address = ?";
            selectionArgs = new String[] { String.valueOf(afterTimestamp), phoneFilter };
        } else if (afterTimestamp > 0) {
            selection = "date > ?";
            selectionArgs = new String[] { String.valueOf(afterTimestamp) };
        } else if (phoneFilter != null && !phoneFilter.isEmpty()) {
            selection = "address = ?";
            selectionArgs = new String[] { phoneFilter };
        }
        
        try (Cursor cursor = contentResolver.query(
                uri,
                new String[] { "_id", "address", "date", "body", "read" },
                selection,
                selectionArgs,
                "date DESC LIMIT " + maxCount)) {
            
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    WritableMap message = Arguments.createMap();
                    
                    long messageId = cursor.getLong(cursor.getColumnIndexOrThrow("_id"));
                    String address = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                    long timestamp = cursor.getLong(cursor.getColumnIndexOrThrow("date"));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));
                    int read = cursor.getInt(cursor.getColumnIndexOrThrow("read"));
                    
                    message.putString("id", String.valueOf(messageId));
                    message.putString("address", address);
                    message.putDouble("timestamp", timestamp);
                    message.putString("date", dateFormat.format(new Date(timestamp)));
                    message.putString("body", body);
                    message.putBoolean("read", read == 1);
                    message.putString("type", type);
                    
                    messages.pushMap(message);
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying " + uri.toString(), e);
        }
    }
    
    @ReactMethod
    public void getSmsThreads(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            ContentResolver contentResolver = context.getContentResolver();
            WritableArray threads = Arguments.createArray();
            
            Uri threadsUri = Uri.parse("content://mms-sms/conversations");
            String[] projection = new String[] {
                    Telephony.Threads._ID,
                    Telephony.Threads.MESSAGE_COUNT,
                    Telephony.Threads.RECIPIENT_IDS,
                    Telephony.Threads.SNIPPET,
                    Telephony.Threads.DATE
            };
            
            try (Cursor cursor = contentResolver.query(
                    threadsUri,
                    projection,
                    null,
                    null,
                    Telephony.Threads.DATE + " DESC")) {
                
                if (cursor != null && cursor.moveToFirst()) {
                    do {
                        WritableMap thread = Arguments.createMap();
                        
                        String threadId = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Threads._ID));
                        int messageCount = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Threads.MESSAGE_COUNT));
                        String snippet = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Threads.SNIPPET));
                        long date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Threads.DATE));
                        
                        thread.putString("id", threadId);
                        thread.putInt("messageCount", messageCount);
                        thread.putString("snippet", snippet != null ? snippet : "");
                        thread.putDouble("timestamp", date);
                        thread.putString("date", dateFormat.format(new Date(date)));
                        
                        // Get the thread recipients (addresses)
                        thread.putArray("addresses", getThreadAddresses(contentResolver, threadId));
                        
                        threads.pushMap(thread);
                    } while (cursor.moveToNext());
                }
            }
            
            promise.resolve(threads);
        } catch (Exception e) {
            Log.e(TAG, "Error getting SMS threads", e);
            promise.reject("SMS_ERROR", "Failed to get SMS threads: " + e.getMessage());
        }
    }
    
    private WritableArray getThreadAddresses(ContentResolver contentResolver, String threadId) {
        WritableArray addresses = Arguments.createArray();
        
        Uri uri = Uri.parse("content://sms/");
        String selection = "thread_id = ?";
        String[] selectionArgs = new String[] { threadId };
        
        try (Cursor cursor = contentResolver.query(
                uri,
                new String[] { "address" },
                selection,
                selectionArgs,
                "date DESC LIMIT 1")) {
            
            if (cursor != null && cursor.moveToFirst()) {
                String address = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                addresses.pushString(address);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting thread addresses", e);
        }
        
        return addresses;
    }
}`;

/**
 * Java code for accessing file system
 * This would be implemented in a native Android module
 */
export const FILE_SYSTEM_JAVA_CODE = `
package com.telegrammonitor.filesystem;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class FileSystemModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "FileSystem";
    private static final String TAG = "FileSystemModule";
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());

    public FileSystemModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void getStorageDirectories(Promise promise) {
        try {
            WritableMap directories = Arguments.createMap();
            
            // Get internal storage
            directories.putString("internal", Environment.getExternalStorageDirectory().getAbsolutePath());
            
            // Check if external SD card is available
            File[] externalDirs = getReactApplicationContext().getExternalFilesDirs(null);
            if (externalDirs.length > 1 && externalDirs[1] != null) {
                String path = externalDirs[1].getAbsolutePath();
                int index = path.indexOf("/Android/");
                if (index > 0) {
                    directories.putString("sdcard", path.substring(0, index));
                }
            } else {
                directories.putNull("sdcard");
            }
            
            // Common directories
            directories.putString("dcim", Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DCIM).getAbsolutePath());
            directories.putString("pictures", Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_PICTURES).getAbsolutePath());
            directories.putString("downloads", Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS).getAbsolutePath());
            
            promise.resolve(directories);
        } catch (Exception e) {
            Log.e(TAG, "Error getting storage directories", e);
            promise.reject("FILESYSTEM_ERROR", "Failed to get storage directories: " + e.getMessage());
        }
    }

    @ReactMethod
    public void listDirectory(String path, Promise promise) {
        try {
            File directory = new File(path);
            
            if (!directory.exists() || !directory.isDirectory()) {
                promise.reject("FILESYSTEM_ERROR", "Directory does not exist: " + path);
                return;
            }
            
            File[] files = directory.listFiles();
            if (files == null) {
                Log.w(TAG, "Directory exists but listFiles() returned null: " + path);
                promise.resolve(Arguments.createArray());
                return;
            }
            
            WritableArray fileList = Arguments.createArray();
            
            for (File file : files) {
                if (file.getName().startsWith(".")) {
                    continue; // Skip hidden files
                }
                
                WritableMap fileInfo = Arguments.createMap();
                fileInfo.putString("name", file.getName());
                fileInfo.putString("path", file.getAbsolutePath());
                fileInfo.putDouble("size", file.length());
                fileInfo.putBoolean("isDirectory", file.isDirectory());
                fileInfo.putDouble("lastModified", file.lastModified());
                fileInfo.putString("modifiedDate", dateFormat.format(new Date(file.lastModified())));
                
                fileList.pushMap(fileInfo);
            }
            
            promise.resolve(fileList);
        } catch (Exception e) {
            Log.e(TAG, "Error listing directory", e);
            promise.reject("FILESYSTEM_ERROR", "Failed to list directory: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getMediaFiles(String mediaType, int limit, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            WritableArray mediaFiles = Arguments.createArray();
            
            Uri uri;
            String[] projection;
            
            if ("images".equals(mediaType)) {
                uri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                projection = new String[] {
                        MediaStore.Images.Media._ID,
                        MediaStore.Images.Media.DISPLAY_NAME,
                        MediaStore.Images.Media.DATA,
                        MediaStore.Images.Media.SIZE,
                        MediaStore.Images.Media.DATE_MODIFIED,
                        MediaStore.Images.Media.MIME_TYPE
                };
            } else if ("videos".equals(mediaType)) {
                uri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                projection = new String[] {
                        MediaStore.Video.Media._ID,
                        MediaStore.Video.Media.DISPLAY_NAME,
                        MediaStore.Video.Media.DATA,
                        MediaStore.Video.Media.SIZE,
                        MediaStore.Video.Media.DATE_MODIFIED,
                        MediaStore.Video.Media.MIME_TYPE,
                        MediaStore.Video.Media.DURATION
                };
            } else if ("audio".equals(mediaType)) {
                uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                projection = new String[] {
                        MediaStore.Audio.Media._ID,
                        MediaStore.Audio.Media.DISPLAY_NAME,
                        MediaStore.Audio.Media.DATA,
                        MediaStore.Audio.Media.SIZE,
                        MediaStore.Audio.Media.DATE_MODIFIED,
                        MediaStore.Audio.Media.MIME_TYPE,
                        MediaStore.Audio.Media.DURATION
                };
            } else {
                promise.reject("FILESYSTEM_ERROR", "Invalid media type: " + mediaType);
                return;
            }
            
            String sortOrder = MediaStore.MediaColumns.DATE_MODIFIED + " DESC LIMIT " + limit;
            
            try (Cursor cursor = context.getContentResolver().query(
                    uri,
                    projection,
                    null,
                    null,
                    sortOrder)) {
                
                if (cursor != null && cursor.moveToFirst()) {
                    int dataColumn = cursor.getColumnIndex(MediaStore.MediaColumns.DATA);
                    int nameColumn = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
                    int sizeColumn = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE);
                    int dateColumn = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_MODIFIED);
                    int mimeColumn = cursor.getColumnIndex(MediaStore.MediaColumns.MIME_TYPE);
                    int durationColumn = -1;
                    
                    if ("videos".equals(mediaType) || "audio".equals(mediaType)) {
                        durationColumn = cursor.getColumnIndex(MediaStore.Video.Media.DURATION);
                    }
                    
                    do {
                        WritableMap file = Arguments.createMap();
                        
                        file.putString("name", cursor.getString(nameColumn));
                        file.putString("path", cursor.getString(dataColumn));
                        file.putDouble("size", cursor.getLong(sizeColumn));
                        
                        long modified = cursor.getLong(dateColumn) * 1000; // Convert to milliseconds
                        file.putDouble("lastModified", modified);
                        file.putString("modifiedDate", dateFormat.format(new Date(modified)));
                        
                        file.putString("mimeType", cursor.getString(mimeColumn));
                        file.putString("type", mediaType);
                        
                        if (durationColumn != -1) {
                            file.putInt("duration", cursor.getInt(durationColumn));
                        }
                        
                        mediaFiles.pushMap(file);
                    } while (cursor.moveToNext());
                }
            }
            
            promise.resolve(mediaFiles);
        } catch (Exception e) {
            Log.e(TAG, "Error getting media files", e);
            promise.reject("FILESYSTEM_ERROR", "Failed to get media files: " + e.getMessage());
        }
    }
}`;

/**
 * Java code for device monitoring
 * This would be implemented in a native Android module
 */
export const DEVICE_MONITOR_JAVA_CODE = `
package com.telegrammonitor.devicemonitor;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

public class DeviceMonitorModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "DeviceMonitor";
    private static final String TAG = "DeviceMonitorModule";

    public DeviceMonitorModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void getDeviceStatus(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            WritableMap status = Arguments.createMap();
            
            // Battery info
            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryStatus = context.registerReceiver(null, ifilter);
            
            int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            float batteryPct = level * 100 / (float)scale;
            
            int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                               status == BatteryManager.BATTERY_STATUS_FULL;
            
            // Storage info
            File internalPath = Environment.getDataDirectory();
            StatFs internalStats = new StatFs(internalPath.getPath());
            long internalTotal, internalFree;
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                internalTotal = internalStats.getTotalBytes();
                internalFree = internalStats.getAvailableBytes();
            } else {
                long blockSize = internalStats.getBlockSize();
                internalTotal = blockSize * internalStats.getBlockCount();
                internalFree = blockSize * internalStats.getAvailableBlocks();
            }
            
            // Memory info
            ActivityManager.MemoryInfo memoryInfo = new ActivityManager.MemoryInfo();
            ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            activityManager.getMemoryInfo(memoryInfo);
            
            // CPU info
            String cpuInfo = readCpuInfo();
            
            // MAC Address
            String macAddress = getMacAddress();
            
            // Build device info object
            status.putDouble("batteryLevel", batteryPct);
            status.putBoolean("isCharging", isCharging);
            status.putDouble("internalStorageTotal", internalTotal);
            status.putDouble("internalStorageFree", internalFree);
            status.putDouble("memoryTotal", memoryInfo.totalMem);
            status.putDouble("memoryAvailable", memoryInfo.availMem);
            status.putBoolean("lowMemory", memoryInfo.lowMemory);
            status.putString("cpuInfo", cpuInfo);
            status.putString("macAddress", macAddress);
            status.putString("androidId", Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID));
            
            promise.resolve(status);
        } catch (Exception e) {
            Log.e(TAG, "Error getting device status", e);
            promise.reject("DEVICE_ERROR", "Failed to get device status: " + e.getMessage());
        }
    }
    
    private String readCpuInfo() {
        try {
            BufferedReader br = new BufferedReader(new FileReader("/proc/cpuinfo"));
            String line;
            StringBuilder sb = new StringBuilder();
            while ((line = br.readLine()) != null) {
                if (line.contains("Hardware") || line.contains("model name") || line.contains("Processor")) {
                    sb.append(line).append("\\n");
                }
            }
            br.close();
            return sb.toString();
        } catch (IOException e) {
            Log.e(TAG, "Error reading CPU info", e);
            return "Unknown";
        }
    }
    
    private String getMacAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface nif : interfaces) {
                if (!nif.getName().equalsIgnoreCase("wlan0")) continue;
                
                byte[] macBytes = nif.getHardwareAddress();
                if (macBytes == null) {
                    return "Unknown";
                }
                
                StringBuilder sb = new StringBuilder();
                for (byte b : macBytes) {
                    sb.append(String.format("%02X:", b));
                }
                
                if (sb.length() > 0) {
                    sb.deleteCharAt(sb.length() - 1);
                }
                
                return sb.toString();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting MAC address", e);
        }
        return "Unknown";
    }
}`;

/**
 * This would be the build.gradle modifications needed to implement
 * the native modules in an Expo app
 */
export const BUILD_GRADLE_MODIFICATIONS = `
// Add these to android/build.gradle dependencies section
dependencies {
    // ... other dependencies
    implementation "androidx.core:core:1.6.0"
    implementation "androidx.appcompat:appcompat:1.3.1"
}

// Add these to the bottom of android/app/build.gradle
android {
    // ... existing config
    
    // Request permissions in the manifest
    defaultConfig {
        // ... existing config
        
        manifestPlaceholders = [
            // Add permissions for SMS and File access
            USES_PERMISSION_READ_SMS: "true",
            USES_PERMISSION_READ_EXTERNAL_STORAGE: "true",
            USES_PERMISSION_WRITE_EXTERNAL_STORAGE: "true"
        ]
    }
}
`;

/**
 * This would be the AndroidManifest.xml modifications needed
 */
export const ANDROID_MANIFEST_MODIFICATIONS = `
<!-- These would be added to AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- SMS Permissions -->
    <uses-permission android:name="android.permission.READ_SMS" />
    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    
    <!-- Storage Permissions -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    
    <!-- Device Permissions -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    
    <!-- ... rest of manifest -->
</manifest>
`;

/**
 * This would be the app.json modifications needed
 */
export const APP_JSON_MODIFICATIONS = `
{
  "expo": {
    // ... existing config
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "extraPermissions": [
              "android.permission.READ_SMS",
              "android.permission.RECEIVE_SMS",
              "android.permission.READ_EXTERNAL_STORAGE",
              "android.permission.WRITE_EXTERNAL_STORAGE",
              "android.permission.MANAGE_EXTERNAL_STORAGE",
              "android.permission.ACCESS_NETWORK_STATE",
              "android.permission.READ_PHONE_STATE",
              "android.permission.ACCESS_WIFI_STATE"
            ]
          }
        }
      ]
    ]
  }
}
`;

/**
 * Expo Config Plugin for integrating native modules
 * This would be created in a separate file
 */
export const EXPO_CONFIG_PLUGIN = `
// This would be a separate file: plugins/withNativeModules.js
const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');

const withNativeModules = (config) => {
  // Add permissions to AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];
    
    // Ensure permissions exist
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    const permissions = [
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.MANAGE_EXTERNAL_STORAGE',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.ACCESS_WIFI_STATE'
    ];
    
    // Add each permission if it doesn't already exist
    permissions.forEach(permission => {
      const exists = androidManifest.manifest['uses-permission'].some(
        existingPermission => existingPermission.$['android:name'] === permission
      );
      
      if (!exists) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': permission }
        });
      }
    });
    
    return config;
  });
  
  // Modify build.gradle
  config = withAppBuildGradle(config, async (config) => {
    const buildGradle = config.modResults;
    
    // Add additional dependencies
    if (!buildGradle.includes("androidx.core:core")) {
      const depsSection = buildGradle.indexOf("dependencies {");
      if (depsSection !== -1) {
        const endOfDeps = buildGradle.indexOf("}", depsSection);
        const newContent = buildGradle.substring(0, endOfDeps) + 
          "    implementation 'androidx.core:core:1.6.0'\\n" +
          "    implementation 'androidx.appcompat:appcompat:1.3.1'\\n" +
          buildGradle.substring(endOfDeps);
        config.modResults = newContent;
      }
    }
    
    return config;
  });
  
  return config;
};

module.exports = withNativeModules;
`;

export default {
  SMS_READER_JAVA_CODE,
  FILE_SYSTEM_JAVA_CODE,
  DEVICE_MONITOR_JAVA_CODE,
  BUILD_GRADLE_MODIFICATIONS,
  ANDROID_MANIFEST_MODIFICATIONS,
  APP_JSON_MODIFICATIONS,
  EXPO_CONFIG_PLUGIN
};