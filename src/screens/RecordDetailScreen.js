import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../colors";
import { auth, db } from "../firebaseConfig";

const { width, height } = Dimensions.get("window");

export default function RecordDetailScreen({ route, navigation }) {
  const { moduleData, recordData, ownerId } = route.params;
  const user = auth.currentUser;

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [historyLogs, setHistoryLogs] = useState([]);
  const [sound, setSound] = useState();

  // --- NEW STATE FOR IMAGE VIEWER ---
  const [selectedImage, setSelectedImage] = useState(null);

  // Permissions
  const isOwner = (ownerId || user.uid) === user.uid;
  const isCreator = recordData.createdBy === user.uid;
  const myPermissions = moduleData.members?.[user.uid]?.permissions || {};
  const canEdit =
    isOwner || isCreator || myPermissions.canEditRecords !== false;
  const canDelete =
    isOwner || isCreator || myPermissions.canDeleteRecords === true;

  // --- AUDIO CLEANUP ---
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // --- FETCH HISTORY ---
  useEffect(() => {
    if (activeTab === "history") {
      const targetOwnerId = ownerId || user.uid;
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
      const q = query(historyRef, orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setHistoryLogs(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      });
      return unsubscribe;
    }
  }, [activeTab]);

  const handlePlayAudio = async () => {
    Alert.alert(
      "Voice Memo",
      "Voice recording is stored locally on the sender's device. P2P syncing will begin once you both enter the Live Discussion.",
    );
  };

  const handleDelete = () => {
    Alert.alert("Delete Record?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            const targetOwnerId = ownerId || user.uid;
            await deleteDoc(
              doc(
                db,
                "users",
                targetOwnerId,
                "modules",
                moduleData.id,
                "records",
                recordData.id,
              ),
            );
            navigation.goBack();
          } catch (e) {
            Alert.alert("Error", e.message);
            setLoading(false);
          }
        },
      },
    ]);
  };

  // --- RENDERERS ---

  const renderValue = (field, value) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return <Text style={styles.emptyText}>-</Text>;
    }

    // 1. IMAGES
    if (field.type === "image") {
      const images = Array.isArray(value) ? value : [value];
      return (
        <View style={styles.imageGrid}>
          {images.map((url, index) => (
            <TouchableOpacity key={index} onPress={() => setSelectedImage(url)}>
              <Image source={{ uri: url }} style={styles.thumbnail} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    // 2. DOCUMENTS
    if (field.type === "document") {
      const docs = Array.isArray(value) ? value : [value];
      return (
        <View style={styles.docList}>
          {docs.map((url, index) => (
            <TouchableOpacity
              key={index}
              style={styles.docRow}
              onPress={() => Linking.openURL(url)}
            >
              <MaterialCommunityIcons
                name="file-document-outline"
                size={24}
                color={colors.primary}
              />
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={styles.docName} numberOfLines={1}>
                  Attachment {index + 1}
                </Text>
                <Text style={styles.docSub}>Click to open</Text>
              </View>
              <Ionicons name="download-outline" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    // 3. DROPDOWNS
    if (field.type === "dropdown") {
      const option = field.options?.find((opt) => (opt.label || opt) === value);
      if (option && typeof option === "object" && option.color) {
        return (
          <View style={[styles.badge, { backgroundColor: option.color }]}>
            <Text
              style={[styles.badgeText, { color: option.textColor || "#333" }]}
            >
              {value}
            </Text>
          </View>
        );
      }
    }

    // 4. TEXT / AUDIO
    const isAudio = String(value).includes("[Audio Memo");
    return (
      <View style={styles.valueRow}>
        <Text style={styles.valueText}>{value}</Text>
        {isAudio && (
          <TouchableOpacity
            onPress={handlePlayAudio}
            style={styles.audioPlayBtn}
          >
            <Ionicons name="play-circle" size={32} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderHistoryItem = (log) => {
    const date = log.timestamp?.seconds
      ? new Date(log.timestamp.seconds * 1000)
      : new Date();
    return (
      <View key={log.id} style={styles.historyCard}>
        <View style={styles.historyLeft}>
          <View style={styles.timelineLine} />
          <View style={styles.timelineDot} />
        </View>
        <View style={styles.historyContent}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyUser}>{log.modifiedBy}</Text>
            <Text style={styles.historyTime}>{date.toLocaleString()}</Text>
          </View>
          {log.changes?.map((change, i) => (
            <View key={i} style={styles.changeRow}>
              <Text style={styles.changeField}>{change.field}:</Text>
              <View style={styles.changeFlow}>
                <Text style={styles.oldValue} numberOfLines={1}>
                  {String(change.old)}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={12}
                  color="#999"
                  style={{ marginHorizontal: 5 }}
                />
                <Text style={styles.newValue} numberOfLines={1}>
                  {String(change.new)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        {canEdit && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() =>
              navigation.navigate("EditRecord", {
                moduleData,
                recordData,
                ownerId,
              })
            }
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "details" && styles.activeTab]}
          onPress={() => setActiveTab("details")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "details" && styles.activeTabText,
            ]}
          >
            Details
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.activeTab]}
          onPress={() => setActiveTab("history")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "history" && styles.activeTabText,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === "details" ? (
          <>
            <View style={styles.card}>
              {moduleData.fields.map((field) => (
                <View key={field.id} style={styles.row}>
                  <View style={styles.labelBox}>
                    <MaterialCommunityIcons
                      name={
                        field.type === "date"
                          ? "calendar"
                          : field.type === "location"
                            ? "map-marker"
                            : field.type === "image"
                              ? "image"
                              : field.type === "document"
                                ? "file-document"
                                : "text"
                      }
                      size={16}
                      color="#999"
                    />
                    <Text style={styles.label}>{field.name}</Text>
                  </View>
                  <View style={styles.valueBox}>
                    {renderValue(field, recordData[field.name])}
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.metaContainer}>
              <Text style={styles.metaText}>ID: {recordData.id}</Text>
              <Text style={styles.metaText}>
                Added by:{" "}
                {isCreator ? "You" : recordData.creatorName || "Member"}
              </Text>
            </View>
            {canDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <Text style={styles.deleteText}>Delete Record</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.historyList}>
            {historyLogs.length === 0 ? (
              <Text style={styles.emptyHistory}>No history yet.</Text>
            ) : (
              historyLogs.map(renderHistoryItem)
            )}
          </View>
        )}
      </ScrollView>

      {/* ACCESS POINT: P2P LIVE DISCUSSION FAB */}
      <TouchableOpacity
        style={styles.chatFab}
        onPress={() =>
          navigation.navigate("RecordChat", { moduleData, recordData, ownerId })
        }
      >
        <Ionicons name="chatbubbles" size={28} color="white" />
        <View style={styles.pulseDot} />
      </TouchableOpacity>

      {/* FULL SCREEN IMAGE MODAL */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="black" />
          <TouchableOpacity
            style={styles.closeModalBtn}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  editBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  editBtnText: { color: "white", fontWeight: "bold" },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingHorizontal: 20,
  },
  tab: {
    marginRight: 25,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { fontWeight: "bold", color: "#999" },
  activeTabText: { color: colors.primary },
  content: { padding: 20, paddingBottom: 100 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
  },
  row: { marginBottom: 25 },
  labelBox: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#bbb",
    marginLeft: 6,
    textTransform: "uppercase",
  },
  valueBox: { marginLeft: 10 },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueText: { fontSize: 16, color: "#333", fontWeight: "500", flex: 1 },
  audioPlayBtn: { marginLeft: 10 },
  emptyText: { color: "#ccc", fontStyle: "italic" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontWeight: "bold", fontSize: 13 },

  // --- MEDIA STYLES ---
  imageGrid: { flexDirection: "row", flexWrap: "wrap" },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: "#eee",
  },
  docList: { marginTop: 5 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  docName: { fontSize: 14, fontWeight: "600", color: "#333" },
  docSub: { fontSize: 10, color: "#888" },

  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: { width: width, height: height * 0.8 },
  closeModalBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },

  metaContainer: { marginTop: 20, alignItems: "center" },
  metaText: { color: "#ccc", fontSize: 11 },
  deleteBtn: { marginTop: 30, padding: 15, alignItems: "center" },
  deleteText: { color: colors.error, fontWeight: "bold" },
  chatFab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: colors.primary,
    width: 65,
    height: 65,
    borderRadius: 33,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  pulseDot: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "white",
  },

  historyCard: { flexDirection: "row", marginBottom: 20 },
  historyLeft: { width: 30, alignItems: "center" },
  timelineLine: {
    width: 2,
    backgroundColor: "#eee",
    flex: 1,
    position: "absolute",
    top: 20,
    bottom: -20,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  historyContent: {
    flex: 1,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  historyUser: { fontWeight: "bold", fontSize: 13 },
  historyTime: { fontSize: 10, color: "#999" },
  changeRow: { marginBottom: 4 },
  changeField: { fontSize: 10, fontWeight: "bold", color: "#999" },
  changeFlow: { flexDirection: "row", alignItems: "center" },
  oldValue: {
    fontSize: 12,
    color: "#ff4444",
    textDecorationLine: "line-through",
    maxWidth: 100,
  },
  newValue: {
    fontSize: 12,
    color: "#00C851",
    fontWeight: "bold",
    maxWidth: 100,
  },
});
