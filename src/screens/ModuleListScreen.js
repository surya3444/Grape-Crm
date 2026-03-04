import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../colors";
import { auth, db } from "../firebaseConfig";

// --- IMPORTS FOR EXPORT FEATURE ---
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export default function ModuleListScreen({ route, navigation }) {
  // 1. Get Initial Data
  const initialData = route.params?.moduleData;
  const user = auth.currentUser;
  const ownerId = initialData?.ownerId || user.uid;
  const moduleId = initialData?.id;

  // State
  const [moduleData, setModuleData] = useState(initialData);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // UI State
  const [searchText, setSearchText] = useState("");
  const [showMyRecords, setShowMyRecords] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [showMenu, setShowMenu] = useState(false);
  const [filterModalField, setFilterModalField] = useState(null);
  const [creatorName, setCreatorName] = useState("Loading...");

  // --- EFFECT 1: FETCH MODULE ---
  useEffect(() => {
    if (!moduleId || !ownerId) return;
    const moduleDocRef = doc(db, "users", ownerId, "modules", moduleId);

    const unsubModule = onSnapshot(
      moduleDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const fullData = { id: docSnap.id, ...docSnap.data() };
          setModuleData((prev) => ({ ...prev, ...fullData, ownerId }));
          fetchCreatorName(ownerId);
        } else {
          Alert.alert("Error", "This module no longer exists.");
          navigation.goBack();
        }
      },
      (err) => {
        console.log("Module Read Error:", err);
        Alert.alert(
          "Access Denied",
          "You do not have permission to view this module.",
        );
        navigation.goBack();
      },
    );

    return () => unsubModule();
  }, [moduleId, ownerId]);

  // --- EFFECT 2: FETCH RECORDS ---
  useEffect(() => {
    if (!moduleData || !moduleData.name) return;
    const recordsRef = collection(
      db,
      "users",
      ownerId,
      "modules",
      moduleId,
      "records",
    );
    const q = query(recordsRef, orderBy("createdAt", "desc"));

    const unsubRecords = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecords(fetched);
      setLoading(false);
    });

    return () => unsubRecords();
  }, [moduleData]);

  const fetchCreatorName = async (id) => {
    if (id === user.uid) {
      setCreatorName("You");
      return;
    }
    try {
      const uSnap = await getDoc(doc(db, "users", id));
      if (uSnap.exists()) setCreatorName(uSnap.data().name);
    } catch (e) {
      console.log(e);
    }
  };

  // --- EXPORT FUNCTIONS ---
  const generatePDF = async () => {
    setIsExporting(true);
    try {
      const fields = moduleData.fields;
      const headers = fields.map((f) => `<th>${f.name}</th>`).join("");
      const rows = records
        .map((r) => {
          const cells = fields
            .map((f) => {
              const val = r[f.name];
              if (f.type === "image" || f.type === "document") {
                return `<td>${Array.isArray(val) ? val.length + " Files" : val ? "1 File" : "-"}</td>`;
              }
              return `<td>${val || "-"}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      const html = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, sans-serif; padding: 30px; }
              header { display: flex; align-items: center; border-bottom: 3px solid ${colors.primary}; padding-bottom: 20px; margin-bottom: 30px; }
              .logo { width: 50px; height: 50px; margin-right: 15px; }
              h1 { color: ${colors.primary}; margin: 0; font-size: 24px; }
              p { color: #666; margin: 5px 0 0 0; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 10px; }
              th { background-color: #f2f2f2; text-align: left; padding: 8px; border: 1px solid #ddd; }
              td { padding: 8px; border: 1px solid #ddd; }
              tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
          </head>
          <body>
            <header>
              <img src="https://img.icons8.com/color/96/grapes.png" class="logo" />
              <div>
                <h1>${moduleData.name} Report</h1>
                <p>Generated by Grape CRM • ${new Date().toLocaleDateString()}</p>
                <p>Total Records: ${records.length}</p>
              </div>
            </header>
            <table>
              <thead><tr>${headers}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
      });
    } catch (error) {
      Alert.alert("Export Error", error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const generateCSV = async () => {
    setIsExporting(true);
    try {
      const fields = moduleData.fields;
      let csv = fields.map((f) => `"${f.name}"`).join(",") + "\n";
      records.forEach((r) => {
        const row = fields
          .map((f) => {
            let val = r[f.name] || "";
            if (Array.isArray(val)) val = val.join("; ");
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(",");
        csv += row + "\n";
      });
      const fileName = `${moduleData.name.replace(/\s+/g, "_")}_data.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        UTI: "public.comma-separated-values-text",
        mimeType: "text/csv",
      });
    } catch (error) {
      Alert.alert("Export Error", error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // --- ACTIONS ---
  const handleDeleteModule = async () => {
    Alert.alert("Delete List?", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "users", ownerId, "modules", moduleId));
          navigation.popToTop();
        },
      },
    ]);
  };

  const applyFilter = (fieldName, value) => {
    if (!value) {
      const newFilters = { ...activeFilters };
      delete newFilters[fieldName];
      setActiveFilters(newFilters);
    } else {
      setActiveFilters({ ...activeFilters, [fieldName]: value });
    }
    setFilterModalField(null);
  };

  // --- FILTERING ---
  const filteredRecords = records.filter((record) => {
    if (showMyRecords && record.createdBy !== user.uid) return false;
    for (const [key, value] of Object.entries(activeFilters)) {
      if (record[key] !== value) return false;
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      return (moduleData.fields || []).some(
        (f) =>
          record[f.name] &&
          String(record[f.name]).toLowerCase().includes(lower),
      );
    }
    return true;
  });

  // --- HELPERS ---
  const getBadgeStyle = (fieldName, value) => {
    const field = moduleData.fields?.find((f) => f.name === fieldName);
    const opt = field?.options?.find((o) => (o.label || o) === value);
    return opt
      ? { bg: opt.color || "#eee", txt: opt.textColor || "#333" }
      : null;
  };

  const isImageUrl = (val) => {
    // Helper to check if a value looks like a Firebase Storage Image URL
    if (
      typeof val === "string" &&
      val.includes("firebasestorage") &&
      (val.includes(".jpg") ||
        val.includes(".png") ||
        val.includes(".jpeg") ||
        val.includes("alt=media"))
    )
      return true;
    return false;
  };

  const renderRecordItem = ({ item }) => {
    const fields = moduleData.fields || [];
    if (fields.length === 0) return null;

    // The first field is usually the "Title"
    const firstField = fields[0];
    let primaryVal = item[firstField.name];

    // FIX: If primary value is an image URL (array or string), don't show raw text
    let primaryTitle = "Untitled";
    if (primaryVal) {
      if (Array.isArray(primaryVal) && primaryVal.length > 0) {
        primaryTitle = isImageUrl(primaryVal[0])
          ? "📷 Image Record"
          : primaryVal[0];
      } else if (isImageUrl(primaryVal)) {
        primaryTitle = "📷 Image Record";
      } else {
        primaryTitle = primaryVal;
      }
    }

    // Filter summary fields
    const summary = fields.filter((f) => f.isSummary && f.id !== fields[0].id);

    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() =>
          navigation.navigate("RecordDetail", {
            moduleData,
            recordData: item,
            ownerId,
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.recordTitle}>{primaryTitle}</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </View>
        <View style={styles.summaryContainer}>
          {summary.map((f) => {
            const val = item[f.name];
            // If empty, skip
            if (!val || (Array.isArray(val) && val.length === 0)) return null;

            const firstVal = Array.isArray(val) ? val[0] : val;
            const count = Array.isArray(val) ? val.length : 1;

            // --- SMART IMAGE DETECT (Checks Type OR URL Pattern) ---
            if (f.type === "image" || isImageUrl(firstVal)) {
              return (
                <View key={f.id} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{f.name}:</Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Image
                      source={{ uri: firstVal }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 6,
                        marginRight: 5,
                        backgroundColor: "#eee",
                      }}
                    />
                    {count > 1 && (
                      <Text style={{ fontSize: 10, color: "#888" }}>
                        +{count - 1}
                      </Text>
                    )}
                  </View>
                </View>
              );
            }

            // --- DOCUMENT HANDLER ---
            if (f.type === "document") {
              return (
                <View key={f.id} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{f.name}:</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(firstVal)}
                    style={styles.docLinkBtn}
                  >
                    <MaterialCommunityIcons
                      name="file-download-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.docLinkText}>Download File</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // --- DROPDOWN HANDLER ---
            if (f.type === "dropdown") {
              const style = getBadgeStyle(f.name, val);
              return (
                <View key={f.id} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{f.name}:</Text>
                  <View style={[styles.badge, { backgroundColor: style?.bg }]}>
                    <Text style={[styles.badgeText, { color: style?.txt }]}>
                      {val}
                    </Text>
                  </View>
                </View>
              );
            }

            // --- DEFAULT TEXT ---
            return (
              <View key={f.id} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{f.name}:</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {String(val)}
                </Text>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };

  // --- PERMISSIONS VARS ---
  const myPermission = moduleData?.members?.[user.uid]?.permissions || {};
  const isOwner = ownerId === user.uid;
  const canEditModule = isOwner || myPermission.canEditModule;
  const canDeleteModule = isOwner;
  const canManageMembers = isOwner || myPermission.canEditModule;

  if (!moduleData || !moduleData.fields)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 10, color: "#888" }}>Loading...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* ----- UPDATED TITLE: TRUNCATED TO 10 CHARS ----- */}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {moduleData.name.length > 10
              ? moduleData.name.substring(0, 10) + "..."
              : moduleData.name}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("KanbanBoard", { moduleData, ownerId })
              }
              style={{ marginRight: 15 }}
            >
              <MaterialCommunityIcons
                name="view-column"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate("MapView", { moduleData, ownerId })
              }
              style={{ marginRight: 15 }}
            >
              <Ionicons name="map-outline" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Stats", { moduleData, ownerId })
              }
              style={{ marginRight: 15 }}
            >
              <Ionicons name="stats-chart" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CalendarView", { moduleData, ownerId })
              }
              style={{ marginRight: 15 }}
            >
              <Ionicons name="calendar" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowMenu(true)}
              style={styles.backBtn}
            >
              <MaterialCommunityIcons
                name="cog"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBarWrapper}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Filter Bar */}
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                showMyRecords && styles.activeFilterChip,
              ]}
              onPress={() => setShowMyRecords(!showMyRecords)}
            >
              <Ionicons
                name="person"
                size={14}
                color={showMyRecords ? "white" : "#555"}
              />
              <Text
                style={[styles.filterText, showMyRecords && { color: "white" }]}
              >
                My Records
              </Text>
            </TouchableOpacity>
            <View style={styles.verticalDivider} />
            {moduleData.fields
              .filter((f) => f.isFilterable)
              .map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.filterChip,
                    activeFilters[f.name] && styles.activeFilterChip,
                  ]}
                  onPress={() => setFilterModalField(f)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      activeFilters[f.name] && { color: "white" },
                    ]}
                  >
                    {f.name}
                    {activeFilters[f.name] ? `: ${activeFilters[f.name]}` : ""}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={12}
                    color={activeFilters[f.name] ? "white" : "#999"}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </View>

      {/* BODY */}
      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 50 }}
          />
        ) : (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item) => item.id}
            renderItem={renderRecordItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="folder-open-outline"
                  size={60}
                  color="#ddd"
                />
                <Text style={styles.emptyText}>No records found.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* FAB */}
      {(isOwner || myPermission.canEditRecords !== false) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            navigation.navigate("AddRecord", { moduleData, ownerId })
          }
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      )}

      {/* SETTINGS MODAL */}
      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowMenu(false)}
          activeOpacity={1}
        >
          <View style={styles.menuBox}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 5,
              }}
            >
              <MaterialCommunityIcons
                name="fruit-grapes"
                size={24}
                color={colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.menuTitle}>List Settings</Text>
            </View>
            <View style={styles.metaInfoBox}>
              <Text style={styles.metaText}>Created by: {creatorName}</Text>
              <Text style={styles.metaText}>
                Fields: {moduleData.fields.length}
              </Text>
            </View>

            <Text style={styles.menuSectionTitle}>Export Data</Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                width: "100%",
                marginBottom: 15,
              }}
            >
              <TouchableOpacity
                style={[styles.exportBtn, { marginRight: 10 }]}
                onPress={() => {
                  setShowMenu(false);
                  generatePDF();
                }}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={20}
                      color="white"
                    />
                    <Text style={styles.exportBtnText}>PDF Report</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: "#2E7D32" }]}
                onPress={() => {
                  setShowMenu(false);
                  generateCSV();
                }}
              >
                <MaterialCommunityIcons
                  name="file-excel"
                  size={20}
                  color="white"
                />
                <Text style={styles.exportBtnText}>CSV / Excel</Text>
              </TouchableOpacity>
            </View>

            {canManageMembers && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate("ManageMembers", {
                    moduleData: { ...moduleData, ownerId },
                  });
                }}
              >
                <MaterialCommunityIcons
                  name="account-group"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.menuItemText}>Manage Members</Text>
              </TouchableOpacity>
            )}
            {canEditModule && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate("EditModule", {
                    moduleData: { ...moduleData, ownerId },
                  });
                }}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={22}
                  color={colors.text}
                />
                <Text style={styles.menuItemText}>Edit Structure</Text>
              </TouchableOpacity>
            )}
            {canDeleteModule && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleDeleteModule();
                }}
              >
                <MaterialCommunityIcons
                  name="delete"
                  size={22}
                  color={colors.error}
                />
                <Text style={[styles.menuItemText, { color: colors.error }]}>
                  Delete List
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeMenuBtn}
              onPress={() => setShowMenu(false)}
            >
              <Text style={{ color: "#666" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FILTER MODAL */}
      <Modal visible={!!filterModalField} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setFilterModalField(null)}
          activeOpacity={1}
        >
          <View style={styles.menuBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.menuTitle}>
                Filter by {filterModalField?.name}
              </Text>
              {activeFilters[filterModalField?.name] && (
                <TouchableOpacity
                  onPress={() => applyFilter(filterModalField.name, null)}
                >
                  <Text style={{ color: colors.error }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {filterModalField?.type === "dropdown" ? (
                <View style={styles.chipsContainer}>
                  {filterModalField.options.map((opt, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.optionChip}
                      onPress={() =>
                        applyFilter(filterModalField.name, opt.label || opt)
                      }
                    >
                      <Text>{opt.label || opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput
                  style={styles.modalInput}
                  placeholder="Type..."
                  autoFocus
                  onSubmitEditing={(e) =>
                    applyFilter(filterModalField.name, e.nativeEvent.text)
                  }
                />
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeMenuBtn}
              onPress={() => setFilterModalField(null)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "white",
    paddingTop: Platform.OS === "android" ? 50 : 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 4,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  backBtn: { padding: 5 },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: colors.text },
  filterBar: { marginTop: 15, flexDirection: "row", alignItems: "center" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
    marginRight: 4,
  },
  verticalDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#ddd",
    marginRight: 8,
  },
  body: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 100 },
  recordCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recordTitle: { fontSize: 18, fontWeight: "bold", color: colors.text },
  summaryContainer: { marginTop: 5 },
  summaryRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: "#999", width: 80, fontWeight: "600" },
  summaryValue: { fontSize: 14, color: "#444", flex: 1, fontWeight: "500" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  emptyState: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#888", marginTop: 10 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuBox: {
    width: "85%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
  },
  menuTitle: { fontSize: 18, fontWeight: "bold" },
  metaInfoBox: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  metaText: { fontSize: 13, color: "#555", marginBottom: 5 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 15,
    color: colors.text,
  },
  closeMenuBtn: { marginTop: 15, padding: 10 },
  modalInput: {
    width: "100%",
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  optionChip: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    margin: 4,
  },

  // EXPORT STYLES
  menuSectionTitle: {
    alignSelf: "flex-start",
    fontSize: 12,
    color: "#999",
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 5,
  },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 13,
    marginLeft: 6,
  },

  // NEW STYLES
  docLinkBtn: { flexDirection: "row", alignItems: "center" },
  docLinkText: {
    color: colors.primary,
    fontSize: 12,
    marginLeft: 4,
    textDecorationLine: "underline",
  },
});
