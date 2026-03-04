import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import colors from "../colors";
import { auth, db } from "../firebaseConfig";

export default function CalendarViewScreen({ route, navigation }) {
  const { moduleData, ownerId } = route.params;
  const user = auth.currentUser;

  // 1. Define Date Options
  const getDateOptions = () => {
    const customDateFields = moduleData.fields
      .filter((f) => f.type === "date")
      .map((f) => ({ label: f.name, key: f.name, isCustom: true }));

    return [
      { label: "All Events", key: "all" }, // Show everything
      { label: "My Events", key: "my_events" }, // Show only my records (all dates)
      ...customDateFields, // Specific date fields
      { label: "Created Date", key: "createdAt", isCustom: false },
    ];
  };

  const dateOptions = getDateOptions();

  // State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [activeDateOption, setActiveDateOption] = useState(dateOptions[0]);
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  // 2. Helper: Extract Safe Date String (YYYY-MM-DD)
  const getDateString = (record, fieldKey, isCustom) => {
    if (!record) return null;

    if (!isCustom && fieldKey === "createdAt") {
      if (record.createdAt?.seconds) {
        const d = new Date(record.createdAt.seconds * 1000);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    } else if (isCustom) {
      const val = record[fieldKey];
      if (val && typeof val === "string") {
        return val.split(" ")[0]; // Take only the date part
      }
    }
    return null;
  };

  // 3. Fetch Data
  useEffect(() => {
    const targetOwnerId = ownerId || user.uid;
    const recordsRef = collection(
      db,
      "users",
      targetOwnerId,
      "modules",
      moduleData.id,
      "records",
    );

    const unsubscribe = onSnapshot(recordsRef, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecords(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [moduleData, ownerId]);

  // 4. Update Calendar Dots based on Filter
  useEffect(() => {
    if (records.length > 0) {
      generateMarkedDates(records);
    }
  }, [records, activeDateOption]);

  const generateMarkedDates = (data) => {
    const marks = {};
    const isMyEvents = activeDateOption.key === "my_events";
    const isAllEvents = activeDateOption.key === "all";

    data.forEach((record) => {
      // FILTER: If "My Events" is selected, skip records created by others
      if (isMyEvents && record.createdBy !== user.uid) {
        return;
      }

      const datesToMark = [];

      if (isAllEvents || isMyEvents) {
        // Check ALL fields (Created + Custom)
        const created = getDateString(record, "createdAt", false);
        if (created) datesToMark.push(created);

        moduleData.fields
          .filter((f) => f.type === "date")
          .forEach((f) => {
            const d = getDateString(record, f.name, true);
            if (d) datesToMark.push(d);
          });
      } else {
        // Check ONLY specific field
        const d = getDateString(
          record,
          activeDateOption.key,
          activeDateOption.isCustom,
        );
        if (d) datesToMark.push(d);
      }

      // Mark the dates found
      datesToMark.forEach((dateStr) => {
        marks[dateStr] = { marked: true, dotColor: colors.primary };
      });
    });

    setMarkedDates(marks);
  };

  // 5. Filter List for Selected Date
  const getRecordsForSelectedDate = () => {
    const results = [];
    const isMyEvents = activeDateOption.key === "my_events";
    const isAllEvents = activeDateOption.key === "all";

    records.forEach((record) => {
      // FILTER: If "My Events" is selected, skip records created by others
      if (isMyEvents && record.createdBy !== user.uid) {
        return;
      }

      const matches = [];

      if (isAllEvents || isMyEvents) {
        // Check ALL fields
        if (getDateString(record, "createdAt", false) === selectedDate) {
          matches.push("Created Date");
        }
        moduleData.fields
          .filter((f) => f.type === "date")
          .forEach((f) => {
            if (getDateString(record, f.name, true) === selectedDate) {
              matches.push(f.name);
            }
          });
      } else {
        // Check Specific
        if (
          getDateString(
            record,
            activeDateOption.key,
            activeDateOption.isCustom,
          ) === selectedDate
        ) {
          matches.push(activeDateOption.label);
        }
      }

      if (matches.length > 0) {
        results.push({
          ...record,
          _matchReason: matches.join(" • "),
        });
      }
    });

    return results;
  };

  const filteredRecords = getRecordsForSelectedDate();

  // --- HELPERS ---
  const isImageUrl = (val) => {
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

  // --- RENDERERS ---
  const renderRecordItem = ({ item }) => {
    const fields = moduleData.fields || [];
    if (fields.length === 0) return null;

    const firstField = fields[0];
    let primaryVal = item[firstField.name];

    // FIX: Safely parse the primary title, replacing URLs with "📷 Image Record"
    let displayTitle = "Untitled";
    if (primaryVal) {
      if (Array.isArray(primaryVal) && primaryVal.length > 0) {
        displayTitle = isImageUrl(primaryVal[0])
          ? "📷 Image Record"
          : primaryVal[0];
      } else if (isImageUrl(primaryVal)) {
        displayTitle = "📷 Image Record";
      } else {
        displayTitle = primaryVal;
      }
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("RecordDetail", {
            moduleData,
            recordData: item,
            ownerId,
          })
        }
      >
        <View style={styles.cardLeft}>
          <Text style={styles.dayText}>{selectedDate.split("-")[2]}</Text>
          <Text style={styles.monthText}>
            {new Date(selectedDate)
              .toLocaleString("default", { month: "short" })
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
          <View style={styles.matchTag}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={colors.primary}
            />
            <Text style={styles.matchText}>{item._matchReason}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ddd" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>Calendar View</Text>

          {/* SELECTOR BTN */}
          <TouchableOpacity
            style={styles.selectorBtn}
            onPress={() => setShowFieldPicker(true)}
            activeOpacity={0.6}
          >
            <Text style={styles.selectorText}>{activeDateOption.label}</Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={colors.primary}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        <View style={{ width: 24 }} />
      </View>

      {/* CALENDAR */}
      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          ...markedDates,
          [selectedDate]: {
            selected: true,
            marked: markedDates[selectedDate]?.marked,
            selectedColor: colors.primary,
            dotColor: "white",
          },
        }}
        theme={{
          todayTextColor: colors.primary,
          arrowColor: colors.primary,
          selectedDayBackgroundColor: colors.primary,
          dotColor: colors.primary,
        }}
      />

      {/* LIST SECTION */}
      <View style={styles.listContainer}>
        <Text style={styles.listHeader}>
          {filteredRecords.length} Events on{" "}
          {new Date(selectedDate).toDateString()}
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item) => item.id}
            renderItem={renderRecordItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#ddd" />
                <Text style={styles.emptyText}>
                  No events found for this date.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* FIELD PICKER MODAL */}
      <Modal visible={showFieldPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFieldPicker(false)}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Filter</Text>
            {dateOptions.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.modalOption,
                  activeDateOption.key === opt.key && styles.activeOption,
                ]}
                onPress={() => {
                  setActiveDateOption(opt);
                  setShowFieldPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    activeDateOption.key === opt.key && {
                      color: colors.primary,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  {opt.label}
                </Text>
                {activeDateOption.key === opt.key && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate("AddRecord", { moduleData, ownerId })
        }
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    zIndex: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  backBtn: { padding: 5 },

  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F8FF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  selectorText: { fontSize: 12, color: colors.primary, fontWeight: "600" },

  listContainer: { flex: 1, padding: 20 },
  listHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 15,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    elevation: 1,
  },
  cardLeft: {
    alignItems: "center",
    marginRight: 15,
    paddingRight: 15,
    borderRightWidth: 1,
    borderRightColor: "#eee",
  },
  dayText: { fontSize: 18, fontWeight: "bold", color: "#333" },
  monthText: { fontSize: 10, color: "#999", fontWeight: "bold" },
  cardRight: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },

  matchTag: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  matchText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: "500",
  },

  emptyState: { alignItems: "center", marginTop: 50 },
  emptyText: { color: "#aaa", marginTop: 10 },

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
    elevation: 5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  activeOption: {
    backgroundColor: "#F0F8FF",
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  optionText: { fontSize: 16, color: "#333" },
});
