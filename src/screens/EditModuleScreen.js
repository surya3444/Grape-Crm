import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../colors";
import { auth, db } from "../firebaseConfig";

const TAG_COLORS = [
  { name: "Gray", code: "#E0E0E0", text: "#333" },
  { name: "Red", code: "#FFEBEE", text: "#D32F2F" },
  { name: "Green", code: "#E8F5E9", text: "#388E3C" },
  { name: "Blue", code: "#E3F2FD", text: "#1976D2" },
  { name: "Orange", code: "#FFF3E0", text: "#F57C00" },
  { name: "Purple", code: "#F3E5F5", text: "#7B1FA2" },
];

// List of all available types including the new Media ones
const FIELD_TYPES = [
  "text",
  "number",
  "dropdown",
  "date",
  "location",
  "image",
  "document",
  "auto_id",
];

const FieldCard = ({
  field,
  index,
  updateField,
  removeField,
  addOptionToField,
  removeOptionFromField,
}) => {
  const [tempOption, setTempOption] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

  // Helper to get icon for type
  const getTypeIcon = (type) => {
    switch (type) {
      case "text":
        return "format-text";
      case "number":
        return "numeric";
      case "dropdown":
        return "form-dropdown";
      case "date":
        return "calendar-clock";
      case "location":
        return "map-marker";
      case "image":
        return "image-multiple"; // New Icon
      case "document":
        return "file-document-outline"; // New Icon
      case "auto_id":
        return "identifier";
      default:
        return "help-circle";
    }
  };

  return (
    <View style={styles.fieldCard}>
      {/* 1. Header Row (Name & Delete) */}
      <View style={styles.fieldHeader}>
        <View style={styles.fieldBadge}>
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <TextInput
          style={styles.fieldNameInput}
          placeholder="Field Name"
          value={field.name}
          onChangeText={(text) => updateField(field.id, "name", text)}
        />
        <TouchableOpacity
          onPress={() => removeField(field.id)}
          style={styles.trashBtn}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* 2. Type Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeScroller}
      >
        {FIELD_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => updateField(field.id, "type", type)}
            style={[
              styles.typeChip,
              field.type === type && styles.activeTypeChip,
            ]}
          >
            <MaterialCommunityIcons
              name={getTypeIcon(type)}
              size={16}
              color={field.type === type ? "white" : colors.text}
            />
            <Text
              style={[
                styles.typeText,
                field.type === type && { color: "white" },
              ]}
            >
              {type === "auto_id"
                ? "Auto ID"
                : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 3. Configuration Section */}

      {/* IMAGE & DOCUMENT CONFIG (NEW) */}
      {(field.type === "image" || field.type === "document") && (
        <View style={styles.configSection}>
          <Text style={styles.configLabel}>
            {field.type === "image" ? "Image Settings:" : "Document Settings:"}
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.settingLabel}>Allow Multiple Files?</Text>
            <Switch
              value={field.allowMultiple || false}
              onValueChange={(val) =>
                updateField(field.id, "allowMultiple", val)
              }
              trackColor={{ true: colors.primary }}
            />
          </View>
        </View>
      )}

      {/* Dropdown Builder */}
      {field.type === "dropdown" && (
        <View style={styles.configSection}>
          <Text style={styles.configLabel}>Edit Options:</Text>
          <View style={styles.optionInputRow}>
            <TextInput
              style={styles.optionInput}
              placeholder="Add Option"
              value={tempOption}
              onChangeText={setTempOption}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.colorPickerRow}
            >
              {TAG_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c.code },
                    selectedColor.code === c.code && styles.activeColorDot,
                  ]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.addOptionBtn}
              onPress={() => {
                addOptionToField(field.id, tempOption, selectedColor);
                setTempOption("");
              }}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.chipsContainer}>
            {field.options?.map((opt, i) => (
              <View
                key={i}
                style={[
                  styles.optionChip,
                  { backgroundColor: opt.color || "#eee" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    marginRight: 5,
                    color: opt.textColor || "#333",
                  }}
                >
                  {opt.label}
                </Text>
                <TouchableOpacity
                  onPress={() => removeOptionFromField(field.id, opt.label)}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={opt.textColor || "#888"}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Auto ID Config */}
      {field.type === "auto_id" && (
        <View style={styles.configSection}>
          <Text style={styles.configLabel}>ID Prefix:</Text>
          <TextInput
            style={styles.optionInput}
            placeholder="e.g. INV-"
            value={field.prefix}
            onChangeText={(text) => updateField(field.id, "prefix", text)}
          />
        </View>
      )}

      {/* Date Config */}
      {field.type === "date" && (
        <View style={styles.switchRow}>
          <Text style={styles.configLabel}>Include Time?</Text>
          <Switch
            value={field.includeTime || false}
            onValueChange={(val) => updateField(field.id, "includeTime", val)}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}

      {/* 4. Visibility Toggles */}
      <View style={styles.divider} />
      <View style={styles.settingsRow}>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Filter?</Text>
          <Switch
            value={field.isFilterable || false}
            onValueChange={(val) => updateField(field.id, "isFilterable", val)}
            trackColor={{ true: colors.primary }}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>In List?</Text>
          <Switch
            value={field.isSummary || false}
            onValueChange={(val) => updateField(field.id, "isSummary", val)}
            trackColor={{ true: colors.secondary }}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>
    </View>
  );
};

export default function EditModuleScreen({ route, navigation }) {
  const { moduleData } = route.params;
  const user = auth.currentUser;

  const [moduleName, setModuleName] = useState(moduleData.name);
  const [fields, setFields] = useState(moduleData.fields || []);
  const [loading, setLoading] = useState(false);

  const addField = () => {
    setFields([
      ...fields,
      {
        id: Date.now(),
        name: "",
        type: "text",
        options: [],
        prefix: "#",
        isFilterable: false,
        isSummary: false,
      },
    ]);
  };
  const removeField = (id) => setFields(fields.filter((f) => f.id !== id));
  const updateField = (id, key, value) =>
    setFields(fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)));

  const addOptionToField = (fieldId, label, colorObj) => {
    if (!label.trim()) return;
    const field = fields.find((f) => f.id === fieldId);
    const newOption = { label, color: colorObj.code, textColor: colorObj.text };
    const updatedOptions = [...(field.options || []), newOption];
    updateField(fieldId, "options", updatedOptions);
  };

  const removeOptionFromField = (fieldId, labelToRemove) => {
    const field = fields.find((f) => f.id === fieldId);
    const updatedOptions = field.options.filter(
      (o) => o.label !== labelToRemove,
    );
    updateField(fieldId, "options", updatedOptions);
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      // Logic assumes you are owner or have permission.
      // Ensure 'moduleData.ownerId' or current user ID is used correctly based on your app structure.
      const targetOwnerId = moduleData.ownerId || user.uid;
      const docRef = doc(db, "users", targetOwnerId, "modules", moduleData.id);

      await updateDoc(docRef, {
        name: moduleName,
        fields: fields,
        updatedAt: new Date(),
      });

      Alert.alert("Success", "Module updated!");
      // Pop back to the list screen, or main menu
      navigation.navigate("ModuleList", {
        moduleData: { ...moduleData, name: moduleName, fields },
      });
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Structure</Text>
          <TouchableOpacity
            onPress={handleUpdate}
            disabled={loading}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>{loading ? "..." : "Update"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>MODULE NAME</Text>
          <TextInput
            style={styles.mainInput}
            value={moduleName}
            onChangeText={setModuleName}
          />

          <Text style={styles.sectionLabel}>DATA FIELDS</Text>
          {fields.map((field, index) => (
            <FieldCard
              key={field.id}
              field={field}
              index={index}
              updateField={updateField}
              removeField={removeField}
              addOptionToField={addOptionToField}
              removeOptionFromField={removeOptionFromField}
            />
          ))}

          <TouchableOpacity style={styles.addFieldBtn} onPress={addField}>
            <Ionicons name="add" size={24} color={colors.primary} />
            <Text style={styles.addFieldText}>Add New Field</Text>
          </TouchableOpacity>
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    backgroundColor: "white",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  saveBtnText: { color: "white", fontWeight: "bold" },
  content: { padding: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    marginBottom: 10,
    marginTop: 10,
  },
  mainInput: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
  },

  // Field Card
  fieldCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eee",
    elevation: 2,
  },
  fieldHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  fieldBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  badgeText: { fontSize: 12, fontWeight: "bold", color: "#666" },
  fieldNameInput: { flex: 1, fontSize: 16, fontWeight: "600" },

  // Type Selectors
  typeScroller: { marginBottom: 15 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  activeTypeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeText: { fontSize: 12, fontWeight: "600", marginLeft: 5, color: "#555" },

  // Configuration
  configSection: {
    backgroundColor: "#FAFAFA",
    padding: 10,
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  configLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#888",
    marginBottom: 8,
  },
  optionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
    backgroundColor: "white",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    fontSize: 14,
    marginRight: 5,
  },
  colorPickerRow: { flexDirection: "row", marginRight: 5 },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  activeColorDot: { borderWidth: 2, borderColor: "#333" },
  addOptionBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    padding: 8,
  },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap" },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },

  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 10 },
  settingsRow: { flexDirection: "row", justifyContent: "space-around" },
  settingItem: { alignItems: "center" },
  settingLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
    paddingHorizontal: 5,
  },

  addFieldBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    padding: 15,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
  },
  addFieldText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
    marginLeft: 5,
  },
});
