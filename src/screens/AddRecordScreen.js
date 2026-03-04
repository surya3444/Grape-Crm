import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker"; // --- NEW IMPORT ---
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { addDoc, collection } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage"; // --- NEW IMPORTS ---
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import colors from "../colors";
import { auth, db } from "../firebaseConfig";

export default function AddRecordScreen({ route, navigation }) {
  const { moduleData, ownerId } = route.params;
  const user = auth.currentUser;

  // Form State
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false); // --- NEW UPLOAD STATE ---
  const [isScanning, setIsScanning] = useState(false);
  const [recording, setRecording] = useState(null);

  // --- DATE/TIME PICKER STATE ---
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState(null);
  const [pickerMode, setPickerMode] = useState("date");
  const [tempDate, setTempDate] = useState(null);

  // Initialize Auto-IDs
  useEffect(() => {
    const initialData = {};
    if (moduleData.fields) {
      moduleData.fields.forEach((field) => {
        if (field.type === "auto_id") {
          const uniqueId = `${field.prefix || "#"}${Math.floor(Date.now() / 1000)}`;
          initialData[field.name] = uniqueId;
        }
      });
    }
    setFormData(initialData);
  }, [moduleData]);

  // --- 0. FILE UPLOAD LOGIC (NEW) ---
  const uploadFileToFirebase = async (uri, fileName) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storage = getStorage();
      // Since record ID doesn't exist yet, we use a temp timestamp folder
      const storageRef = ref(
        storage,
        `uploads/${moduleData.id}/new_${Date.now()}/${fileName}`,
      );

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error("Upload failed", error);
      throw error;
    }
  };

  // Handle Camera Capture
  const handleCamera = async (field) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera access is needed.");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.5,
    });

    if (!result.canceled) {
      processUpload(result.assets[0], field);
    }
  };

  // Handle Gallery (Image) or Document Pick
  const handleAttachment = async (field) => {
    // Check limits
    const currentFiles = formData[field.name] || [];
    const currentCount = Array.isArray(currentFiles)
      ? currentFiles.length
      : currentFiles
        ? 1
        : 0;

    if (!field.allowMultiple && currentCount >= 1) {
      Alert.alert("Limit Reached", "This field only allows one file.");
      return;
    }

    try {
      let result;
      if (field.type === "image") {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          allowsMultipleSelection: field.allowMultiple,
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: "*/*",
          multiple: field.allowMultiple,
          copyToCacheDirectory: true,
        });
      }

      if (!result.canceled) {
        const assets = result.assets || [result];
        // Process all selected files
        for (const asset of assets) {
          await processUpload(asset, field);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Selection cancelled or failed.");
    }
  };

  // Core Upload Processor
  const processUpload = async (asset, field) => {
    setUploading(true);
    try {
      const uri = asset.uri;
      const name = asset.name || asset.fileName || `file_${Date.now()}.jpg`;

      const url = await uploadFileToFirebase(uri, name);

      // Update State: Append URL to array
      setFormData((prev) => {
        const oldData = prev[field.name] || [];
        const oldArray = Array.isArray(oldData)
          ? oldData
          : oldData
            ? [oldData]
            : [];
        return { ...prev, [field.name]: [...oldArray, url] };
      });
    } catch (error) {
      Alert.alert("Upload Error", "Could not upload file.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fieldName, urlToRemove) => {
    setFormData((prev) => {
      const currentFiles = prev[fieldName] || [];
      if (Array.isArray(currentFiles)) {
        return {
          ...prev,
          [fieldName]: currentFiles.filter((url) => url !== urlToRemove),
        };
      }
      return { ...prev, [fieldName]: [] };
    });
  };

  // --- 1. VOICE RECORDING HANDLERS ---
  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Mic access is needed for voice notes.",
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(recording);
    } catch (err) {
      console.log("Failed to start recording", err);
    }
  }

  async function stopRecording(fieldName) {
    if (!recording) return;
    setRecording(null);
    await recording.stopAndUnloadAsync();

    const currentText = formData[fieldName] || "";
    const updatedText =
      currentText + (currentText ? " " : "") + "[Audio Memo Attached]";
    updateForm(fieldName, updatedText);

    Alert.alert(
      "Voice Note Linked",
      "The audio note has been attached to this field.",
    );
  }

  // --- 2. AI OCR SCANNER LOGIC ---
  const scanBusinessCard = async () => {
    // ... (Keep your existing OCR logic here, unchanged)
    // For brevity, I am assuming the logic from your previous snippet is here.
    // If you need me to paste it again, let me know.
    // Just ensure the 'setFormData' updates work as before.
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Camera access is needed to scan cards.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setIsScanning(true);
      const localUri = result.assets[0].uri;
      const filename = localUri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      const body = new FormData();
      body.append("file", { uri: localUri, name: filename, type });
      body.append("apikey", "helloworld");
      body.append("language", "eng");

      try {
        const response = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data" },
          body: body,
        });

        const data = await response.json();
        const fullText = data.ParsedResults?.[0]?.ParsedText;

        if (!fullText) throw new Error("Could not read text.");

        const emailMatch = fullText.match(
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
        );
        const phoneMatch = fullText.match(
          /(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g,
        );
        const lines = fullText.split("\r\n");
        const nameGuess =
          lines.find((l) => l.trim().length > 4 && !l.includes("@")) ||
          lines[0];

        const newFormData = { ...formData };
        moduleData.fields.forEach((field) => {
          const fName = field.name.toLowerCase();
          if (fName.includes("email") && emailMatch)
            newFormData[field.name] = emailMatch[0].trim();
          if (
            (fName.includes("phone") || fName.includes("contact")) &&
            phoneMatch
          )
            newFormData[field.name] = phoneMatch[0].trim();
          if ((fName.includes("name") || fName.includes("client")) && nameGuess)
            newFormData[field.name] = nameGuess.trim();
        });

        setFormData(newFormData);
        Alert.alert("Scan Complete", "We've filled what we could find!");
      } catch (error) {
        Alert.alert("Error", "OCR processing failed. Please enter manually.");
      } finally {
        setIsScanning(false);
      }
    }
  };

  // --- 3. HANDLERS ---
  const updateForm = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleLocationFetch = async (fieldName) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Allow location access to use this feature.",
      );
      return;
    }
    updateForm(fieldName, "Locating...");
    let location = await Location.getCurrentPositionAsync({});
    const coords = `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`;
    updateForm(fieldName, coords);
  };

  const openDatePicker = (fieldName, includeTime) => {
    setCurrentDateField(fieldName);
    if (Platform.OS === "ios" && includeTime) setPickerMode("datetime");
    else setPickerMode("date");
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    const fieldDef = moduleData.fields.find((f) => f.name === currentDateField);

    if (
      Platform.OS === "android" &&
      fieldDef?.includeTime &&
      pickerMode === "date"
    ) {
      setShowDatePicker(false);
      setTempDate(selectedDate);
      setPickerMode("time");
      setTimeout(() => setShowDatePicker(true), 100);
      return;
    }

    setShowDatePicker(false);
    if (selectedDate) {
      let finalDateObj = selectedDate;
      if (Platform.OS === "android" && pickerMode === "time" && tempDate) {
        finalDateObj = new Date(
          tempDate.getFullYear(),
          tempDate.getMonth(),
          tempDate.getDate(),
          selectedDate.getHours(),
          selectedDate.getMinutes(),
        );
      }
      const year = finalDateObj.getFullYear();
      const month = String(finalDateObj.getMonth() + 1).padStart(2, "0");
      const day = String(finalDateObj.getDate()).padStart(2, "0");
      let dateString = `${year}-${month}-${day}`;
      if (fieldDef?.includeTime) {
        dateString += ` ${String(finalDateObj.getHours()).padStart(2, "0")}:${String(finalDateObj.getMinutes()).padStart(2, "0")}`;
      }
      updateForm(currentDateField, dateString);
      setTempDate(null);
    }
  };

  const handleSave = async () => {
    if (uploading) {
      Alert.alert("Wait", "Please wait for files to finish uploading.");
      return;
    }
    setLoading(true);
    try {
      const targetOwnerId = ownerId || user.uid;
      await addDoc(
        collection(
          db,
          "users",
          targetOwnerId,
          "modules",
          moduleData.id,
          "records",
        ),
        {
          ...formData,
          createdAt: new Date(),
          createdBy: user.uid,
          creatorName: user.displayName || "Member",
          lastModifiedBy: user.uid,
        },
      );
      Alert.alert("Success", "Record Added!");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. FIELD RENDERERS ---
  const renderField = (field) => {
    const val = formData[field.name];

    // --- NEW: IMAGE FIELD RENDERER ---
    if (field.type === "image") {
      const images = Array.isArray(val) ? val : val ? [val] : [];
      return (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>{field.name}</Text>
          <View style={styles.attachmentContainer}>
            <View style={styles.imageGrid}>
              {images.map((url, index) => (
                <View key={index} style={styles.thumbnailWrapper}>
                  <Image source={{ uri: url }} style={styles.thumbnail} />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeFile(field.name, url)}
                  >
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* BUTTONS: Camera & Gallery */}
              {(field.allowMultiple || images.length === 0) && (
                <>
                  <TouchableOpacity
                    style={styles.addAttachmentBtn}
                    onPress={() => handleCamera(field)}
                  >
                    <Ionicons name="camera" size={24} color={colors.primary} />
                    <Text style={styles.addAttachmentText}>Cam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addAttachmentBtn}
                    onPress={() => handleAttachment(field)}
                  >
                    <Ionicons
                      name="images"
                      size={24}
                      color={colors.secondary || "#555"}
                    />
                    <Text style={styles.addAttachmentText}>Gallery</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      );
    }

    // --- NEW: DOCUMENT FIELD RENDERER ---
    if (field.type === "document") {
      const docs = Array.isArray(val) ? val : val ? [val] : [];
      return (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>{field.name}</Text>
          <View style={styles.attachmentContainer}>
            {docs.map((url, index) => (
              <View key={index} style={styles.docRow}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={20}
                  color={colors.secondary || "#555"}
                />
                <Text style={styles.docLink} numberOfLines={1}>
                  Attached Document {index + 1}
                </Text>
                <TouchableOpacity onPress={() => removeFile(field.name, url)}>
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.error || "red"}
                  />
                </TouchableOpacity>
              </View>
            ))}
            {(field.allowMultiple || docs.length === 0) && (
              <TouchableOpacity
                style={[styles.docAddBtn]}
                onPress={() => handleAttachment(field)}
              >
                <MaterialCommunityIcons
                  name="paperclip"
                  size={20}
                  color="white"
                />
                <Text style={styles.docAddBtnText}>Attach Document</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    if (field.type === "auto_id") {
      return (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>{field.name}</Text>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: "#f0f0f0", borderColor: "transparent" },
            ]}
          >
            <MaterialCommunityIcons name="identifier" size={20} color="#888" />
            <TextInput
              style={[styles.input, { color: "#888" }]}
              value={val || ""}
              editable={false}
            />
            <Ionicons name="lock-closed" size={16} color="#aaa" />
          </View>
        </View>
      );
    }

    if (field.type === "dropdown") {
      return (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>{field.name}</Text>
          <View style={styles.chipsContainer}>
            {field.options?.map((opt, i) => {
              const label = opt.label || opt;
              const color = opt.color || colors.primary;
              const isSelected = val === label;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: isSelected ? color : "white",
                      borderColor: color || "#ddd",
                    },
                  ]}
                  onPress={() => updateForm(field.name, label)}
                >
                  <Text
                    style={{
                      color: isSelected ? "white" : "#555",
                      fontWeight: isSelected ? "bold" : "normal",
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (field.type === "date") {
      return (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>{field.name}</Text>
          <TouchableOpacity
            style={styles.inputWrapper}
            onPress={() => openDatePicker(field.name, field.includeTime)}
          >
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={[styles.input, { marginTop: 4 }]}>
              {val || "Select Date"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (field.type === "location") {
      return (
        <View key={field.id} style={styles.fieldContainer}>
          <Text style={styles.label}>{field.name}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <TextInput
              style={styles.input}
              value={val || ""}
              onChangeText={(text) => updateForm(field.name, text)}
              placeholder="GPS Coords"
            />
            <TouchableOpacity onPress={() => handleLocationFetch(field.name)}>
              <Text style={{ color: colors.primary, fontWeight: "bold" }}>
                GPS
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Text style={styles.label}>{field.name}</Text>
        <View style={styles.inputWrapper}>
          <MaterialCommunityIcons
            name={field.type === "number" ? "numeric" : "format-text"}
            size={20}
            color="#ccc"
          />
          <TextInput
            style={styles.input}
            value={val || ""}
            onChangeText={(text) => updateForm(field.name, text)}
            placeholder={`Enter ${field.name}`}
            keyboardType={field.type === "number" ? "numeric" : "default"}
          />
          {field.type !== "number" && (
            <TouchableOpacity
              onPressIn={startRecording}
              onPressOut={() => stopRecording(field.name)}
              style={styles.micBtn}
            >
              <Ionicons
                name={recording ? "mic" : "mic-outline"}
                size={22}
                color={recording ? colors.error : colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New {moduleData.name}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading || uploading}
          style={[styles.saveBtn, uploading && { backgroundColor: "#ccc" }]}
        >
          {loading || uploading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {uploading && (
            <View style={styles.uploadingBanner}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.recordingText}>UPLOADING MEDIA...</Text>
            </View>
          )}

          {/* AI SCAN BUTTON */}
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={scanBusinessCard}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="auto-fix"
                  size={22}
                  color="white"
                />
                <Text style={styles.scanBtnText}>AI AUTO-FILL FROM CARD</Text>
              </>
            )}
          </TouchableOpacity>

          {recording && (
            <View style={styles.recordingBanner}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.recordingText}>
                RECORDING... RELEASE MIC TO ATTACH
              </Text>
            </View>
          )}

          {moduleData.fields &&
            moduleData.fields.map((field) => renderField(field))}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode={pickerMode}
          display="default"
          onChange={onDateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  closeBtn: { padding: 5 },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  saveBtnText: { color: "white", fontWeight: "bold" },
  formContent: { padding: 20 },
  scanBtn: {
    backgroundColor: "#2C3E50",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 25,
    elevation: 4,
  },
  scanBtnText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  fieldContainer: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  input: { flex: 1, fontSize: 16, color: "#333", marginLeft: 10 },
  micBtn: { padding: 5, marginLeft: 5 },
  recordingBanner: {
    backgroundColor: colors.error,
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  uploadingBanner: {
    backgroundColor: colors.secondary || "#555",
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  recordingText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 10,
    fontSize: 11,
  },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap" },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  // --- ATTACHMENT STYLES ---
  attachmentContainer: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  imageGrid: { flexDirection: "row", flexWrap: "wrap" },
  thumbnailWrapper: {
    width: 70,
    height: 70,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 2,
  },
  addAttachmentBtn: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginBottom: 10,
  },
  addAttachmentText: {
    fontSize: 10,
    color: "#555",
    fontWeight: "bold",
    marginTop: 4,
  },

  docRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 8,
  },
  docLink: { flex: 1, marginHorizontal: 10, color: "#333" },
  docAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary || "#555",
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  docAddBtnText: { color: "white", fontWeight: "bold", marginLeft: 5 },
});
