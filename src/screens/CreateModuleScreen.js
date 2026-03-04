import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, setDoc } from "firebase/firestore";
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
import colors from "../colors"; // Ensure this path is correct
import { auth, db } from "../firebaseConfig";

// --- COLOR PALETTE FOR TAGS ---
const TAG_COLORS = [
  { name: "Gray", code: "#E0E0E0", text: "#333" },
  { name: "Red", code: "#FFEBEE", text: "#D32F2F" },
  { name: "Green", code: "#E8F5E9", text: "#388E3C" },
  { name: "Blue", code: "#E3F2FD", text: "#1976D2" },
  { name: "Orange", code: "#FFF3E0", text: "#F57C00" },
  { name: "Purple", code: "#F3E5F5", text: "#7B1FA2" },
];

// --- AVAILABLE FIELD TYPES ---
// Added 'image' and 'document' to this list
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
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]); // Default Gray

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
      {/* 1. HEADER ROW */}
      <View style={styles.fieldHeader}>
        <View style={styles.fieldBadge}>
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <TextInput
          style={styles.fieldNameInput}
          placeholder="Field Name (e.g. Site Photo)"
          value={field.name}
          onChangeText={(text) => updateField(field.id, "name", text)}
        />
        <TouchableOpacity
          onPress={() => removeField(field.id)}
          style={styles.trashBtn}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={colors.error || "#ff4444"}
          />
        </TouchableOpacity>
      </View>

      {/* 2. TYPE SELECTOR */}
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
              size={18}
              color={field.type === type ? "white" : "#555"}
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

      {/* 3. DYNAMIC CONFIGURATION */}

      {/* IMAGE & DOCUMENT SETTINGS */}
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

      {/* DROPDOWN BUILDER WITH COLORS */}
      {field.type === "dropdown" && (
        <View style={styles.configSection}>
          <Text style={styles.configLabel}>Dropdown Options & Colors:</Text>

          <View style={styles.optionInputRow}>
            <TextInput
              style={styles.optionInput}
              placeholder="Option name (e.g. Paid)"
              value={tempOption}
              onChangeText={setTempOption}
            />

            {/* Color Picker Dot */}
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

          {/* Chips Display */}
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
                    fontWeight: "600",
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

      {/* AUTO ID */}
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

      {/* DATE & LOCATION */}
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

      {/* 4. VISIBILITY & SEARCH SETTINGS */}
      <View style={styles.divider} />
      <View style={styles.settingsRow}>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Use as Filter?</Text>
          <Text style={styles.settingSub}>Can search by this</Text>
          <Switch
            value={field.isFilterable || false}
            onValueChange={(val) => updateField(field.id, "isFilterable", val)}
            trackColor={{ true: colors.primary }}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>

        <View style={styles.verticalLine} />

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Show in List?</Text>
          <Text style={styles.settingSub}>Visible on cards</Text>
          <Switch
            value={field.isSummary || false}
            onValueChange={(val) => updateField(field.id, "isSummary", val)}
            trackColor={{ true: colors.secondary || "#444" }}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>
    </View>
  );
};

// --- MAIN SCREEN ---
export default function CreateModuleScreen({ navigation }) {
  const [moduleName, setModuleName] = useState("");
  const [loading, setLoading] = useState(false);

  // Default fields now include an example 'Name' field
  const [fields, setFields] = useState([
    {
      id: Date.now(),
      name: "Name",
      type: "text",
      isFilterable: true,
      isSummary: true,
    },
  ]);

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

  const removeField = (id) => {
    if (fields.length === 1)
      return Alert.alert("Required", "You need at least one field!");
    setFields(fields.filter((f) => f.id !== id));
  };

  const updateField = (id, key, value) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  };

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

  const handleSave = async () => {
    if (!moduleName.trim())
      return Alert.alert("Missing Name", "Please name your module.");

    // Validation
    for (let f of fields) {
      if (!f.name.trim())
        return Alert.alert("Incomplete", "All fields must have a name.");
      if (f.type === "dropdown" && (!f.options || f.options.length === 0)) {
        return Alert.alert(
          "Missing Options",
          `The dropdown "${f.name}" has no options.`,
        );
      }
    }

    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      // Save the module structure
      await setDoc(doc(db, "users", userId, "modules", moduleName), {
        name: moduleName,
        fields: fields, // This now includes types 'image' and 'document'
        createdAt: new Date(),
        admins: [userId],
        members: [],
      });

      Alert.alert("Success", `Created "${moduleName}" app!`);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* 1. HEADER (Fixed Top) */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
          >
            <Ionicons name="close" size={24} color={colors.text || "#333"} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Module</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>{loading ? "..." : "Save"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>MODULE NAME</Text>
          <TextInput
            style={styles.mainInput}
            placeholder="e.g. Site Visits, Receipts"
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
            <Text style={styles.addFieldText}>Add Another Field</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },

  // Header
  header: {
    backgroundColor: "white",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#333",
    letterSpacing: 0.5,
  },
  iconBtn: { padding: 5 },
  saveBtn: {
    backgroundColor: colors.primary || "#A3B18A",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  saveBtnText: { color: "white", fontWeight: "bold", fontSize: 14 },

  content: { padding: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    marginBottom: 10,
    marginTop: 10,
    letterSpacing: 1,
  },
  mainInput: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    elevation: 2,
  },
  fieldHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
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
  fieldNameInput: { flex: 1, fontSize: 18, fontWeight: "600", color: "#333" },
  trashBtn: { padding: 5 },

  // Type Chips
  typeScroller: { marginBottom: 15 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  activeTypeChip: {
    backgroundColor: colors.primary || "#A3B18A",
    borderColor: colors.primary || "#A3B18A",
  },
  typeText: { fontSize: 13, fontWeight: "600", marginLeft: 5, color: "#555" },

  // Config Sections
  configSection: {
    backgroundColor: "#FAFAFA",
    padding: 12,
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

  optionInputRow: { flexDirection: "column", marginBottom: 10 },
  optionInput: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    fontSize: 14,
    marginBottom: 8,
  },

  colorPickerRow: {
    flexDirection: "row",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    elevation: 1,
    marginRight: 8,
  },
  activeColorDot: {
    borderWidth: 2,
    borderColor: "#333",
    transform: [{ scale: 1.1 }],
  },

  addOptionBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary || "#555",
    borderRadius: 8,
    padding: 12,
    marginTop: 5,
  },

  chipsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 6,
    marginBottom: 6,
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
    paddingHorizontal: 5,
  },

  // Settings Row
  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 12 },
  settingsRow: { flexDirection: "row", justifyContent: "space-around" },
  settingItem: { alignItems: "center", width: "45%" },
  settingLabel: { fontSize: 12, fontWeight: "bold", color: "#555" },
  settingSub: { fontSize: 10, color: "#999", marginBottom: 5 },
  verticalLine: { width: 1, backgroundColor: "#f0f0f0", height: "100%" },

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
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  addFieldText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary || "#A3B18A",
    marginLeft: 5,
  },
});
