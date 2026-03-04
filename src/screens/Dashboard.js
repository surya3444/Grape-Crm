import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../colors";
import { auth, db } from "../firebaseConfig";

// --- NOTIFICATIONS & STORAGE ---
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

// Configure Handler
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log("Notification setup skipped");
}

export default function Dashboard({ navigation }) {
  const user = auth.currentUser;

  const [myModules, setMyModules] = useState([]);
  const [sharedModules, setSharedModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  // Notification State
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- EFFECT: DATA LISTENING ---
  useEffect(() => {
    if (!user) return;

    // 1. My Modules
    const q = query(
      collection(db, "users", user.uid, "modules"),
      orderBy("createdAt", "desc"),
    );
    const unsub1 = onSnapshot(q, (snapshot) => {
      const loadedModules = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        isOwner: true,
      }));
      setMyModules(loadedModules);
      setLoading(false);
      runDailyDueDateCheck(loadedModules);
    });

    // 2. Shared Modules
    const q2 = query(collection(db, "users", user.uid, "shared_modules"));
    const unsub2 = onSnapshot(q2, (snapshot) => {
      setSharedModules(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          isOwner: false,
        })),
      );
      setLoading(false);
    });

    // 3. UPDATED: Real-time Notification Listener (Chat + Invites + Reminders)
    const q3 = query(
      collection(db, "users", user.uid, "notifications"),
      where("status", "==", "unread"),
    );
    const unsub3 = onSnapshot(q3, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
      const hasInvites = snapshot.docs.some(
        (doc) => doc.data().type === "invite",
      );
      setHasPendingInvites(hasInvites);

      if (hasInvites) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0.3,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      } else {
        fadeAnim.setValue(1); // Keep visible if no invites (Banner won't show anyway)
      }
    });

    // 4. Auto-Fix Profile
    const checkAndFixProfile = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          await setDoc(userDocRef, {
            name: user.displayName || "User",
            email: user.email.toLowerCase(),
            uid: user.uid,
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.log(error);
      }
    };
    checkAndFixProfile();

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  // --- SAFE NOTIFICATION TRIGGER ---
  const triggerSafeNotification = async (title, body) => {
    if (Platform.OS === "android") {
      Alert.alert(title, body);
    } else {
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title, body },
          trigger: null,
        });
      } catch (error) {
        console.log(error);
      }
    }
  };

  // --- DAILY CHECKER ---
  const runDailyDueDateCheck = async (modules) => {
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const lastCheck = await AsyncStorage.getItem("lastDueDateCheck");
      if (lastCheck === today) return;

      for (const module of modules) {
        const dateFields = module.fields.filter((f) => f.type === "date");
        if (dateFields.length === 0) continue;
        for (const field of dateFields) {
          const recordsRef = collection(
            db,
            "users",
            user.uid,
            "modules",
            module.id,
            "records",
          );
          const q = query(recordsRef, where(field.name, "==", today));
          const snapshot = await getDocs(q);
          snapshot.forEach(async (docSnap) => {
            const record = docSnap.data();
            const recordTitle = record[module.fields[0].name] || "Untitled";
            const message = `Due Today: ${recordTitle} (${field.name})`;
            await triggerSafeNotification("📅 Task Due Today", message);
            await addDoc(collection(db, "users", user.uid, "notifications"), {
              type: "reminder",
              title: "Task Due",
              text: message,
              moduleName: module.name,
              moduleId: module.id,
              recordId: docSnap.id,
              ownerId: user.uid,
              status: "unread",
              createdAt: serverTimestamp(),
            });
          });
        }
      }
      await AsyncStorage.setItem("lastDueDateCheck", today);
    } catch (e) {
      console.log("Error checking due dates:", e);
    }
  };

  const allModules = [...myModules, ...sharedModules];
  const filteredModules = allModules.filter((m) =>
    m.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  const renderModuleCard = ({ item }) => (
    <TouchableOpacity
      style={styles.moduleCard}
      onPress={() => navigation.navigate("ModuleList", { moduleData: item })}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: item.isOwner ? colors.primary + "15" : "#FFF3E0" },
        ]}
      >
        <Text style={[styles.iconText, !item.isOwner && { color: "#F57C00" }]}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardTextContainer}>
        <Text style={styles.moduleName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.recordCount}>
          {item.isOwner ? "Owner" : `Shared by ${item.ownerName || "Admin"}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ddd" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* HEADER WITH GRAPE BRANDING */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <MaterialCommunityIcons name="fruit-grapes" size={32} color="white" />
          <Text style={styles.brandText}>GRAPE</Text>
        </View>

        <View style={styles.headerContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username} numberOfLines={1}>
              {user?.displayName ? user.displayName.split(" ")[0] : "User"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              style={styles.bellBtn}
            >
              <Ionicons name="notifications" size={28} color="white" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {user?.email?.charAt(0).toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#999"
            style={{ marginRight: 10 }}
          />
          <TextInput
            placeholder="Search workspace..."
            placeholderTextColor="#999"
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* BODY */}
      <View style={styles.body}>
        {/* BLINKING INVITATION BANNER */}
        {hasPendingInvites && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
              style={styles.inviteBanner}
              onPress={() => navigation.navigate("Notifications")}
            >
              <MaterialCommunityIcons
                name="email-alert"
                size={20}
                color="#F57C00"
              />
              <Text style={styles.inviteText}>
                You have pending project invitations!
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#F57C00" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 50 }}
          />
        ) : (
          <FlatList
            data={filteredModules}
            keyExtractor={(item) => item.id}
            renderItem={renderModuleCard}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>My Workspace</Text>
                <Text style={styles.sectionSubtitle}>
                  {allModules.length} Apps Active
                </Text>
              </View>
            }
            ListFooterComponent={
              <View style={styles.footerSection}>
                <Text style={styles.footerHeading}>GRAPE TIPS & USES</Text>
                <View style={styles.tipCard}>
                  <MaterialCommunityIcons
                    name="gesture-tap"
                    size={24}
                    color={colors.primary}
                  />
                  <Text style={styles.tipText}>
                    Tap on any record to start a real-time, peer-to-peer
                    encrypted chat with your team.
                  </Text>
                </View>
                <View style={styles.tipCard}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={24}
                    color="#4CAF50"
                  />
                  <Text style={styles.tipText}>
                    Invite team members to specific modules to collaborate
                    securely without sharing your whole database.
                  </Text>
                </View>
                <View style={styles.bottomCartoon}>
                  <MaterialCommunityIcons
                    name="fruit-grapes-outline"
                    size={80}
                    color="#f0f0f0"
                  />
                  <Text style={styles.tagline}>Built for Productivity</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="view-dashboard-outline"
                  size={60}
                  color="#ddd"
                />
                <Text style={styles.emptyTitle}>Your workspace is empty</Text>
                <Text style={styles.emptyText}>Tap + to create a new app.</Text>
              </View>
            }
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateModule")}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 20 : 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 1,
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  brandText: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 3,
    marginLeft: 8,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  username: { color: "white", fontSize: 28, fontWeight: "bold" },
  bellBtn: { marginRight: 15, padding: 5, position: "relative" },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: colors.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "bold" },
  profilePlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  profileInitial: { color: "white", fontSize: 20, fontWeight: "bold" },
  searchContainer: {
    position: "absolute",
    bottom: -25,
    left: 20,
    right: 20,
    backgroundColor: "white",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    height: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text },
  body: { flex: 1, paddingTop: 40 },
  inviteBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF3E0",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 5,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  inviteText: {
    color: "#E65100",
    fontWeight: "bold",
    fontSize: 13,
    flex: 1,
    marginLeft: 10,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: "bold", color: colors.text },
  sectionSubtitle: { fontSize: 14, color: "#888", fontWeight: "500" },
  moduleCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  iconText: { fontSize: 24, fontWeight: "bold", color: colors.primary },
  cardTextContainer: { flex: 1 },
  moduleName: {
    fontSize: 17,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  recordCount: { fontSize: 12, color: "#999" },

  // FOOTER TIPS & SKETCH
  footerSection: { marginTop: 40, paddingBottom: 40 },
  footerHeading: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ccc",
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 20,
  },
  tipCard: {
    flexDirection: "row",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    alignItems: "center",
  },
  tipText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: "#888",
    lineHeight: 18,
  },
  bottomCartoon: { alignItems: "center", marginTop: 30, opacity: 0.4 },
  tagline: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ccc",
    marginTop: 5,
    textTransform: "uppercase",
  },

  emptyState: { alignItems: "center", marginTop: 50, paddingHorizontal: 40 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#555",
    marginTop: 10,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 5,
    lineHeight: 22,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: colors.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
