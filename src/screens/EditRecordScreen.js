import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../colors";
import { auth, db } from "../firebaseConfig";

export default function EditRecordScreen({ route, navigation }) {
  // CRITICAL: Get ownerId to know WHICH database to update
  const { moduleData, recordData, ownerId } = route.params;
  const user = auth.currentUser;

  // Initialize with existing data
  const [formData, setFormData] = useState(recordData);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- AUDIO STATE ---
  const [recording, setRecording] = useState(null);

  // --- DATE/TIME PICKER STATE ---
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState(null);
  const [pickerMode, setPickerMode] = useState("date");
  const [tempDate, setTempDate] = useState(null);

  // --- FILE UPLOAD HANDLERS ---
  const uploadFileToFirebase = async (uri, fileName) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storage = getStorage();
      const storageRef = ref(
        storage,
        `uploads/${moduleData.id}/${recordData.id}/${Date.now()}_${fileName}`,
      );

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error("Upload failed", error);
      throw error;
    }
  };

  const handleAttachment = async (field) => {
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
        setUploading(true);
        const assets = result.assets || [result];
        const newUrls = [];

        for (const asset of assets) {
          const uri = asset.uri;
          const name = asset.name || asset.fileName || "file";
          const url = await uploadFileToFirebase(uri, name);
          newUrls.push(url);
        }

        const oldData = formData[field.name] || [];
        const oldArray = Array.isArray(oldData)
          ? oldData
          : oldData
            ? [oldData]
            : [];

        updateForm(field.name, [...oldArray, ...newUrls]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to upload file: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fieldName, urlToRemove) => {
    const currentFiles = formData[fieldName] || [];
    if (Array.isArray(currentFiles)) {
      const updated = currentFiles.filter((url) => url !== urlToRemove);
      updateForm(fieldName, updated);
    } else {
      updateForm(fieldName, []);
    }
  };

  // --- AUDIO HANDLERS ---
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

  // --- FORM HANDLERS ---
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
    if (Platform.OS === "ios" && includeTime) {
      setPickerMode("datetime");
    } else {
      setPickerMode("date");
    }
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }

    const fieldDef = moduleData.fields.find((f) => f.name === currentDateField);
    const includeTime = fieldDef?.includeTime;

    if (Platform.OS === "android" && includeTime) {
      if (pickerMode === "date") {
        setShowDatePicker(false);
        setTempDate(selectedDate);
        setPickerMode("time");
        setTimeout(() => setShowDatePicker(true), 100);
        return;
      }
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
      if (includeTime) {
        const hours = String(finalDateObj.getHours()).padStart(2, "0");
        const minutes = String(finalDateObj.getMinutes()).padStart(2, "0");
        dateString += ` ${hours}:${minutes}`;
      }
      updateForm(currentDateField, dateString);
      setTempDate(null);
    }
  };

  const handleUpdate = async () => {
    if (uploading) {
      Alert.alert("Wait", "Please wait for files to finish uploading.");
      return;
    }
    setLoading(true);
    try {
      const targetOwnerId = ownerId || user.uid;
      const docRef = doc(
        db,
        "users",
        targetOwnerId,
        "modules",
        moduleData.id,
        "records",
        recordData.id,
      );

      const changes = [];
      moduleData.fields.forEach((field) => {
        if (!field.name) return; // Skip history for unnamed fields
        const oldVal = JSON.stringify(recordData[field.name]);
        const newVal = JSON.stringify(formData[field.name]);
        if (oldVal !== newVal) {
          changes.push({ field: field.name, action: "edited" });
        }
      });

      if (changes.length > 0) {
        const historyRef = collection(
          db,
          "users",
          targetOwnerId,
          "modules",
          moduleData.id,
          "records",
          recordData.id,
          "history",
        );
        await addDoc(historyRef, {
          modifiedBy: user.displayName || "User",
          modifiedById: user.uid,
          timestamp: new Date(),
          changes: changes,
          action: "update",
        });
      }

      const { id, ...dataToSave } = formData;

      // 🔥 FIREBASE FIX: Strip 'undefined' values AND empty/blank keys ("")
      const sanitizedData = {};
      Object.keys(dataToSave).forEach((key) => {
        // Only keep the data if the key has actual text and isn't undefined
        if (key && key.trim() !== "" && dataToSave[key] !== undefined) {
          sanitizedData[key] = dataToSave[key];
        }
      });

      await updateDoc(docRef, {
        ...sanitizedData,
        updatedAt: new Date(),
        lastModifiedBy: user.uid,
      });

      Alert.alert("Success", "Record Updated!");
      navigation.pop(2);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };
  const renderField = (field) => {
    const val = formData[field.name];

    // --- 1. IMAGE FIELD ---
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
              {(field.allowMultiple || images.length === 0) && (
                <TouchableOpacity
                  style={styles.addAttachmentBtn}
                  onPress={() => handleAttachment(field)}
                >
                  <Ionicons name="camera" size={24} color={colors.primary} />
                  <Text style={styles.addAttachmentText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    }

    // --- 2. DOCUMENT FIELD ---
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
                <Text
                  style={styles.docLink}
                  numberOfLines={1}
                  onPress={() => Linking.openURL(url)}
                >
                  Document {index + 1}
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
                style={[
                  styles.addAttachmentBtn,
                  { borderColor: colors.secondary || "#555" },
                ]}
                onPress={() => handleAttachment(field)}
              >
                <MaterialCommunityIcons
                  name="paperclip"
                  size={20}
                  color={colors.secondary || "#555"}
                />
                <Text
                  style={[
                    styles.addAttachmentText,
                    { color: colors.secondary || "#555" },
                  ]}
                >
                  Attach File
                </Text>
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
              const label = typeof opt === "object" ? opt.label : opt;
              const color =
                typeof opt === "object" ? opt.color : colors.primary;
              const textColor =
                typeof opt === "object" ? opt.textColor : "white";
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
                      color: isSelected ? textColor : "#555",
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
              placeholder="Coordinates"
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

    // DEFAULT TEXT FIELD
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
            value={val ? String(val) : ""}
            onChangeText={(text) => updateForm(field.name, text)}
            placeholder={`Enter ${field.name}`}
            keyboardType={field.type === "number" ? "numeric" : "default"}
            multiline={field.name.toLowerCase().includes("description")}
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
        <Text style={styles.headerTitle}>Edit Record</Text>
        <TouchableOpacity
          onPress={handleUpdate}
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
              <Text style={styles.recordingText}>Uploading media...</Text>
            </View>
          )}

          {recording && (
            <View style={styles.recordingBanner}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.recordingText}>RECORDING VOICE NOTE...</Text>
            </View>
          )}

          {moduleData.fields.map((field) => renderField(field))}
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
    paddingTop: 50,
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
    fontSize: 12,
  },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap" },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
  },

  // --- Attachment Styles ---
  attachmentContainer: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  imageGrid: { flexDirection: "row", flexWrap: "wrap" },
  thumbnailWrapper: {
    width: 80,
    height: 80,
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
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginBottom: 10,
  },
  addAttachmentText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },

  docRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 8,
  },
  docLink: {
    flex: 1,
    marginHorizontal: 10,
    color: "#3378FF",
    textDecorationLine: "underline",
  },
});
