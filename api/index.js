var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/firestoreAdmin.ts
function hasFirebaseAdminCredentials() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}
async function ensureAdminApp() {
  if (adminApp) return adminApp;
  if (initFailed) return null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const [{ cert, getApps, initializeApp: initializeApp2 }] = await Promise.all([import("firebase-admin/app")]);
    const serviceAccount = JSON.parse(raw);
    adminApp = getApps()[0] ?? initializeApp2({ credential: cert(serviceAccount) });
    return adminApp;
  } catch (error2) {
    initFailed = true;
    console.error("[Firebase Admin] Failed to initialize app.", error2);
    return null;
  }
}
async function getAdminFirestore() {
  if (adminDb) return adminDb;
  const app3 = await ensureAdminApp();
  if (!app3) return null;
  try {
    const { getFirestore: getFirestore2 } = await import("firebase-admin/firestore");
    adminDb = getFirestore2(app3, databaseId);
    return adminDb;
  } catch (error2) {
    initFailed = true;
    console.error("[Firebase Admin] Failed to initialize Firestore.", error2);
    return null;
  }
}
var adminDb, adminApp, initFailed, databaseId;
var init_firestoreAdmin = __esm({
  "server/firestoreAdmin.ts"() {
    adminDb = null;
    adminApp = null;
    initFailed = false;
    databaseId = process.env.FIRESTORE_DATABASE_ID || "ai-studio-c2303f92-945b-405b-9b0b-230b63fef478";
  }
});

// server/lib/firestore/documentHelpers.ts
function snapToData(snapshot) {
  if (!snapshot.exists) return null;
  return snapshot.data() ?? null;
}
function mapDocsToData(docs) {
  return docs.map((doc3) => doc3.data());
}
var init_documentHelpers = __esm({
  "server/lib/firestore/documentHelpers.ts"() {
  }
});

// server/lib/firestore/pagination.ts
function decodeCursor(cursor) {
  return Buffer.from(cursor, "base64url").toString("utf8");
}
var init_pagination = __esm({
  "server/lib/firestore/pagination.ts"() {
  }
});

// server/lib/firestore/queryHelpers.ts
async function requireAdminFirestore() {
  const db3 = await getAdminFirestore();
  if (!db3) {
    throw new Error("Firestore Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON on the server.");
  }
  return db3;
}
async function listCollection(collectionName, options) {
  const db3 = await requireAdminFirestore();
  let query2 = db3.collection(collectionName);
  if (options?.limit) {
    query2 = query2.limit(options.limit);
  }
  const snapshot = await query2.get();
  return mapDocsToData(snapshot.docs);
}
async function getDocumentById(collectionName, id, fields) {
  const db3 = await requireAdminFirestore();
  const ref = db3.collection(collectionName).doc(id);
  if (fields?.length) {
    const snapshot2 = await ref.select(...fields).get();
    return snapToData(snapshot2);
  }
  const snapshot = await ref.get();
  return snapToData(snapshot);
}
async function upsertDocument(collectionName, data) {
  const db3 = await requireAdminFirestore();
  await db3.collection(collectionName).doc(data.id).set(data, { merge: true });
  return data;
}
async function upsertDocumentById(collectionName, id, data) {
  const db3 = await requireAdminFirestore();
  await db3.collection(collectionName).doc(id).set(data, { merge: true });
  return data;
}
async function deleteDocument(collectionName, id) {
  const db3 = await requireAdminFirestore();
  await db3.collection(collectionName).doc(id).delete();
}
async function collectionHasDocuments(collectionName, limit = 1) {
  const db3 = await requireAdminFirestore();
  const snapshot = await db3.collection(collectionName).limit(limit).get();
  return !snapshot.empty;
}
async function existsWhere(collectionName, field, operator, value) {
  const db3 = await requireAdminFirestore();
  const snapshot = await db3.collection(collectionName).where(field, operator, value).limit(1).get();
  return !snapshot.empty;
}
async function listOrdered(collectionName, orderByField, options) {
  const db3 = await requireAdminFirestore();
  let query2 = db3.collection(collectionName).orderBy(
    orderByField,
    options?.direction ?? "desc"
  );
  if (options?.cursor) {
    query2 = query2.startAfter(decodeCursor(options.cursor));
  }
  if (options?.limit) {
    query2 = query2.limit(options.limit);
  }
  const snapshot = await query2.get();
  return mapDocsToData(snapshot.docs);
}
async function listWhereOrdered(collectionName, filters, orderByField, options) {
  const db3 = await requireAdminFirestore();
  let query2 = db3.collection(collectionName);
  filters.forEach((filter) => {
    query2 = query2.where(filter.field, filter.operator, filter.value);
  });
  query2 = query2.orderBy(orderByField, options?.direction ?? "asc");
  if (options?.cursor) {
    query2 = query2.startAfter(decodeCursor(options.cursor));
  }
  if (options?.limit) {
    query2 = query2.limit(options.limit);
  }
  const snapshot = await query2.get();
  return mapDocsToData(snapshot.docs);
}
async function getLatestWhere(collectionName, filters, orderByField) {
  const rows = await listWhereOrdered(collectionName, filters, orderByField, {
    limit: 1,
    direction: "desc"
  });
  return rows[0] ?? null;
}
var init_queryHelpers = __esm({
  "server/lib/firestore/queryHelpers.ts"() {
    init_firestoreAdmin();
    init_documentHelpers();
    init_pagination();
  }
});

// server/messaging/omniStore.ts
var omniStore_exports = {};
__export(omniStore_exports, {
  __resetMemoryStoreForTests: () => __resetMemoryStoreForTests,
  getConversation: () => getConversation,
  getLatestInboundMessage: () => getLatestInboundMessage,
  getStoreBackend: () => getStoreBackend,
  hasConversationData: () => hasConversationData,
  listAgents: () => listAgents,
  listConversations: () => listConversations,
  listMessages: () => listMessages,
  messageExistsByPlatformId: () => messageExistsByPlatformId,
  patchConversation: () => patchConversation,
  saveAgent: () => saveAgent,
  saveConversation: () => saveConversation,
  saveCustomer: () => saveCustomer,
  saveMessage: () => saveMessage
});
async function resolveBackend() {
  if (backend) return backend;
  const adminDb2 = await getAdminFirestore();
  backend = adminDb2 ? "admin" : "memory";
  console.log(`[OmniStore] Using ${backend} backend`);
  return backend;
}
async function getStoreBackend() {
  return resolveBackend();
}
async function hasConversationData() {
  const mode = await resolveBackend();
  if (mode === "memory") {
    return memory.conversations.size > 0;
  }
  return collectionHasDocuments("omni_conversations", 1);
}
async function saveCustomer(customer) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    memory.customers.set(customer.id, customer);
    return;
  }
  const db3 = await getAdminFirestore();
  await db3.collection("omni_customers").doc(customer.id).set(customer);
}
async function saveAgent(agent) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    memory.agents.set(agent.id, agent);
    return;
  }
  const db3 = await getAdminFirestore();
  await db3.collection("omni_agents").doc(agent.id).set(agent);
}
async function saveConversation(conversation) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    memory.conversations.set(conversation.conversationId, conversation);
    return;
  }
  const db3 = await getAdminFirestore();
  await db3.collection("omni_conversations").doc(conversation.conversationId).set(conversation, { merge: true });
}
async function getConversation(conversationId) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    return memory.conversations.get(conversationId) ?? null;
  }
  return getDocumentById("omni_conversations", conversationId);
}
async function listConversations(options) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    const rows = Array.from(memory.conversations.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!options?.limit) return rows;
    return rows.slice(0, options.limit);
  }
  return listOrdered("omni_conversations", "updatedAt", {
    direction: "desc",
    ...options
  });
}
async function saveMessage(message) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    memory.messages.set(message.id, message);
    return;
  }
  const db3 = await getAdminFirestore();
  await db3.collection("omni_messages").doc(message.id).set(message);
}
async function messageExistsByPlatformId(platformMessageId) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    return Array.from(memory.messages.values()).some((m) => m.platformMessageId === platformMessageId);
  }
  return existsWhere("omni_messages", "platformMessageId", "==", platformMessageId);
}
async function listMessages(conversationId, options) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    const rows = Array.from(memory.messages.values()).filter((m) => m.conversationId === conversationId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (!options?.limit) return rows;
    return rows.slice(0, options.limit);
  }
  return listWhereOrdered(
    "omni_messages",
    [{ field: "conversationId", operator: "==", value: conversationId }],
    "timestamp",
    { direction: "asc", ...options }
  );
}
async function getLatestInboundMessage(conversationId) {
  const mode = await resolveBackend();
  if (mode === "memory") {
    const inbound = Array.from(memory.messages.values()).filter((m) => m.conversationId === conversationId && m.direction === "inbound").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return inbound[0] ?? null;
  }
  return getLatestWhere(
    "omni_messages",
    [
      { field: "conversationId", operator: "==", value: conversationId },
      { field: "direction", operator: "==", value: "inbound" }
    ],
    "timestamp"
  );
}
async function listAgents() {
  const mode = await resolveBackend();
  if (mode === "memory") {
    return Array.from(memory.agents.values());
  }
  const db3 = await getAdminFirestore();
  const snap = await db3.collection("omni_agents").get();
  return snap.docs.map((doc3) => snapToData(doc3));
}
async function patchConversation(conversationId, patch) {
  const existing = await getConversation(conversationId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await saveConversation(updated);
  return updated;
}
function __resetMemoryStoreForTests() {
  memory.conversations.clear();
  memory.messages.clear();
  memory.agents.clear();
  memory.customers.clear();
  backend = null;
}
var memory, backend;
var init_omniStore = __esm({
  "server/messaging/omniStore.ts"() {
    init_firestoreAdmin();
    init_queryHelpers();
    init_documentHelpers();
    memory = {
      conversations: /* @__PURE__ */ new Map(),
      messages: /* @__PURE__ */ new Map(),
      agents: /* @__PURE__ */ new Map(),
      customers: /* @__PURE__ */ new Map()
    };
    backend = null;
  }
});

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  refreshTokens: () => refreshTokens,
  roleEnum: () => roleEnum,
  sellerProfiles: () => sellerProfiles,
  users: () => users
});
import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
var roleEnum, users, sellerProfiles, refreshTokens;
var init_schema = __esm({
  "server/db/schema.ts"() {
    roleEnum = pgEnum("user_role", [
      "user",
      "seller",
      "verified_seller",
      "moderator",
      "admin",
      "super_admin",
      "creator",
      "finance_manager",
      "support_agent",
      "marketing_manager"
    ]);
    users = pgTable("users", {
      id: uuid("id").primaryKey().defaultRandom(),
      email: varchar("email", { length: 320 }).notNull().unique(),
      passwordHash: varchar("password_hash", { length: 255 }),
      displayName: varchar("display_name", { length: 120 }).notNull(),
      role: roleEnum("role").notNull().default("user"),
      emailVerified: boolean("email_verified").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    sellerProfiles = pgTable("seller_profiles", {
      userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
      storeName: varchar("store_name", { length: 160 }).notNull(),
      phone: varchar("phone", { length: 24 }).notNull(),
      category: varchar("category", { length: 120 }).notNull(),
      city: varchar("city", { length: 80 }).notNull(),
      website: varchar("website", { length: 320 }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    refreshTokens = pgTable("refresh_tokens", {
      id: uuid("id").primaryKey().defaultRandom(),
      userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      tokenHash: varchar("token_hash", { length: 255 }).notNull(),
      expiresAt: timestamp("expires_at").notNull(),
      revokedAt: timestamp("revoked_at"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
  }
});

// server/db/client.ts
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
var pool, db;
var init_client = __esm({
  "server/db/client.ts"() {
    init_schema();
    dotenv.config();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Add it to .env and to Vercel env vars.");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/operations/operationsDb.ts
import { eq } from "drizzle-orm";
async function firestoreOrThrow() {
  const firestore = await getAdminFirestore();
  if (!firestore) {
    throw new Error("Firestore Admin is not configured.");
  }
  return firestore;
}
async function saveOperationsSnapshot(snapshot) {
  if (!useOperationsFirestore) return;
  const firestore = await firestoreOrThrow();
  await firestore.collection("ops_state").doc(DOC_ID).set(snapshot, { merge: true });
}
async function loadAdminUser(uid) {
  const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    role: row.role,
    displayName: row.displayName || row.email || "Admin User",
    email: row.email || ""
  };
}
async function loadAdminUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    uid: row.id,
    role: row.role,
    displayName: row.displayName || row.email || "Admin User",
    email: row.email || normalized
  };
}
var DOC_ID, useOperationsFirestore;
var init_operationsDb = __esm({
  "server/operations/operationsDb.ts"() {
    init_client();
    init_schema();
    init_firestoreAdmin();
    init_queryHelpers();
    DOC_ID = "snapshot";
    useOperationsFirestore = process.env.OPERATIONS_USE_FIRESTORE === "true" && hasFirebaseAdminCredentials();
  }
});

// firebase-applet-config.json
var firebase_applet_config_default;
var init_firebase_applet_config = __esm({
  "firebase-applet-config.json"() {
    firebase_applet_config_default = {
      projectId: "intense-influence-9sjh2",
      appId: "1:256392027116:web:ccae5405312330d31e7ec9",
      apiKey: "AIzaSyClEKvbBC9CZv7Zm8oAfgS_GdkaC_uL33g",
      authDomain: "intense-influence-9sjh2.firebaseapp.com",
      firestoreDatabaseId: "ai-studio-c2303f92-945b-405b-9b0b-230b63fef478",
      storageBucket: "intense-influence-9sjh2.firebasestorage.app",
      messagingSenderId: "256392027116",
      measurementId: ""
    };
  }
});

// src/lib/firebase.ts
var firebase_exports = {};
__export(firebase_exports, {
  OperationType: () => OperationType,
  auth: () => auth,
  db: () => db2,
  handleFirestoreError: () => handleFirestoreError
});
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
async function testConnection() {
  try {
    await getDocFromServer(doc(db2, "test", "connection"));
  } catch (error2) {
    if (error2 instanceof Error && error2.message.includes("offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
function handleFirestoreError(error2, operationType, path) {
  const errInfo = {
    error: error2 instanceof Error ? error2.message : String(error2),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
var app, db2, auth, OperationType;
var init_firebase = __esm({
  "src/lib/firebase.ts"() {
    init_firebase_applet_config();
    app = initializeApp(firebase_applet_config_default);
    db2 = getFirestore(app, firebase_applet_config_default.firestoreDatabaseId);
    auth = getAuth(app);
    testConnection();
    OperationType = /* @__PURE__ */ ((OperationType3) => {
      OperationType3["CREATE"] = "create";
      OperationType3["UPDATE"] = "update";
      OperationType3["DELETE"] = "delete";
      OperationType3["LIST"] = "list";
      OperationType3["GET"] = "get";
      OperationType3["WRITE"] = "write";
      return OperationType3;
    })(OperationType || {});
  }
});

// server/operations/shipmentStore.ts
var nowIso2, state, shipmentStore;
var init_shipmentStore = __esm({
  "server/operations/shipmentStore.ts"() {
    nowIso2 = () => (/* @__PURE__ */ new Date()).toISOString();
    state = [];
    shipmentStore = {
      listShipments: () => [...state].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      getShipment: (id) => state.find((row) => row.id === id || row.orderId === id || row.trackingNumber === id) ?? null,
      getShipmentByOrderId: (orderId) => state.find((row) => row.orderId === orderId) ?? null,
      createFromOrder: (order) => {
        const existing = state.find((row) => row.orderId === order.orderId);
        if (existing) return existing;
        const ts = nowIso2();
        const trackingNumber = `TRK-${order.orderId.replace(/\W/g, "").slice(-10).toUpperCase()}`;
        const shipment = {
          id: `ship_${order.orderId}`,
          orderId: order.orderId,
          buyerId: order.buyerId,
          status: "pending_pickup",
          courier: "pathao",
          trackingNumber,
          recipientName: order.shipping?.fullName || order.buyerId,
          recipientPhone: order.shipping?.phone || "",
          deliveryAddress: order.shipping?.address || "",
          region: order.shipping?.region || "Dhaka",
          codAmount: order.isCOD ? Number(order.overallTotal || 0) : 0,
          deliveryCharge: Number(order.deliveryTotal || 120),
          createdAt: ts,
          updatedAt: ts,
          trackingEvents: [
            {
              id: `evt_${Date.now()}`,
              timestamp: ts,
              status: "pending_pickup",
              location: order.shipping?.region || "Dhaka",
              description: `Shipment created for order ${order.orderId}`
            }
          ]
        };
        state.unshift(shipment);
        return shipment;
      },
      hydrate: (rows) => {
        state.length = 0;
        state.push(...rows);
      },
      updateShipment: (id, patch) => {
        const idx = state.findIndex((row) => row.id === id || row.orderId === id);
        if (idx < 0) return null;
        state[idx] = { ...state[idx], ...patch, updatedAt: nowIso2() };
        return state[idx];
      },
      updateFromWebhook: (trackingNumber, status, event) => {
        const idx = state.findIndex((row) => row.trackingNumber === trackingNumber);
        if (idx < 0) return null;
        const trackingEvents = [
          { ...event, id: `evt_${Date.now()}` },
          ...state[idx].trackingEvents
        ];
        state[idx] = {
          ...state[idx],
          status,
          trackingEvents,
          updatedAt: nowIso2()
        };
        return state[idx];
      }
    };
  }
});

// lib/vercel-catalog/storefrontCategories.ts
var STOREFRONT_CATEGORY_DEFS, CANONICAL_CATEGORY_IDS, buildDefaultCatalogCategories;
var init_storefrontCategories = __esm({
  "lib/vercel-catalog/storefrontCategories.ts"() {
    STOREFRONT_CATEGORY_DEFS = [
      {
        id: "cat-fashion",
        slug: "fashion-lifestyle",
        name: "Fashion & Lifestyle",
        icon: "Shirt",
        description: "Apparel, footwear, and lifestyle accessories.",
        displayOrder: 0
      },
      {
        id: "cat-jewelry",
        slug: "jewelry-accessories",
        name: "Jewelry & Accessories",
        icon: "Gem",
        description: "Jewelry, watches, and personal accessories.",
        displayOrder: 1
      },
      {
        id: "cat-mobile",
        slug: "mobile-phones",
        name: "Mobile & Phones",
        icon: "Smartphone",
        description: "Smartphones, tablets, and mobile accessories.",
        displayOrder: 2
      },
      {
        id: "cat-sporting",
        slug: "sporting-playstation",
        name: "Sporting & Playstation",
        icon: "Gamepad2",
        description: "Sports gear, fitness, and PlayStation consoles.",
        displayOrder: 3
      },
      {
        id: "cat-gaming",
        slug: "gaming-entertainment",
        name: "Gaming & Entertainment",
        icon: "Monitor",
        description: "Gaming consoles, PCs, and entertainment tech.",
        displayOrder: 4
      },
      {
        id: "cat-food",
        slug: "food-restaurants",
        name: "Food & Restaurants",
        icon: "Utensils",
        description: "Restaurants, dining, and food delivery.",
        displayOrder: 5
      },
      {
        id: "cat-tech",
        slug: "tech-electronics",
        name: "Tech & Electronics",
        icon: "Cpu",
        description: "Laptops, audio, cameras, and gadgets.",
        displayOrder: 6
      },
      {
        id: "cat-appliances",
        slug: "tv-appliances",
        name: "TV & Appliances",
        icon: "Tv",
        description: "Televisions, home appliances, and kitchen tech.",
        displayOrder: 7
      },
      {
        id: "cat-home",
        slug: "home-living",
        name: "Home & Living",
        icon: "Home",
        description: "Furniture, decor, and home essentials.",
        displayOrder: 8
      },
      {
        id: "cat-baby",
        slug: "baby-maternity",
        name: "Baby & Maternity",
        icon: "Baby",
        description: "Baby care, maternity, and nursery products.",
        displayOrder: 9
      }
    ];
    CANONICAL_CATEGORY_IDS = new Set(
      STOREFRONT_CATEGORY_DEFS.map((category) => category.id)
    );
    buildDefaultCatalogCategories = () => {
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      return STOREFRONT_CATEGORY_DEFS.map((category) => ({
        ...category,
        parentId: null,
        enabled: true,
        createdAt: ts,
        updatedAt: ts
      }));
    };
  }
});

// lib/vercel-catalog/catalogFirestoreAdmin.ts
var catalogFirestoreAdmin_exports = {};
__export(catalogFirestoreAdmin_exports, {
  firestoreAdminStore: () => firestoreAdminStore
});
var PRODUCTS_COLLECTION2, CATEGORIES_COLLECTION2, BRANDS_COLLECTION2, DEALS_COLLECTION2, CREATORS_COLLECTION2, GUIDES_COLLECTION2, PLACEMENTS_COLLECTION2, PRODUCT_DETAILS_COLLECTION2, BRAND_POSTS_COLLECTION2, HOMEPAGE_DOC, SITE_DOC, firestoreAdminStore;
var init_catalogFirestoreAdmin = __esm({
  "lib/vercel-catalog/catalogFirestoreAdmin.ts"() {
    init_queryHelpers();
    PRODUCTS_COLLECTION2 = "catalog_products";
    CATEGORIES_COLLECTION2 = "catalog_categories";
    BRANDS_COLLECTION2 = "catalog_brands";
    DEALS_COLLECTION2 = "catalog_deals";
    CREATORS_COLLECTION2 = "catalog_creators";
    GUIDES_COLLECTION2 = "catalog_guides";
    PLACEMENTS_COLLECTION2 = "catalog_placements";
    PRODUCT_DETAILS_COLLECTION2 = "catalog_product_details";
    BRAND_POSTS_COLLECTION2 = "catalog_brand_posts";
    HOMEPAGE_DOC = { collection: "settings", id: "catalog_homepage" };
    SITE_DOC = { collection: "settings", id: "catalog_site" };
    firestoreAdminStore = {
      listProducts: () => listCollection(PRODUCTS_COLLECTION2),
      getProduct: (id) => getDocumentById(PRODUCTS_COLLECTION2, id),
      upsertProduct: (payload) => upsertDocument(PRODUCTS_COLLECTION2, payload),
      deleteProduct: (id) => deleteDocument(PRODUCTS_COLLECTION2, id),
      listCategories: () => listCollection(CATEGORIES_COLLECTION2),
      getCategory: (id) => getDocumentById(CATEGORIES_COLLECTION2, id),
      upsertCategory: (payload) => upsertDocument(CATEGORIES_COLLECTION2, payload),
      deleteCategory: (id) => deleteDocument(CATEGORIES_COLLECTION2, id),
      listBrands: () => listCollection(BRANDS_COLLECTION2),
      getBrand: (id) => getDocumentById(BRANDS_COLLECTION2, id),
      upsertBrand: (payload) => upsertDocument(BRANDS_COLLECTION2, payload),
      deleteBrand: (id) => deleteDocument(BRANDS_COLLECTION2, id),
      listDeals: () => listCollection(DEALS_COLLECTION2),
      getDeal: (id) => getDocumentById(DEALS_COLLECTION2, id),
      upsertDeal: (payload) => upsertDocument(DEALS_COLLECTION2, payload),
      deleteDeal: (id) => deleteDocument(DEALS_COLLECTION2, id),
      listCreators: () => listCollection(CREATORS_COLLECTION2),
      getCreator: (id) => getDocumentById(CREATORS_COLLECTION2, id),
      upsertCreator: (payload) => upsertDocument(CREATORS_COLLECTION2, payload),
      deleteCreator: (id) => deleteDocument(CREATORS_COLLECTION2, id),
      listGuides: () => listCollection(GUIDES_COLLECTION2),
      getGuide: (id) => getDocumentById(GUIDES_COLLECTION2, id),
      upsertGuide: (payload) => upsertDocument(GUIDES_COLLECTION2, payload),
      deleteGuide: (id) => deleteDocument(GUIDES_COLLECTION2, id),
      listPlacements: () => listCollection(PLACEMENTS_COLLECTION2),
      getPlacement: (id) => getDocumentById(PLACEMENTS_COLLECTION2, id),
      upsertPlacement: (payload) => upsertDocument(PLACEMENTS_COLLECTION2, payload),
      deletePlacement: (id) => deleteDocument(PLACEMENTS_COLLECTION2, id),
      listProductDetails: () => listCollection(PRODUCT_DETAILS_COLLECTION2),
      getProductDetail: (productId) => getDocumentById(PRODUCT_DETAILS_COLLECTION2, productId),
      upsertProductDetail: (payload) => upsertDocumentById(PRODUCT_DETAILS_COLLECTION2, payload.productId, payload),
      deleteProductDetail: (productId) => deleteDocument(PRODUCT_DETAILS_COLLECTION2, productId),
      listBrandPosts: () => listCollection(BRAND_POSTS_COLLECTION2),
      getBrandPost: (id) => getDocumentById(BRAND_POSTS_COLLECTION2, id),
      upsertBrandPost: (payload) => upsertDocument(BRAND_POSTS_COLLECTION2, payload),
      deleteBrandPost: (id) => deleteDocument(BRAND_POSTS_COLLECTION2, id),
      getHomepage: () => getDocumentById(HOMEPAGE_DOC.collection, HOMEPAGE_DOC.id),
      upsertHomepage: (homepage) => upsertDocumentById(HOMEPAGE_DOC.collection, HOMEPAGE_DOC.id, homepage),
      getSiteConfig: () => getDocumentById(SITE_DOC.collection, SITE_DOC.id),
      upsertSiteConfig: (site) => upsertDocumentById(SITE_DOC.collection, SITE_DOC.id, site),
      hasAnyProducts: () => collectionHasDocuments(PRODUCTS_COLLECTION2, 1)
    };
  }
});

// lib/vercel-catalog/mediaUpload.ts
var mediaUpload_exports = {};
__export(mediaUpload_exports, {
  uploadDocumentToCloudinary: () => uploadDocumentToCloudinary,
  uploadImageToCloudinary: () => uploadImageToCloudinary,
  uploadVerificationAssetToCloudinary: () => uploadVerificationAssetToCloudinary
});
import crypto2 from "node:crypto";
async function uploadImageToCloudinary(input) {
  const cloudName = getCloudName();
  if (!cloudName) {
    throw new Error(
      "Image upload is not configured. Set CLOUDINARY_CLOUD_NAME (or VITE_CLOUDINARY_CLOUD_NAME) on the server."
    );
  }
  const uploadPreset = getUploadPreset();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const dataUri = `data:${input.mimeType || "image/jpeg"};base64,${input.base64Data}`;
  const form = new FormData();
  form.append("file", dataUri);
  form.append("folder", "choosify/products");
  if (uploadPreset) {
    form.append("upload_preset", uploadPreset);
  } else if (apiKey && apiSecret) {
    const timestamp2 = Math.round(Date.now() / 1e3);
    const folder = "choosify/products";
    const paramsToSign = `folder=${folder}&timestamp=${timestamp2}`;
    const signature = crypto2.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp2));
    form.append("signature", signature);
  } else {
    throw new Error(
      "Image upload is not configured. Set CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET on the server."
    );
  }
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Cloudinary upload failed with ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.secure_url) {
    throw new Error("Cloudinary upload succeeded but no secure_url was returned.");
  }
  return payload.secure_url;
}
async function uploadDocumentToCloudinary(input) {
  const cloudName = getCloudName();
  if (!cloudName) {
    throw new Error(
      "Document upload is not configured. Set CLOUDINARY_CLOUD_NAME (or VITE_CLOUDINARY_CLOUD_NAME) on the server."
    );
  }
  const uploadPreset = getUploadPreset();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const mimeType = input.mimeType || "application/pdf";
  const dataUri = `data:${mimeType};base64,${input.base64Data}`;
  const folder = "choosify/resumes";
  const form = new FormData();
  form.append("file", dataUri);
  form.append("folder", folder);
  if (uploadPreset) {
    form.append("upload_preset", uploadPreset);
  } else if (apiKey && apiSecret) {
    const timestamp2 = Math.round(Date.now() / 1e3);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp2}`;
    const signature = crypto2.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp2));
    form.append("signature", signature);
  } else {
    throw new Error(
      "Document upload is not configured. Set CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET on the server."
    );
  }
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Cloudinary document upload failed with ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.secure_url) {
    throw new Error("Cloudinary upload succeeded but no secure_url was returned.");
  }
  return payload.secure_url;
}
async function uploadVerificationAssetToCloudinary(input) {
  const mime = (input.mimeType || "").toLowerCase();
  const kind = input.kind || (mime.startsWith("image/") ? "image" : "document");
  const cloudName = getCloudName();
  if (!cloudName) {
    throw new Error(
      "Upload is not configured. Set CLOUDINARY_CLOUD_NAME (or VITE_CLOUDINARY_CLOUD_NAME) on the server."
    );
  }
  const uploadPreset = getUploadPreset();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const mimeType = input.mimeType || (kind === "image" ? "image/jpeg" : "application/pdf");
  const dataUri = `data:${mimeType};base64,${input.base64Data}`;
  const folder = "choosify/verifications";
  const form = new FormData();
  form.append("file", dataUri);
  form.append("folder", folder);
  if (uploadPreset) {
    form.append("upload_preset", uploadPreset);
  } else if (apiKey && apiSecret) {
    const timestamp2 = Math.round(Date.now() / 1e3);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp2}`;
    const signature = crypto2.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp2));
    form.append("signature", signature);
  } else {
    throw new Error(
      "Upload is not configured. Set CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET on the server."
    );
  }
  const endpoint = kind === "image" ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` : `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;
  const response = await fetch(endpoint, {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Cloudinary verification upload failed with ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.secure_url) {
    throw new Error("Cloudinary upload succeeded but no secure_url was returned.");
  }
  return payload.secure_url;
}
var getCloudName, getUploadPreset;
var init_mediaUpload = __esm({
  "lib/vercel-catalog/mediaUpload.ts"() {
    getCloudName = () => process.env.CLOUDINARY_CLOUD_NAME?.trim() || process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || "";
    getUploadPreset = () => process.env.CLOUDINARY_UPLOAD_PRESET?.trim() || process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || "";
  }
});

// server/lib/uploadValidation.ts
var uploadValidation_exports = {};
__export(uploadValidation_exports, {
  validateDocumentUploadInput: () => validateDocumentUploadInput,
  validateImageUploadInput: () => validateImageUploadInput,
  validateVerificationUploadInput: () => validateVerificationUploadInput
});
function readMaxUploadBytes() {
  const raw = process.env.UPLOAD_MAX_BYTES;
  if (!raw?.trim()) return DEFAULT_MAX_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_BYTES;
  return Math.floor(parsed);
}
function estimateBase64Bytes(base64Data) {
  const normalized = base64Data.includes(",") ? base64Data.split(",").pop() || "" : base64Data;
  return Math.floor(normalized.length * 3 / 4);
}
function extensionFromFileName(fileName) {
  const index = fileName.lastIndexOf(".");
  if (index === -1) return "";
  return fileName.slice(index).toLowerCase();
}
function validateImageUploadInput(input) {
  const base64Data = input.base64Data?.trim();
  if (!base64Data) {
    return { ok: false, error: "Missing image data" };
  }
  const mimeType = (input.mimeType || "image/jpeg").trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Unsupported image MIME type" };
  }
  const fileName = (input.fileName || "product-image").trim();
  const extension = extensionFromFileName(fileName);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Unsupported image file extension" };
  }
  const estimatedBytes = estimateBase64Bytes(base64Data);
  const maxBytes = readMaxUploadBytes();
  if (estimatedBytes > maxBytes) {
    return { ok: false, error: `Image exceeds maximum upload size of ${maxBytes} bytes` };
  }
  return { ok: true, mimeType, fileName, estimatedBytes };
}
function validateDocumentUploadInput(input) {
  const base64Data = input.base64Data?.trim();
  if (!base64Data) {
    return { ok: false, error: "Missing document data" };
  }
  const mimeType = (input.mimeType || "application/pdf").trim().toLowerCase();
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Unsupported document type. Upload PDF, DOC, or DOCX." };
  }
  const fileName = (input.fileName || "resume.pdf").trim();
  const extension = extensionFromFileName(fileName);
  if (!extension || !ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Unsupported document extension. Use .pdf, .doc, or .docx." };
  }
  const estimatedBytes = estimateBase64Bytes(base64Data);
  const maxBytes = Math.max(readMaxUploadBytes(), DEFAULT_RESUME_MAX_BYTES);
  if (estimatedBytes > maxBytes) {
    return { ok: false, error: `Document exceeds maximum upload size of ${maxBytes} bytes` };
  }
  return { ok: true, mimeType, fileName, estimatedBytes };
}
function validateVerificationUploadInput(input) {
  const base64Data = input.base64Data?.trim();
  if (!base64Data) {
    return { ok: false, error: "Missing verification file data" };
  }
  const mimeType = (input.mimeType || "application/pdf").trim().toLowerCase();
  if (!ALLOWED_VERIFICATION_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: "Unsupported file type. Upload PDF/DOC/DOCX or JPEG/PNG/WebP/GIF."
    };
  }
  const fileName = (input.fileName || "verification-doc").trim();
  const extension = extensionFromFileName(fileName);
  if (!extension || !ALLOWED_VERIFICATION_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: "Unsupported file extension. Use .pdf, .doc, .docx, .jpg, .jpeg, .png, .webp, or .gif."
    };
  }
  const estimatedBytes = estimateBase64Bytes(base64Data);
  const maxBytes = Math.max(readMaxUploadBytes(), DEFAULT_RESUME_MAX_BYTES);
  if (estimatedBytes > maxBytes) {
    return { ok: false, error: `File exceeds maximum upload size of ${maxBytes} bytes` };
  }
  const kind = ALLOWED_MIME_TYPES.has(mimeType) ? "image" : "document";
  return { ok: true, mimeType, fileName, estimatedBytes, kind };
}
var ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, DEFAULT_MAX_BYTES, ALLOWED_DOCUMENT_MIME_TYPES, ALLOWED_DOCUMENT_EXTENSIONS, DEFAULT_RESUME_MAX_BYTES, ALLOWED_VERIFICATION_MIME_TYPES, ALLOWED_VERIFICATION_EXTENSIONS;
var init_uploadValidation = __esm({
  "server/lib/uploadValidation.ts"() {
    ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif"
    ]);
    ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
    DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
    ALLOWED_DOCUMENT_MIME_TYPES = /* @__PURE__ */ new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]);
    ALLOWED_DOCUMENT_EXTENSIONS = /* @__PURE__ */ new Set([".pdf", ".doc", ".docx"]);
    DEFAULT_RESUME_MAX_BYTES = 8 * 1024 * 1024;
    ALLOWED_VERIFICATION_MIME_TYPES = /* @__PURE__ */ new Set([
      ...ALLOWED_DOCUMENT_MIME_TYPES,
      ...ALLOWED_MIME_TYPES
    ]);
    ALLOWED_VERIFICATION_EXTENSIONS = /* @__PURE__ */ new Set([
      ...ALLOWED_DOCUMENT_EXTENSIONS,
      ...ALLOWED_EXTENSIONS
    ]);
  }
});

// server/operations/operationsStore.ts
function mergeRolePermissions(defaults, incoming) {
  const merged = { ...defaults, ...incoming || {} };
  Object.keys(defaults).forEach((key) => {
    if (defaults[key]) merged[key] = true;
  });
  return merged;
}
var nowIso9, slugify3, defaultJobPostings, defaultCoupons, defaultFeeCharges, defaultPaymentOptionsConfig, DEFAULT_ROLE_PERMISSIONS, state2, persistHook, touch, operationsStore;
var init_operationsStore = __esm({
  "server/operations/operationsStore.ts"() {
    nowIso9 = () => (/* @__PURE__ */ new Date()).toISOString();
    slugify3 = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `job-${Date.now()}`;
    defaultJobPostings = () => {
      const ts = nowIso9();
      return [
        {
          id: "job-frontend-engineer",
          slug: "frontend-engineer",
          title: "Frontend Engineer",
          department: "Engineering",
          location: "Dhaka / Hybrid",
          employmentType: "full_time",
          summary: "Build and polish the Choosify storefront experience \u2014 discovery feeds, product detail, and buyer dashboard.",
          description: "As a Frontend Engineer at Choosify, you will ship high-quality React interfaces that help millions of shoppers discover verified brands across Bangladesh. You will work closely with design and product to turn marketplace ideas into fast, accessible UI.",
          responsibilities: "- Own features across Choosify-Web (React, TypeScript, Vite)\n- Collaborate with design on feed layouts, cards, and forms\n- Improve performance, accessibility, and SEO for public pages\n- Partner with backend on public API contracts",
          requirements: "- Strong React + TypeScript experience\n- Comfortable with modern CSS / design systems\n- Experience shipping consumer-facing web products\n- Clear written communication",
          status: "open",
          postedAt: ts,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "job-product-designer",
          slug: "product-designer",
          title: "Product Designer",
          department: "Design",
          location: "Remote",
          employmentType: "full_time",
          summary: "Shape Choosify\u2019s visual system and craft clear buyer/seller flows across web and dashboard.",
          description: "We are looking for a Product Designer who can balance brand expression with practical marketplace UX. You will design flows for discovery, careers, seller tools, and more.",
          responsibilities: "- Design end-to-end product flows and high-fidelity UI\n- Maintain and evolve the Choosify design system\n- Prototype and validate with stakeholders\n- Partner with engineering for polished implementation",
          requirements: "- Portfolio showing marketplace or consumer product work\n- Strong Figma skills\n- Systems thinking around components and tokens\n- Comfortable iterating quickly with engineers",
          status: "open",
          postedAt: ts,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "job-growth-marketing-intern",
          slug: "growth-marketing-intern",
          title: "Growth Marketing Intern",
          department: "Growth",
          location: "Dhaka",
          employmentType: "internship",
          summary: "Support campaigns, content experiments, and community outreach that grow Choosify awareness.",
          description: "Join the Growth team for a hands-on internship. You will help run experiments across social, partnerships, and content while learning how a marketplace brand scales in Bangladesh.",
          responsibilities: "- Assist with social content calendars and campaign tracking\n- Support creator/brand outreach lists\n- Help analyze simple performance metrics\n- Contribute ideas for seasonal campaigns",
          requirements: "- Currently studying marketing, communications, or related field\n- Strong Bangla + English writing\n- Curious about e-commerce and social platforms\n- Reliable and organized",
          status: "open",
          postedAt: ts,
          createdAt: ts,
          updatedAt: ts
        }
      ];
    };
    defaultCoupons = () => {
      const ts = nowIso9();
      return [
        {
          id: "coup_welcome250",
          code: "WELCOME250",
          type: "fixed_amount",
          discountTarget: "all_products",
          discountValue: 250,
          validFrom: "2026-01-01",
          validUntil: "2026-12-31",
          active: true,
          rules: { minPurchaseAmount: 1e3, maxUsages: 100, maxUsagesPerUser: 1 },
          description: "Welcome discount for new accounts",
          totalUsages: 0,
          totalRedemptions: 0,
          totalDiscountGiven: 0,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "coup_summer2026",
          code: "SUMMER2026",
          type: "percentage",
          discountTarget: "all_products",
          discountValue: 15,
          validFrom: "2026-06-01",
          validUntil: "2026-12-31",
          active: true,
          rules: { minPurchaseAmount: 500, maxDiscountAmount: 600, maxUsages: 500 },
          description: "Seasonal summer campaign",
          totalUsages: 0,
          totalRedemptions: 0,
          totalDiscountGiven: 0,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "coup_aarong15",
          code: "AARONG15",
          type: "percentage",
          discountTarget: "all_products",
          discountValue: 15,
          validFrom: "2026-01-01",
          validUntil: "2026-12-31",
          active: true,
          rules: { minPurchaseAmount: 500 },
          description: "Aarong brand promo",
          totalUsages: 0,
          totalRedemptions: 0,
          totalDiscountGiven: 0,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "coup_apexfoot26",
          code: "APEXFOOT26",
          type: "fixed_amount",
          discountTarget: "all_products",
          discountValue: 500,
          validFrom: "2026-01-01",
          validUntil: "2026-12-31",
          active: true,
          rules: { minPurchaseAmount: 2e3 },
          description: "Apex footwear flat discount",
          totalUsages: 0,
          totalRedemptions: 0,
          totalDiscountGiven: 0,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "coup_sailoreid",
          code: "SAILOREID",
          type: "percentage",
          discountTarget: "all_products",
          discountValue: 20,
          validFrom: "2026-01-01",
          validUntil: "2026-12-31",
          active: true,
          rules: { minPurchaseAmount: 800, maxDiscountAmount: 800 },
          description: "Sailor Eid campaign",
          totalUsages: 0,
          totalRedemptions: 0,
          totalDiscountGiven: 0,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "coup_adiextra10",
          code: "ADIEXTRA10",
          type: "percentage",
          discountTarget: "all_products",
          discountValue: 10,
          validFrom: "2026-01-01",
          validUntil: "2026-12-31",
          active: true,
          rules: { minPurchaseAmount: 300 },
          description: "Adidas extra savings",
          totalUsages: 0,
          totalRedemptions: 0,
          totalDiscountGiven: 0,
          createdAt: ts,
          updatedAt: ts
        }
      ];
    };
    defaultFeeCharges = () => {
      const ts = nowIso9();
      return [
        {
          id: "fee_platform_commission",
          name: "Platform Commission",
          type: "platform_fee",
          rateType: "percentage",
          rateValue: 8,
          scopeType: "platform",
          active: true,
          description: "Default platform-wide commission applied to every order.",
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "fee_service_charge",
          name: "Service Charge",
          type: "service_charge",
          rateType: "flat",
          rateValue: 20,
          scopeType: "platform",
          active: true,
          description: "Flat service charge applied per order.",
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "fee_standard_delivery",
          name: "Standard Delivery Fee",
          type: "delivery",
          rateType: "flat",
          rateValue: 60,
          scopeType: "platform",
          active: true,
          description: "Default flat delivery fee for platform-wide orders.",
          createdAt: ts,
          updatedAt: ts
        }
      ];
    };
    defaultPaymentOptionsConfig = () => ({
      partialPaymentEnabled: true,
      minDepositPercent: 10,
      maxDepositPercent: 50,
      updatedAt: nowIso9()
    });
    DEFAULT_ROLE_PERMISSIONS = {
      super_admin: { content: true, users: true, finance: true, brand: true, system: true, analytics: true },
      admin: { content: true, users: true, finance: false, brand: true, system: true, analytics: true },
      // Aligned with src/lib/rbac.ts — seller/creator CMS mirror menus need these gates open
      seller: { content: true, users: true, finance: true, brand: true, system: true, analytics: true },
      creator: { content: true, users: true, finance: true, brand: false, system: true, analytics: true },
      moderator: { content: true, users: false, finance: false, brand: true, system: false, analytics: true },
      finance_manager: { content: false, users: false, finance: true, brand: false, system: false, analytics: true },
      support_agent: { content: false, users: true, finance: false, brand: false, system: false, analytics: true },
      marketing_manager: { content: true, users: false, finance: false, brand: false, system: false, analytics: true }
    };
    state2 = {
      orders: [],
      coupons: defaultCoupons(),
      couponUsage: [],
      reviews: [],
      leads: [],
      jobPostings: defaultJobPostings(),
      jobApplications: [],
      permissions: structuredClone(DEFAULT_ROLE_PERMISSIONS),
      feeCharges: defaultFeeCharges(),
      paymentOptionsConfig: defaultPaymentOptionsConfig(),
      sellerBookingSettings: {},
      returns: [],
      verifications: [],
      featureFlags: {
        creator_hub: true,
        compare_tool: true,
        enable_comparison_engine: true,
        enable_creator_marketplace: true,
        enable_community_submissions: true,
        enable_campaign_banners: true,
        enable_cod_only_mode: false,
        enable_promo_codes: true,
        enable_brand_deals_page: true,
        pwa_install_prompt: true,
        maintenance_mode: false
      },
      sellerOffers: []
    };
    persistHook = null;
    touch = () => {
      persistHook?.();
    };
    operationsStore = {
      setPersistHook: (hook) => {
        persistHook = hook;
      },
      hydrate: (snapshot) => {
        if (snapshot.orders) state2.orders = snapshot.orders;
        if (snapshot.coupons?.length) state2.coupons = snapshot.coupons;
        if (snapshot.couponUsage) state2.couponUsage = snapshot.couponUsage;
        if (snapshot.reviews) state2.reviews = snapshot.reviews;
        if (snapshot.leads) state2.leads = snapshot.leads;
        if (snapshot.jobPostings?.length) state2.jobPostings = snapshot.jobPostings;
        if (snapshot.jobApplications) state2.jobApplications = snapshot.jobApplications;
        if (snapshot.permissions) {
          state2.permissions = {
            ...structuredClone(DEFAULT_ROLE_PERMISSIONS),
            ...snapshot.permissions,
            seller: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.seller, snapshot.permissions.seller),
            creator: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.creator, snapshot.permissions.creator)
          };
        }
        if (snapshot.featureFlags) state2.featureFlags = snapshot.featureFlags;
        if (snapshot.sellerOffers) state2.sellerOffers = snapshot.sellerOffers;
        if (snapshot.feeCharges?.length) state2.feeCharges = snapshot.feeCharges;
        if (snapshot.paymentOptionsConfig) state2.paymentOptionsConfig = snapshot.paymentOptionsConfig;
        if (snapshot.sellerBookingSettings) state2.sellerBookingSettings = snapshot.sellerBookingSettings;
        if (snapshot.returns) state2.returns = snapshot.returns;
        if (snapshot.verifications) state2.verifications = snapshot.verifications;
      },
      listCouponUsage: () => [...state2.couponUsage],
      listOrders: (filter) => {
        let rows = [...state2.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (filter?.buyerId) {
          rows = rows.filter((order) => order.buyerId === filter.buyerId);
        }
        if (filter?.sellerId) {
          const sellerId = filter.sellerId;
          rows = rows.filter(
            (order) => (order.subOrders || []).some(
              (sub) => sub?.sellerId === sellerId
            )
          );
        }
        if (filter?.status) {
          rows = rows.filter((order) => order.status.toLowerCase() === filter.status.toLowerCase());
        }
        return rows;
      },
      getOrder: (id) => state2.orders.find((order) => order.id === id || order.orderId === id) ?? null,
      createOrder: (payload) => {
        const order = {
          ...payload,
          id: payload.orderId,
          updatedAt: nowIso9()
        };
        state2.orders.unshift(order);
        touch();
        return order;
      },
      updateOrder: (id, patch) => {
        const idx = state2.orders.findIndex((order) => order.id === id || order.orderId === id);
        if (idx < 0) return null;
        state2.orders[idx] = { ...state2.orders[idx], ...patch, updatedAt: nowIso9() };
        touch();
        return state2.orders[idx];
      },
      getOrderByClaimToken: (token) => state2.orders.find((order) => order.claimToken === token) ?? null,
      claimOrder: (token, buyer) => {
        const idx = state2.orders.findIndex((order2) => order2.claimToken === token);
        if (idx < 0) return null;
        const order = state2.orders[idx];
        if (order.claimedAt) return order;
        state2.orders[idx] = {
          ...order,
          buyerId: buyer.buyerId,
          claimedAt: nowIso9(),
          claimedByName: buyer.buyerName,
          status: order.status === "pending_payment" ? "confirmed" : order.status,
          updatedAt: nowIso9()
        };
        touch();
        return state2.orders[idx];
      },
      listCoupons: () => state2.coupons.filter((coupon) => !coupon.deleted),
      getCoupon: (id) => state2.coupons.find((coupon) => coupon.id === id) ?? null,
      getCouponByCode: (code) => state2.coupons.find((coupon) => coupon.code.toUpperCase() === code.toUpperCase() && !coupon.deleted) ?? null,
      upsertCoupon: (coupon) => {
        const idx = state2.coupons.findIndex((row) => row.id === coupon.id);
        if (idx >= 0) {
          state2.coupons[idx] = { ...state2.coupons[idx], ...coupon, updatedAt: nowIso9() };
          touch();
          return state2.coupons[idx];
        }
        state2.coupons.push({ ...coupon, createdAt: coupon.createdAt || nowIso9(), updatedAt: nowIso9() });
        touch();
        return coupon;
      },
      deleteCoupon: (id) => {
        const coupon = state2.coupons.find((row) => row.id === id);
        if (!coupon) return false;
        coupon.deleted = true;
        coupon.active = false;
        coupon.updatedAt = nowIso9();
        touch();
        return true;
      },
      recordCouponUsage: (usage) => {
        const row = {
          ...usage,
          id: `usage-${Date.now()}`,
          timestamp: nowIso9()
        };
        state2.couponUsage.unshift(row);
        const coupon = state2.coupons.find((c) => c.id === usage.couponId);
        if (coupon) {
          coupon.totalUsages += 1;
          if (usage.status === "redeemed") {
            coupon.totalRedemptions += 1;
            coupon.totalDiscountGiven += usage.discountAmount;
          }
          coupon.updatedAt = nowIso9();
        }
        touch();
        return row;
      },
      countCouponUsageForUser: (couponId, userId) => state2.couponUsage.filter(
        (usage) => usage.couponId === couponId && usage.userId === userId && usage.status === "redeemed"
      ).length,
      listReviews: (filters) => {
        let rows = [...state2.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (filters?.productId) {
          rows = rows.filter((review) => review.productId === filters.productId);
        }
        if (filters?.brandName) {
          const needle = filters.brandName.trim().toLowerCase();
          rows = rows.filter((review) => (review.brandName || "").trim().toLowerCase() === needle);
        }
        if (filters?.userId) {
          rows = rows.filter((review) => review.userId === filters.userId);
        }
        if (filters?.status) {
          rows = rows.filter((review) => review.status.toLowerCase() === filters.status.toLowerCase());
        }
        return rows;
      },
      getReview: (id) => state2.reviews.find((review) => review.id === id) ?? null,
      createReview: (payload) => {
        const review = {
          ...payload,
          id: `rev-${Date.now()}`,
          status: "pending",
          reports: 0,
          createdAt: nowIso9(),
          updatedAt: nowIso9()
        };
        state2.reviews.unshift(review);
        touch();
        return review;
      },
      updateReview: (id, patch) => {
        const idx = state2.reviews.findIndex((review) => review.id === id);
        if (idx < 0) return null;
        state2.reviews[idx] = { ...state2.reviews[idx], ...patch, updatedAt: nowIso9() };
        touch();
        return state2.reviews[idx];
      },
      deleteReview: (id) => {
        const before = state2.reviews.length;
        state2.reviews = state2.reviews.filter((review) => review.id !== id);
        touch();
        return state2.reviews.length < before;
      },
      listLeads: () => [...state2.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      getLead: (id) => state2.leads.find((lead) => lead.id === id) ?? null,
      createLead: (payload) => {
        const lead = {
          ...payload,
          id: `lead-${Date.now()}`,
          status: "new",
          createdAt: nowIso9(),
          updatedAt: nowIso9()
        };
        state2.leads.unshift(lead);
        touch();
        return lead;
      },
      updateLead: (id, patch) => {
        const idx = state2.leads.findIndex((lead) => lead.id === id);
        if (idx < 0) return null;
        state2.leads[idx] = { ...state2.leads[idx], ...patch, updatedAt: nowIso9() };
        touch();
        return state2.leads[idx];
      },
      listJobPostings: (options) => {
        const rows = [...state2.jobPostings].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
        if (options?.publicOnly) return rows.filter((job) => job.status === "open");
        return rows;
      },
      getJobPosting: (idOrSlug) => state2.jobPostings.find((job) => job.id === idOrSlug || job.slug === idOrSlug) ?? null,
      createJobPosting: (payload) => {
        const ts = nowIso9();
        const baseSlug = slugify3(payload.slug || payload.title);
        let slug = baseSlug;
        let n = 2;
        while (state2.jobPostings.some((job2) => job2.slug === slug)) {
          slug = `${baseSlug}-${n++}`;
        }
        const job = {
          ...payload,
          id: `job-${Date.now()}`,
          slug,
          postedAt: payload.postedAt || ts,
          createdAt: ts,
          updatedAt: ts
        };
        state2.jobPostings.unshift(job);
        touch();
        return job;
      },
      updateJobPosting: (id, patch) => {
        const idx = state2.jobPostings.findIndex((job) => job.id === id);
        if (idx < 0) return null;
        const next = { ...state2.jobPostings[idx], ...patch, updatedAt: nowIso9() };
        if (patch.title && !patch.slug) {
        }
        if (patch.slug) {
          next.slug = slugify3(patch.slug);
        }
        state2.jobPostings[idx] = next;
        touch();
        return state2.jobPostings[idx];
      },
      deleteJobPosting: (id) => {
        const before = state2.jobPostings.length;
        state2.jobPostings = state2.jobPostings.filter((job) => job.id !== id);
        touch();
        return state2.jobPostings.length < before;
      },
      listJobApplications: (jobId) => {
        const rows = [...state2.jobApplications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return jobId ? rows.filter((row) => row.jobId === jobId) : rows;
      },
      createJobApplication: (payload) => {
        const application = {
          ...payload,
          id: `jobapp-${Date.now()}`,
          status: "new",
          createdAt: nowIso9(),
          updatedAt: nowIso9()
        };
        state2.jobApplications.unshift(application);
        touch();
        return application;
      },
      updateJobApplication: (id, patch) => {
        const idx = state2.jobApplications.findIndex((row) => row.id === id);
        if (idx < 0) return null;
        state2.jobApplications[idx] = { ...state2.jobApplications[idx], ...patch, updatedAt: nowIso9() };
        touch();
        return state2.jobApplications[idx];
      },
      getFeatureFlags: () => ({ ...state2.featureFlags }),
      updateFeatureFlags: (flags) => {
        state2.featureFlags = { ...state2.featureFlags, ...flags };
        touch();
        return state2.featureFlags;
      },
      listUsers: () => {
        const byKey = /* @__PURE__ */ new Map();
        const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";
        for (const order of state2.orders) {
          const key = order.buyerId || order.orderId;
          if (byKey.has(key)) continue;
          const name = order.shipping?.fullName || order.buyerId || "Guest";
          byKey.set(key, {
            id: key,
            name,
            email: `${key.replace(/\s+/g, ".").toLowerCase()}@orders.choosify.bd`,
            role: "Consumer",
            status: "Active",
            joined: order.createdAt?.split("T")[0] || "\u2014",
            active: order.updatedAt?.split("T")[0] || order.createdAt?.split("T")[0] || "\u2014",
            initials: initials(name),
            trustScore: 85,
            behaviorSegment: "Retail Shopper"
          });
        }
        for (const lead of state2.leads) {
          const key = lead.email.toLowerCase();
          if (byKey.has(key)) continue;
          const name = lead.contactPerson || lead.brandName;
          byKey.set(key, {
            id: key,
            name,
            email: lead.email,
            role: "Consumer",
            status: "Active",
            joined: lead.createdAt?.split("T")[0] || "\u2014",
            active: lead.updatedAt?.split("T")[0] || "\u2014",
            initials: initials(name),
            trustScore: 80,
            behaviorSegment: lead.source || "Lead"
          });
        }
        return [...byKey.values()].sort((a, b) => b.active.localeCompare(a.active));
      },
      listSellerOffers: () => [...state2.sellerOffers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      createSellerOffer: (payload) => {
        const row = {
          ...payload,
          id: `offer-${Date.now()}`,
          status: "new",
          createdAt: nowIso9(),
          updatedAt: nowIso9()
        };
        state2.sellerOffers.unshift(row);
        touch();
        return row;
      },
      updateSellerOffer: (id, patch) => {
        const idx = state2.sellerOffers.findIndex((row) => row.id === id);
        if (idx < 0) return null;
        state2.sellerOffers[idx] = { ...state2.sellerOffers[idx], ...patch, updatedAt: nowIso9() };
        touch();
        return state2.sellerOffers[idx];
      },
      getPermissions: () => {
        const current = structuredClone(state2.permissions);
        return {
          ...structuredClone(DEFAULT_ROLE_PERMISSIONS),
          ...current,
          seller: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.seller, current.seller),
          creator: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.creator, current.creator)
        };
      },
      updatePermissions: (permissions) => {
        state2.permissions = {
          ...structuredClone(DEFAULT_ROLE_PERMISSIONS),
          ...structuredClone(permissions),
          seller: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.seller, permissions.seller),
          creator: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.creator, permissions.creator)
        };
        touch();
        return state2.permissions;
      },
      listFeeCharges: () => state2.feeCharges.filter((fee) => !fee.deleted),
      getFeeCharge: (id) => state2.feeCharges.find((fee) => fee.id === id) ?? null,
      upsertFeeCharge: (fee) => {
        const idx = state2.feeCharges.findIndex((row) => row.id === fee.id);
        if (idx >= 0) {
          state2.feeCharges[idx] = { ...state2.feeCharges[idx], ...fee, updatedAt: nowIso9() };
          touch();
          return state2.feeCharges[idx];
        }
        state2.feeCharges.push({ ...fee, createdAt: fee.createdAt || nowIso9(), updatedAt: nowIso9() });
        touch();
        return fee;
      },
      deleteFeeCharge: (id) => {
        const fee = state2.feeCharges.find((row) => row.id === id);
        if (!fee) return false;
        fee.deleted = true;
        fee.active = false;
        fee.updatedAt = nowIso9();
        touch();
        return true;
      },
      getPaymentOptionsConfig: () => ({ ...state2.paymentOptionsConfig }),
      getAllSellerBookingSettings: () => ({ ...state2.sellerBookingSettings }),
      updatePaymentOptionsConfig: (patch) => {
        state2.paymentOptionsConfig = { ...state2.paymentOptionsConfig, ...patch, updatedAt: nowIso9() };
        touch();
        return state2.paymentOptionsConfig;
      },
      /** Defaults to `autoApproveBookingsDefault: false` (require approval) for sellers who haven't set one. */
      getSellerBookingSettings: (sellerId) => {
        return state2.sellerBookingSettings[sellerId] || {
          sellerId,
          autoApproveBookingsDefault: false,
          updatedAt: nowIso9()
        };
      },
      updateSellerBookingSettings: (sellerId, patch) => {
        const existing = state2.sellerBookingSettings[sellerId] || {
          sellerId,
          autoApproveBookingsDefault: false,
          updatedAt: nowIso9()
        };
        const updated = { ...existing, ...patch, sellerId, updatedAt: nowIso9() };
        state2.sellerBookingSettings[sellerId] = updated;
        touch();
        return updated;
      },
      listReturns: (filter) => {
        let rows = [...state2.returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (filter?.buyerId) {
          rows = rows.filter((row) => row.buyerId === filter.buyerId);
        }
        if (filter?.sellerId) {
          rows = rows.filter((row) => row.sellerId === filter.sellerId);
        }
        if (filter?.status) {
          rows = rows.filter((row) => row.status.toLowerCase() === filter.status.toLowerCase());
        }
        return rows;
      },
      getReturn: (id) => state2.returns.find((row) => row.id === id) ?? null,
      createReturn: (payload) => {
        const ts = nowIso9();
        const row = {
          ...payload,
          id: payload.id || `RET-${Date.now()}`,
          notes: payload.notes ?? [],
          createdAt: payload.createdAt || ts,
          updatedAt: payload.updatedAt || ts
        };
        state2.returns.unshift(row);
        touch();
        return row;
      },
      updateReturn: (id, patch) => {
        const idx = state2.returns.findIndex((row) => row.id === id);
        if (idx < 0) return null;
        state2.returns[idx] = { ...state2.returns[idx], ...patch, updatedAt: nowIso9() };
        touch();
        return state2.returns[idx];
      },
      listVerifications: (filter) => {
        let rows = [...state2.verifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
        if (filter?.submittedBy) {
          rows = rows.filter((row) => row.submitted_by === filter.submittedBy);
        }
        if (filter?.status) {
          rows = rows.filter((row) => row.status.toLowerCase() === filter.status.toLowerCase());
        }
        if (filter?.entityType) {
          rows = rows.filter((row) => row.entityType === filter.entityType);
        }
        if (filter?.entityId) {
          rows = rows.filter((row) => row.entityId === filter.entityId || row.brand_id === filter.entityId);
        }
        return rows;
      },
      getVerification: (id) => state2.verifications.find((row) => row.id === id) ?? null,
      createVerification: (payload) => {
        const ts = nowIso9();
        const entityType = payload.entityType || "brand";
        const entityId = payload.entityId || payload.brand_id;
        const entityName = payload.entityName || payload.brand_name;
        const row = {
          ...payload,
          entityType,
          entityId,
          entityName,
          brand_id: payload.brand_id || entityId,
          brand_name: payload.brand_name || entityName,
          logo_url: payload.logo_url || "",
          id: payload.id || `vr_${Date.now()}`,
          reviews: payload.reviews ?? [],
          audit_trail: payload.audit_trail ?? [],
          created_at: payload.created_at || ts,
          updated_at: payload.updated_at || ts
        };
        state2.verifications.unshift(row);
        touch();
        return row;
      },
      updateVerification: (id, patch) => {
        const idx = state2.verifications.findIndex((row) => row.id === id);
        if (idx < 0) return null;
        state2.verifications[idx] = {
          ...state2.verifications[idx],
          ...patch,
          updated_at: nowIso9()
        };
        touch();
        return state2.verifications[idx];
      },
      updateVerificationDocument: (requestId, docId, patch) => {
        const idx = state2.verifications.findIndex((row2) => row2.id === requestId);
        if (idx < 0) return null;
        const row = state2.verifications[idx];
        const docIdx = row.documents.findIndex((d) => d.id === docId);
        if (docIdx < 0) return null;
        const documents = row.documents.map((d, i) => i === docIdx ? { ...d, ...patch } : d);
        state2.verifications[idx] = { ...row, documents, updated_at: nowIso9() };
        touch();
        return state2.verifications[idx];
      }
    };
  }
});

// server/operations/platformMessagingBridge.ts
async function ensurePlatformOrderConversation(order) {
  const conversationId = `conv_platform_${order.buyerId}`;
  const existing = await getConversation(conversationId);
  const summary = `Order ${order.orderId} placed \u2014 \u09F3${Number(order.overallTotal || 0).toLocaleString()} (${order.sourceMode || "retail"})`;
  const conversation = {
    conversationId,
    platform: "platform",
    senderName: order.shipping?.fullName || order.buyerId,
    lastMessage: summary,
    assignedAgent: existing?.assignedAgent || "agent_farhan",
    status: "open",
    updatedAt: nowIso10()
  };
  await saveConversation(conversation);
  const message = {
    id: `m_sys_${Date.now()}`,
    platform: "platform",
    platformMessageId: `sys_order_${order.orderId}`,
    conversationId,
    senderId: "system",
    senderName: "Choosify Platform",
    content: { type: "text", body: summary },
    direction: "inbound",
    status: "delivered",
    assignedAgent: conversation.assignedAgent,
    conversationStatus: conversation.status,
    timestamp: nowIso10()
  };
  await saveMessage(message);
  return conversation;
}
async function submitPlatformMessage(payload) {
  const conversationId = `conv_platform_${payload.buyerId}`;
  const existing = await getConversation(conversationId);
  const conversation = {
    conversationId,
    platform: "platform",
    senderName: payload.userName,
    lastMessage: payload.body,
    assignedAgent: existing?.assignedAgent || "agent_farhan",
    status: "open",
    updatedAt: nowIso10()
  };
  const prefix = payload.orderId ? `[Order ${payload.orderId}] ` : "";
  const message = {
    id: `m_plat_${Date.now()}`,
    platform: "platform",
    platformMessageId: `plat_${Date.now()}`,
    conversationId,
    senderId: payload.buyerId,
    senderName: payload.userName,
    content: { type: "text", body: `${prefix}${payload.body}`.trim() },
    direction: "inbound",
    status: "delivered",
    assignedAgent: conversation.assignedAgent,
    conversationStatus: conversation.status,
    timestamp: nowIso10(),
    bookingOffer: payload.bookingOffer
  };
  await saveConversation(conversation);
  await saveMessage(message);
  return { conversation, message };
}
var nowIso10;
var init_platformMessagingBridge = __esm({
  "server/operations/platformMessagingBridge.ts"() {
    init_omniStore();
    nowIso10 = () => (/* @__PURE__ */ new Date()).toISOString();
  }
});

// server/operations/operationsPersistence.ts
function buildOperationsSnapshot() {
  return {
    orders: operationsStore.listOrders(),
    coupons: operationsStore.listCoupons(),
    couponUsage: operationsStore.listCouponUsage(),
    reviews: operationsStore.listReviews(),
    leads: operationsStore.listLeads(),
    jobPostings: operationsStore.listJobPostings(),
    jobApplications: operationsStore.listJobApplications(),
    permissions: operationsStore.getPermissions(),
    shipments: shipmentStore.listShipments(),
    featureFlags: operationsStore.getFeatureFlags(),
    sellerOffers: operationsStore.listSellerOffers(),
    feeCharges: operationsStore.listFeeCharges(),
    paymentOptionsConfig: operationsStore.getPaymentOptionsConfig(),
    sellerBookingSettings: operationsStore.getAllSellerBookingSettings(),
    returns: operationsStore.listReturns(),
    verifications: operationsStore.listVerifications()
  };
}
function scheduleOperationsPersist() {
  if (!useOperationsFirestore) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveOperationsSnapshot(buildOperationsSnapshot()).catch((err) => {
      console.error("[OperationsPersist] Failed to save snapshot:", err);
    });
  }, 400);
}
var persistTimer;
var init_operationsPersistence = __esm({
  "server/operations/operationsPersistence.ts"() {
    init_operationsStore();
    init_shipmentStore();
    init_operationsDb();
    persistTimer = null;
  }
});

// shared/booking/bookingFieldConfig.ts
function normalizeServiceCategory(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[&/]+/g, " ").replace(/-/g, " ").replace(/\s+/g, " ");
  if (CATEGORY_ALIASES[normalized]) return CATEGORY_ALIASES[normalized];
  const match = Object.keys(CATEGORY_ALIASES).find((key) => normalized.includes(key));
  return match ? CATEGORY_ALIASES[match] : "travel";
}
function listingSectionLabels(productType) {
  const service = String(productType || "").toLowerCase() === "service";
  return {
    specifications: service ? "Service Specifications" : "Product Specifications",
    overview: service ? "Service Overview" : "Product Overview",
    boxContent: service ? "Complimentary Features" : "Box Content",
    physicalSpecs: service ? "Property Specs" : "Physical Specs"
  };
}
function getBookingFieldConfigPayload() {
  return {
    categories: SERVICE_CATEGORIES.map((id) => ({
      id,
      label: SERVICE_CATEGORY_LABELS[id],
      fields: SERVICE_BOOKING_FIELDS[id]
    })),
    fieldsByCategory: SERVICE_BOOKING_FIELDS,
    sellerResponseHours: BOOKING_SELLER_RESPONSE_HOURS,
    paymentWindowHours: BOOKING_PAYMENT_WINDOW_HOURS,
    sectionLabels: {
      service: listingSectionLabels("service"),
      physical: listingSectionLabels("physical")
    }
  };
}
var SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, notes, SERVICE_BOOKING_FIELDS, CATEGORY_ALIASES, BOOKING_SELLER_RESPONSE_HOURS, BOOKING_PAYMENT_WINDOW_HOURS;
var init_bookingFieldConfig = __esm({
  "shared/booking/bookingFieldConfig.ts"() {
    SERVICE_CATEGORIES = [
      "hotels",
      "restaurants",
      "travel",
      "doctors",
      "education",
      "beauty",
      "real_estate",
      "transport",
      "events",
      "tickets",
      "home_services",
      "gov_services",
      "recruitment",
      "b2b",
      "rental",
      "donation"
    ];
    SERVICE_CATEGORY_LABELS = {
      hotels: "Hotels",
      restaurants: "Restaurants",
      travel: "Travel & Tours",
      doctors: "Doctors",
      education: "Education",
      beauty: "Beauty",
      real_estate: "Real Estate",
      transport: "Transport",
      events: "Events & Wedding",
      tickets: "Tickets & Entry Passes",
      home_services: "Home & Professional Services",
      gov_services: "Government & Financial Services",
      recruitment: "Jobs & Recruitment",
      b2b: "B2B Marketplace",
      rental: "Rental Marketplace",
      donation: "Donations & Community"
    };
    notes = {
      key: "notes",
      label: "Notes",
      type: "textarea"
    };
    SERVICE_BOOKING_FIELDS = {
      hotels: [
        { key: "checkInDate", label: "Check-in date", type: "date", required: true },
        { key: "checkInTime", label: "Check-in time", type: "time" },
        { key: "checkOutDate", label: "Check-out date", type: "date", required: true },
        { key: "checkOutTime", label: "Check-out time", type: "time" },
        { key: "nights", label: "Nights of stay", type: "number", required: true, min: 1 },
        { key: "adults", label: "Adults", type: "number", required: true, min: 1 },
        { key: "children", label: "Children", type: "number", min: 0 },
        { key: "guests", label: "Total guests", type: "number", required: true, min: 1 },
        notes
      ],
      restaurants: [
        { key: "reservationDate", label: "Date", type: "date", required: true },
        { key: "reservationTime", label: "Time", type: "time", required: true },
        { key: "partySize", label: "Party size", type: "number", required: true, min: 1 },
        notes
      ],
      doctors: [
        { key: "appointmentDate", label: "Appointment date", type: "date", required: true },
        { key: "appointmentTime", label: "Time", type: "time", required: true },
        { key: "patientName", label: "Patient name", type: "text", required: true },
        { key: "patientAge", label: "Patient age", type: "number", required: true, min: 0 },
        { key: "reason", label: "Reason for visit", type: "textarea", required: true },
        notes
      ],
      education: [
        { key: "preferredStartDate", label: "Preferred start date", type: "date", required: true },
        { key: "seats", label: "Seats", type: "number", required: true, min: 1 },
        {
          key: "mode",
          label: "Mode",
          type: "select",
          required: true,
          options: ["Online", "In person", "Hybrid"]
        },
        notes
      ],
      beauty: [
        { key: "appointmentDate", label: "Date", type: "date", required: true },
        { key: "appointmentTime", label: "Time", type: "time", required: true },
        { key: "guests", label: "Guests", type: "number", required: true, min: 1 },
        notes
      ],
      real_estate: [
        { key: "viewingDate", label: "Viewing date", type: "date", required: true },
        { key: "viewingTime", label: "Time", type: "time", required: true },
        { key: "visitors", label: "Visitors", type: "number", required: true, min: 1 },
        notes
      ],
      transport: [
        { key: "pickupDate", label: "Pickup date", type: "date", required: true },
        { key: "pickupTime", label: "Pickup time", type: "time", required: true },
        { key: "dropOffLocation", label: "Drop-off location", type: "text", required: true },
        { key: "passengers", label: "Passengers", type: "number", required: true, min: 1 },
        notes
      ],
      travel: [
        { key: "travelDate", label: "Preferred travel date", type: "date", required: true },
        { key: "travellers", label: "Travellers", type: "number", required: true, min: 1 },
        { key: "destination", label: "Destination", type: "text", required: true },
        notes
      ],
      events: [
        { key: "eventDate", label: "Event date", type: "date", required: true },
        { key: "eventLocation", label: "Event location", type: "text", required: true },
        { key: "guestCount", label: "Guest count", type: "number", min: 1 },
        notes
      ],
      tickets: [
        { key: "visitDate", label: "Visit / event date", type: "date", required: true },
        { key: "quantity", label: "Number of tickets", type: "number", required: true, min: 1 },
        notes
      ],
      home_services: [
        { key: "serviceDate", label: "Preferred date", type: "date", required: true },
        { key: "serviceTime", label: "Preferred time", type: "time" },
        { key: "address", label: "Service address", type: "text", required: true },
        notes
      ],
      gov_services: [
        { key: "preferredDate", label: "Preferred date", type: "date", required: true },
        { key: "applicantName", label: "Applicant name", type: "text", required: true },
        notes
      ],
      recruitment: [
        { key: "preferredStartDate", label: "Preferred start date", type: "date", required: true },
        { key: "rolesNeeded", label: "Roles needed", type: "number", required: true, min: 1 },
        notes
      ],
      b2b: [
        { key: "preferredDate", label: "Preferred date", type: "date", required: true },
        { key: "quantity", label: "Order quantity", type: "number", required: true, min: 1 },
        notes
      ],
      rental: [
        { key: "rentalStartDate", label: "Rental start date", type: "date", required: true },
        { key: "rentalEndDate", label: "Rental end date", type: "date", required: true },
        { key: "quantity", label: "Quantity", type: "number", required: true, min: 1 },
        notes
      ],
      donation: [
        { key: "amount", label: "Donation amount", type: "number", required: true, min: 1 },
        notes
      ]
    };
    CATEGORY_ALIASES = {
      hotel: "hotels",
      hotels: "hotels",
      restaurant: "restaurants",
      restaurants: "restaurants",
      reservation: "restaurants",
      travel: "travel",
      tour: "travel",
      tours: "travel",
      doctor: "doctors",
      doctors: "doctors",
      healthcare: "doctors",
      education: "education",
      beauty: "beauty",
      salon: "beauty",
      spa: "beauty",
      appointment: "beauty",
      appointments: "beauty",
      "real estate": "real_estate",
      "real-estate": "real_estate",
      real_estate: "real_estate",
      property: "real_estate",
      transport: "transport",
      transportation: "transport",
      event: "events",
      events: "events",
      wedding: "events",
      ticket: "tickets",
      tickets: "tickets",
      "home service": "home_services",
      "home services": "home_services",
      home_services: "home_services",
      cleaning: "home_services",
      "gov service": "gov_services",
      "gov services": "gov_services",
      gov_services: "gov_services",
      government: "gov_services",
      recruitment: "recruitment",
      hiring: "recruitment",
      jobs: "recruitment",
      b2b: "b2b",
      wholesale: "b2b",
      rental: "rental",
      rent: "rental",
      donation: "donation",
      donations: "donation",
      charity: "donation"
    };
    BOOKING_SELLER_RESPONSE_HOURS = 24;
    BOOKING_PAYMENT_WINDOW_HOURS = 8;
  }
});

// shared/booking/bookingTypes.ts
function toBookingOfferCard(request) {
  return {
    kind: "booking_offer",
    requestId: request.id,
    version: request.version,
    listingId: request.listingId,
    listingTitle: request.listingTitle,
    listingImage: request.listingImage,
    listingHref: request.listingHref,
    sellerId: request.sellerId,
    sellerName: request.sellerName,
    buyerId: request.buyerId,
    serviceCategory: request.serviceCategory,
    isService: request.isService,
    fields: request.fields,
    notes: request.notes,
    price: request.price,
    originalPrice: request.originalPrice,
    currency: request.currency,
    status: request.status,
    createdAt: request.createdAt,
    autoApproved: request.autoApproved,
    partialPaymentEnabled: request.partialPaymentEnabled,
    depositPercent: request.depositPercent,
    sellerRespondBy: request.sellerRespondBy,
    buyerRespondBy: request.buyerRespondBy,
    buyerPayBy: request.buyerPayBy,
    declineReason: request.declineReason,
    orderId: request.orderId
  };
}
var init_bookingTypes = __esm({
  "shared/booking/bookingTypes.ts"() {
  }
});

// server/catalogDefaults.ts
var nowIso12, defaultCategories2, defaultBrands2, defaultProducts2, defaultDeals2, defaultHomepage2;
var init_catalogDefaults = __esm({
  "server/catalogDefaults.ts"() {
    init_storefrontCategories();
    nowIso12 = () => (/* @__PURE__ */ new Date()).toISOString();
    defaultCategories2 = () => buildDefaultCatalogCategories();
    defaultBrands2 = () => {
      const ts = nowIso12();
      return [
        {
          id: "brand-samsung",
          slug: "samsung",
          name: "Samsung",
          category: "Electronics",
          description: "Samsung Bangladesh official storefront",
          logo: "S",
          verifiedStatus: true,
          claimStatus: "verified",
          followers: 12400,
          ratings: 4.8,
          featuredFlag: true,
          sponsoredFlag: false,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "brand-apple",
          slug: "apple",
          name: "Apple",
          category: "Tech",
          description: "Apple products and ecosystem",
          logo: "A",
          verifiedStatus: true,
          claimStatus: "verified",
          followers: 8920,
          ratings: 4.9,
          featuredFlag: true,
          sponsoredFlag: true,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "brand-apex",
          slug: "apex",
          name: "Apex",
          category: "Fashion",
          description: "Bangladesh fashion and footwear",
          logo: "Ap",
          verifiedStatus: true,
          claimStatus: "verified",
          followers: 5400,
          ratings: 4.6,
          featuredFlag: false,
          sponsoredFlag: false,
          createdAt: ts,
          updatedAt: ts
        }
      ];
    };
    defaultProducts2 = () => {
      const ts = nowIso12();
      return [
        {
          id: "prod-s24-ultra",
          slug: "samsung-galaxy-s24-ultra",
          title: "Samsung Galaxy S24 Ultra",
          description: "Flagship Samsung phone with advanced camera features.",
          brandId: "brand-samsung",
          brandName: "Samsung",
          categoryId: "cat-mobile",
          categoryName: "Mobile & Phones",
          image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop",
          gallery: [],
          modeType: "retail",
          price: 145e3,
          originalPrice: 155e3,
          stock: 42,
          status: "live",
          tags: ["NEW"],
          isDeal: true,
          dealType: "flash",
          discountPercent: 6.5,
          promoCode: "S24FLASH",
          dealValidUntil: new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString(),
          featuredFlag: true,
          isNewArrival: true,
          isBestseller: true,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "prod-macbook-air-m3",
          slug: "apple-macbook-air-m3",
          title: "Apple MacBook Air M3",
          description: "Lightweight laptop for creators and professionals.",
          brandId: "brand-apple",
          brandName: "Apple",
          categoryId: "cat-tech",
          categoryName: "Tech & Electronics",
          image: "https://images.unsplash.com/photo-1496181133227-f83bb023945d?w=400&h=400&fit=crop",
          gallery: [],
          modeType: "retail",
          price: 128e3,
          stock: 18,
          status: "live",
          tags: ["HOT"],
          isDeal: false,
          featuredFlag: true,
          isNewArrival: false,
          isBestseller: true,
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "prod-apex-loafer",
          slug: "apex-mens-royal-loafer",
          title: "Apex Men's Royal Loafer",
          description: "Comfortable premium loafers for everyday style.",
          brandId: "brand-apex",
          brandName: "Apex",
          categoryId: "cat-fashion",
          categoryName: "Fashion & Lifestyle",
          image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop",
          gallery: [],
          modeType: "retail",
          price: 3200,
          originalPrice: 4500,
          stock: 120,
          status: "live",
          tags: ["SALE"],
          isDeal: true,
          dealType: "brand",
          discountPercent: 28,
          promoCode: "APEXFLAT400",
          dealValidUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1e3).toISOString(),
          featuredFlag: false,
          isNewArrival: true,
          isBestseller: false,
          createdAt: ts,
          updatedAt: ts
        }
      ];
    };
    defaultDeals2 = () => {
      const ts = nowIso12();
      return [
        {
          id: "deal-s24-flash",
          slug: "s24-flash-deal",
          name: "S24 Ultra Flash Deal",
          seller: "Samsung Bangladesh",
          category: "Electronics",
          status: "live",
          type: "retail",
          discountType: "percentage",
          discountValue: 8,
          promoCode: "S24FLASH",
          productId: "prod-s24-ultra",
          brandId: "brand-samsung",
          clicks: 0,
          validFrom: ts,
          validUntil: new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString(),
          createdAt: ts,
          updatedAt: ts
        },
        {
          id: "deal-apex-eid",
          slug: "apex-eid-deal",
          name: "Apex Eid Special",
          seller: "Apex",
          category: "Fashion",
          status: "pending",
          type: "retail",
          discountType: "flat",
          discountValue: 400,
          promoCode: "APEXFLAT400",
          productId: "prod-apex-loafer",
          brandId: "brand-apex",
          clicks: 0,
          validFrom: ts,
          validUntil: new Date(Date.now() + 6 * 24 * 60 * 60 * 1e3).toISOString(),
          createdAt: ts,
          updatedAt: ts
        }
      ];
    };
    defaultHomepage2 = () => {
      const ts = nowIso12();
      return {
        id: "default",
        heroBanners: [
          {
            id: "hero-main",
            headline: "Bangladesh's Most Trusted Product Discovery Platform",
            subtitle: "Manage this content from admin dashboard CMS.",
            ctaText: "Explore Products",
            ctaUrl: "/products",
            backgroundImage: "",
            isActive: true,
            order: 0
          }
        ],
        dealsBanners: [],
        sections: [
          { id: "featured-products", label: "Featured Products", isVisible: true, order: 0, itemIds: ["prod-s24-ultra", "prod-macbook-air-m3"] },
          { id: "featured-brands", label: "Featured Brands", isVisible: true, order: 1, itemIds: ["brand-samsung", "brand-apple"] },
          { id: "featured-deals", label: "Featured Deals", isVisible: true, order: 2, itemIds: ["deal-s24-flash"] }
        ],
        featuredProductIds: ["prod-s24-ultra", "prod-macbook-air-m3"],
        featuredBrandIds: ["brand-samsung", "brand-apple"],
        featuredDealIds: ["deal-s24-flash"],
        featuredCreatorIds: ["creator-farhan", "creator-sarah"],
        featuredGuideIds: ["guide-top-smartphones-2026", "guide-s24-ultra-review"],
        updatedAt: ts
      };
    };
  }
});

// server/catalogMemoryStore.ts
async function listCollection4(collectionName) {
  return [...collectionMemoryRef2(collectionName)];
}
async function getById3(collectionName, id) {
  const found = collectionMemoryRef2(collectionName).find((item) => item.id === id);
  return found || null;
}
async function upsert3(collectionName, data) {
  const memoryCollection = collectionMemoryRef2(collectionName);
  const existingIdx = memoryCollection.findIndex((item) => item.id === data.id);
  if (existingIdx >= 0) {
    memoryCollection[existingIdx] = { ...memoryCollection[existingIdx], ...data };
  } else {
    memoryCollection.push(data);
  }
  return data;
}
async function remove3(collectionName, id) {
  const memoryCollection = collectionMemoryRef2(collectionName);
  const filtered = memoryCollection.filter((item) => item.id !== id);
  memoryCollection.splice(0, memoryCollection.length, ...filtered);
}
var PRODUCTS_COLLECTION4, CATEGORIES_COLLECTION4, BRANDS_COLLECTION4, DEALS_COLLECTION4, memoryState2, collectionMemoryRef2, catalogStore3;
var init_catalogMemoryStore = __esm({
  "server/catalogMemoryStore.ts"() {
    init_catalogDefaults();
    init_catalogDefaults();
    PRODUCTS_COLLECTION4 = "catalog_products";
    CATEGORIES_COLLECTION4 = "catalog_categories";
    BRANDS_COLLECTION4 = "catalog_brands";
    DEALS_COLLECTION4 = "catalog_deals";
    memoryState2 = {
      products: defaultProducts2(),
      categories: defaultCategories2(),
      brands: defaultBrands2(),
      deals: defaultDeals2(),
      homepage: defaultHomepage2()
    };
    collectionMemoryRef2 = (collectionName) => {
      switch (collectionName) {
        case PRODUCTS_COLLECTION4:
          return memoryState2.products;
        case CATEGORIES_COLLECTION4:
          return memoryState2.categories;
        case BRANDS_COLLECTION4:
          return memoryState2.brands;
        case DEALS_COLLECTION4:
          return memoryState2.deals;
        default:
          return [];
      }
    };
    catalogStore3 = {
      listProducts: () => listCollection4(PRODUCTS_COLLECTION4),
      getProduct: (id) => getById3(PRODUCTS_COLLECTION4, id),
      upsertProduct: (payload) => upsert3(PRODUCTS_COLLECTION4, payload),
      deleteProduct: (id) => remove3(PRODUCTS_COLLECTION4, id),
      listCategories: () => listCollection4(CATEGORIES_COLLECTION4),
      getCategory: (id) => getById3(CATEGORIES_COLLECTION4, id),
      upsertCategory: (payload) => upsert3(CATEGORIES_COLLECTION4, payload),
      deleteCategory: (id) => remove3(CATEGORIES_COLLECTION4, id),
      listBrands: () => listCollection4(BRANDS_COLLECTION4),
      getBrand: (id) => getById3(BRANDS_COLLECTION4, id),
      upsertBrand: (payload) => upsert3(BRANDS_COLLECTION4, payload),
      deleteBrand: (id) => remove3(BRANDS_COLLECTION4, id),
      listDeals: () => listCollection4(DEALS_COLLECTION4),
      getDeal: (id) => getById3(DEALS_COLLECTION4, id),
      upsertDeal: (payload) => upsert3(DEALS_COLLECTION4, payload),
      deleteDeal: (id) => remove3(DEALS_COLLECTION4, id),
      async getHomepage() {
        return memoryState2.homepage;
      },
      async upsertHomepage(homepage) {
        memoryState2.homepage = homepage;
        return homepage;
      }
    };
  }
});

// server/catalogFirestoreAdmin.ts
var catalogFirestoreAdmin_exports2 = {};
__export(catalogFirestoreAdmin_exports2, {
  firestoreAdminStore: () => firestoreAdminStore2
});
var PRODUCTS_COLLECTION5, CATEGORIES_COLLECTION5, BRANDS_COLLECTION5, DEALS_COLLECTION5, HOMEPAGE_DOC2, firestoreAdminStore2;
var init_catalogFirestoreAdmin2 = __esm({
  "server/catalogFirestoreAdmin.ts"() {
    init_queryHelpers();
    PRODUCTS_COLLECTION5 = "catalog_products";
    CATEGORIES_COLLECTION5 = "catalog_categories";
    BRANDS_COLLECTION5 = "catalog_brands";
    DEALS_COLLECTION5 = "catalog_deals";
    HOMEPAGE_DOC2 = { collection: "settings", id: "catalog_homepage" };
    firestoreAdminStore2 = {
      listProducts: () => listCollection(PRODUCTS_COLLECTION5),
      getProduct: (id) => getDocumentById(PRODUCTS_COLLECTION5, id),
      upsertProduct: (payload) => upsertDocument(PRODUCTS_COLLECTION5, payload),
      deleteProduct: (id) => deleteDocument(PRODUCTS_COLLECTION5, id),
      listCategories: () => listCollection(CATEGORIES_COLLECTION5),
      getCategory: (id) => getDocumentById(CATEGORIES_COLLECTION5, id),
      upsertCategory: (payload) => upsertDocument(CATEGORIES_COLLECTION5, payload),
      deleteCategory: (id) => deleteDocument(CATEGORIES_COLLECTION5, id),
      listBrands: () => listCollection(BRANDS_COLLECTION5),
      getBrand: (id) => getDocumentById(BRANDS_COLLECTION5, id),
      upsertBrand: (payload) => upsertDocument(BRANDS_COLLECTION5, payload),
      deleteBrand: (id) => deleteDocument(BRANDS_COLLECTION5, id),
      listDeals: () => listCollection(DEALS_COLLECTION5),
      getDeal: (id) => getDocumentById(DEALS_COLLECTION5, id),
      upsertDeal: (payload) => upsertDocument(DEALS_COLLECTION5, payload),
      deleteDeal: (id) => deleteDocument(DEALS_COLLECTION5, id),
      getHomepage: () => getDocumentById(HOMEPAGE_DOC2.collection, HOMEPAGE_DOC2.id),
      upsertHomepage: (homepage) => upsertDocumentById(HOMEPAGE_DOC2.collection, HOMEPAGE_DOC2.id, homepage),
      hasAnyProducts: () => collectionHasDocuments(PRODUCTS_COLLECTION5, 1)
    };
  }
});

// server/catalogStore.ts
async function getFirestoreModule() {
  if (!firestoreModule) {
    firestoreModule = await import("firebase/firestore");
  }
  return firestoreModule;
}
async function getAdminStore2() {
  if (!adminStorePromise2) {
    adminStorePromise2 = Promise.resolve().then(() => (init_catalogFirestoreAdmin2(), catalogFirestoreAdmin_exports2)).then((mod) => mod.firestoreAdminStore);
  }
  return adminStorePromise2;
}
async function resolveDb() {
  if (memoryMode || useAdminFirestore3) return null;
  if (firestoreDb) return firestoreDb;
  if (firestoreLoadAttempted) return null;
  firestoreLoadAttempted = true;
  try {
    const firebaseModule = await Promise.resolve().then(() => (init_firebase(), firebase_exports));
    firestoreDb = firebaseModule.db;
    return firestoreDb;
  } catch (error2) {
    enableMemoryMode(error2);
    return null;
  }
}
async function listCollection5(collectionName) {
  if (useAdminFirestore3) {
    const admin = await getAdminStore2();
    switch (collectionName) {
      case PRODUCTS_COLLECTION6:
        return admin.listProducts();
      case CATEGORIES_COLLECTION6:
        return admin.listCategories();
      case BRANDS_COLLECTION6:
        return admin.listBrands();
      case DEALS_COLLECTION6:
        return admin.listDeals();
      default:
        return [];
    }
  }
  if (memoryMode) return listFromMemory2(collectionName);
  try {
    const db3 = await resolveDb();
    if (!db3) return listFromMemory2(collectionName);
    const { collection: collection2, getDocs: getDocs2 } = await getFirestoreModule();
    const snapshot = await getDocs2(collection2(db3, collectionName));
    return snapshot.docs.map((item) => item.data());
  } catch (error2) {
    enableMemoryMode(error2);
    return listFromMemory2(collectionName);
  }
}
function listFromMemory2(collectionName) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION6:
      return catalogStore3.listProducts();
    case CATEGORIES_COLLECTION6:
      return catalogStore3.listCategories();
    case BRANDS_COLLECTION6:
      return catalogStore3.listBrands();
    case DEALS_COLLECTION6:
      return catalogStore3.listDeals();
    default:
      return Promise.resolve([]);
  }
}
function getFromMemory2(collectionName, id) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION6:
      return catalogStore3.getProduct(id);
    case CATEGORIES_COLLECTION6:
      return catalogStore3.getCategory(id);
    case BRANDS_COLLECTION6:
      return catalogStore3.getBrand(id);
    case DEALS_COLLECTION6:
      return catalogStore3.getDeal(id);
    default:
      return Promise.resolve(null);
  }
}
function upsertToMemory2(collectionName, data) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION6:
      return catalogStore3.upsertProduct(data);
    case CATEGORIES_COLLECTION6:
      return catalogStore3.upsertCategory(data);
    case BRANDS_COLLECTION6:
      return catalogStore3.upsertBrand(data);
    case DEALS_COLLECTION6:
      return catalogStore3.upsertDeal(data);
    default:
      return Promise.resolve(data);
  }
}
function removeFromMemory2(collectionName, id) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION6:
      return catalogStore3.deleteProduct(id);
    case CATEGORIES_COLLECTION6:
      return catalogStore3.deleteCategory(id);
    case BRANDS_COLLECTION6:
      return catalogStore3.deleteBrand(id);
    case DEALS_COLLECTION6:
      return catalogStore3.deleteDeal(id);
    default:
      return Promise.resolve();
  }
}
async function getById4(collectionName, id) {
  if (useAdminFirestore3) {
    const admin = await getAdminStore2();
    switch (collectionName) {
      case PRODUCTS_COLLECTION6:
        return admin.getProduct(id);
      case CATEGORIES_COLLECTION6:
        return admin.getCategory(id);
      case BRANDS_COLLECTION6:
        return admin.getBrand(id);
      case DEALS_COLLECTION6:
        return admin.getDeal(id);
      default:
        return null;
    }
  }
  if (memoryMode) return getFromMemory2(collectionName, id);
  try {
    const db3 = await resolveDb();
    if (!db3) return getFromMemory2(collectionName, id);
    const { doc: doc3, getDoc: getDoc2 } = await getFirestoreModule();
    const snapshot = await getDoc2(doc3(db3, collectionName, id));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error2) {
    enableMemoryMode(error2);
    return getFromMemory2(collectionName, id);
  }
}
async function upsert4(collectionName, data) {
  if (useAdminFirestore3) {
    const admin = await getAdminStore2();
    switch (collectionName) {
      case PRODUCTS_COLLECTION6:
        return admin.upsertProduct(data);
      case CATEGORIES_COLLECTION6:
        return admin.upsertCategory(data);
      case BRANDS_COLLECTION6:
        return admin.upsertBrand(data);
      case DEALS_COLLECTION6:
        return admin.upsertDeal(data);
      default:
        return data;
    }
  }
  await upsertToMemory2(collectionName, data);
  if (!memoryMode) {
    try {
      const db3 = await resolveDb();
      if (db3) {
        const { doc: doc3, setDoc: setDoc2 } = await getFirestoreModule();
        await setDoc2(doc3(db3, collectionName, data.id), data, { merge: true });
      }
    } catch (error2) {
      enableMemoryMode(error2);
    }
  }
  return data;
}
async function remove4(collectionName, id) {
  if (useAdminFirestore3) {
    const admin = await getAdminStore2();
    switch (collectionName) {
      case PRODUCTS_COLLECTION6:
        return admin.deleteProduct(id);
      case CATEGORIES_COLLECTION6:
        return admin.deleteCategory(id);
      case BRANDS_COLLECTION6:
        return admin.deleteBrand(id);
      case DEALS_COLLECTION6:
        return admin.deleteDeal(id);
      default:
        return;
    }
  }
  await removeFromMemory2(collectionName, id);
  if (!memoryMode) {
    try {
      const db3 = await resolveDb();
      if (db3) {
        const { doc: doc3, deleteDoc } = await getFirestoreModule();
        await deleteDoc(doc3(db3, collectionName, id));
      }
    } catch (error2) {
      enableMemoryMode(error2);
    }
  }
}
var firestoreModule, PRODUCTS_COLLECTION6, CATEGORIES_COLLECTION6, BRANDS_COLLECTION6, DEALS_COLLECTION6, HOMEPAGE_DOC3, useAdminFirestore3, adminStorePromise2, memoryMode, firestoreDb, firestoreLoadAttempted, enableMemoryMode, catalogStore4;
var init_catalogStore = __esm({
  "server/catalogStore.ts"() {
    init_catalogDefaults();
    init_catalogMemoryStore();
    init_firestoreAdmin();
    init_catalogDefaults();
    firestoreModule = null;
    PRODUCTS_COLLECTION6 = "catalog_products";
    CATEGORIES_COLLECTION6 = "catalog_categories";
    BRANDS_COLLECTION6 = "catalog_brands";
    DEALS_COLLECTION6 = "catalog_deals";
    HOMEPAGE_DOC3 = ["settings", "catalog_homepage"];
    useAdminFirestore3 = process.env.CATALOG_USE_FIRESTORE === "true" && hasFirebaseAdminCredentials();
    adminStorePromise2 = null;
    memoryMode = process.env.CATALOG_USE_FIRESTORE !== "true" && !useAdminFirestore3;
    firestoreDb = null;
    firestoreLoadAttempted = false;
    enableMemoryMode = (reason) => {
      if (!memoryMode && !useAdminFirestore3) {
        memoryMode = true;
        console.warn("[Catalog Store] Falling back to in-memory persistence.", reason);
      }
    };
    catalogStore4 = {
      listProducts: () => listCollection5(PRODUCTS_COLLECTION6),
      getProduct: (id) => getById4(PRODUCTS_COLLECTION6, id),
      upsertProduct: (payload) => upsert4(PRODUCTS_COLLECTION6, payload),
      deleteProduct: (id) => remove4(PRODUCTS_COLLECTION6, id),
      listCategories: () => listCollection5(CATEGORIES_COLLECTION6),
      getCategory: (id) => getById4(CATEGORIES_COLLECTION6, id),
      upsertCategory: (payload) => upsert4(CATEGORIES_COLLECTION6, payload),
      deleteCategory: (id) => remove4(CATEGORIES_COLLECTION6, id),
      listBrands: () => listCollection5(BRANDS_COLLECTION6),
      getBrand: (id) => getById4(BRANDS_COLLECTION6, id),
      upsertBrand: (payload) => upsert4(BRANDS_COLLECTION6, payload),
      deleteBrand: (id) => remove4(BRANDS_COLLECTION6, id),
      listDeals: () => listCollection5(DEALS_COLLECTION6),
      getDeal: (id) => getById4(DEALS_COLLECTION6, id),
      upsertDeal: (payload) => upsert4(DEALS_COLLECTION6, payload),
      deleteDeal: (id) => remove4(DEALS_COLLECTION6, id),
      async getHomepage() {
        if (useAdminFirestore3) {
          const admin = await getAdminStore2();
          const homepage = await admin.getHomepage();
          return homepage ?? catalogStore3.getHomepage();
        }
        if (memoryMode) return catalogStore3.getHomepage();
        try {
          const db3 = await resolveDb();
          if (!db3) return catalogStore3.getHomepage();
          const { doc: doc3, getDoc: getDoc2 } = await getFirestoreModule();
          const snapshot = await getDoc2(doc3(db3, ...HOMEPAGE_DOC3));
          if (!snapshot.exists()) return catalogStore3.getHomepage();
          return snapshot.data();
        } catch (error2) {
          enableMemoryMode(error2);
          return catalogStore3.getHomepage();
        }
      },
      async upsertHomepage(homepage) {
        if (useAdminFirestore3) {
          const admin = await getAdminStore2();
          return admin.upsertHomepage(homepage);
        }
        await catalogStore3.upsertHomepage(homepage);
        if (!memoryMode) {
          try {
            const db3 = await resolveDb();
            if (db3) {
              const { doc: doc3, setDoc: setDoc2 } = await getFirestoreModule();
              await setDoc2(doc3(db3, ...HOMEPAGE_DOC3), homepage, { merge: true });
            }
          } catch (error2) {
            enableMemoryMode(error2);
          }
        }
        return homepage;
      }
    };
  }
});

// server/booking/bookingStore.ts
async function resolveBackend2() {
  if (backend2) return backend2;
  const adminDb2 = await getAdminFirestore();
  backend2 = adminDb2 ? "admin" : "memory";
  console.log(`[BookingStore] Using ${backend2} backend`);
  return backend2;
}
async function saveBookingRequest(request) {
  const mode = await resolveBackend2();
  if (mode === "memory") {
    memory2.set(request.id, request);
    return request;
  }
  const db3 = await getAdminFirestore();
  await db3.collection("booking_requests").doc(request.id).set(request, { merge: true });
  return request;
}
async function getBookingRequest(id) {
  const mode = await resolveBackend2();
  if (mode === "memory") {
    return memory2.get(id) ?? null;
  }
  return getDocumentById("booking_requests", id);
}
async function listBookingRequests(filters) {
  const mode = await resolveBackend2();
  let rows;
  if (mode === "memory") {
    rows = [...memory2.values()];
  } else {
    const db3 = await getAdminFirestore();
    const snap = await db3.collection("booking_requests").limit(500).get();
    rows = snap.docs.map((doc3) => doc3.data());
  }
  if (filters?.sellerId) {
    rows = rows.filter((r) => r.sellerId === filters.sellerId);
  }
  if (filters?.buyerId) {
    rows = rows.filter((r) => r.buyerId === filters.buyerId);
  }
  if (filters?.conversationId) {
    rows = rows.filter((r) => r.conversationId === filters.conversationId);
  }
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    rows = rows.filter((r) => statuses.includes(r.status));
  }
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
async function listExpirableBookingRequests() {
  return listBookingRequests({
    status: ["pending", "accepted", "buyer_accepted", "countered"]
  });
}
var memory2, backend2;
var init_bookingStore = __esm({
  "server/booking/bookingStore.ts"() {
    init_firestoreAdmin();
    init_queryHelpers();
    memory2 = /* @__PURE__ */ new Map();
    backend2 = null;
  }
});

// server/booking/bookingService.ts
var bookingService_exports = {};
__export(bookingService_exports, {
  acceptBookingRequest: () => acceptBookingRequest,
  buyerAcceptCounter: () => buyerAcceptCounter,
  buyerDeclineBookingRequest: () => buyerDeclineBookingRequest,
  counterBookingRequest: () => counterBookingRequest,
  createBookingRequest: () => createBookingRequest,
  declineBookingRequest: () => declineBookingRequest,
  markBookingPaid: () => markBookingPaid,
  resolveAutoApprove: () => resolveAutoApprove,
  resolvePartialPaymentSettings: () => resolvePartialPaymentSettings,
  sweepExpiredBookings: () => sweepExpiredBookings
});
function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1e3).toISOString();
}
function makeInvoiceId() {
  return `INV-${Math.floor(1e5 + Math.random() * 9e5)}`;
}
function buildOrderFromRequest(request, ts) {
  const buyerPayBy = hoursFromNow(BOOKING_PAYMENT_WINDOW_HOURS);
  const orderId = `BOOK-${Date.now()}`;
  const invoiceId = makeInvoiceId();
  const order = {
    id: orderId,
    orderId,
    buyerId: request.buyerId,
    isCOD: false,
    isSplit: false,
    overallTotal: request.price,
    subtotal: request.price,
    deliveryTotal: 0,
    subOrders: [
      {
        sellerId: request.sellerId,
        sellerBusinessName: request.sellerName,
        invoiceId,
        deliveryFee: 0,
        items: [
          {
            productId: request.listingId,
            productTitle: request.listingTitle,
            quantity: 1,
            price: request.price,
            productType: request.isService ? "service" : "physical",
            serviceCategory: request.serviceCategory,
            serviceDetails: request.fields
          }
        ]
      }
    ],
    sourceMode: "retail",
    paymentMethod: "credit",
    status: "pending_payment",
    bookingRequestId: request.id,
    paymentDueAt: buyerPayBy,
    createdAt: ts,
    updatedAt: ts
  };
  return { order, buyerPayBy, orderId, invoiceId };
}
async function resolveAutoApprove(sellerId, listingId) {
  const product = await catalogStore4.getProduct(listingId).catch(() => null);
  if (product && typeof product.requiresApproval === "boolean") {
    return product.requiresApproval === false;
  }
  const settings = operationsStore.getSellerBookingSettings(sellerId);
  return Boolean(settings.autoApproveBookingsDefault);
}
async function resolvePartialPaymentSettings(listingId) {
  const platform = operationsStore.getPaymentOptionsConfig();
  if (!platform.partialPaymentEnabled) return { partialPaymentEnabled: false };
  const product = await catalogStore4.getProduct(listingId).catch(() => null);
  if (!product?.partialPaymentEnabled) return { partialPaymentEnabled: false };
  const depositPercent = Math.min(
    Math.max(Number(product.depositPercent || platform.minDepositPercent), platform.minDepositPercent),
    platform.maxDepositPercent
  );
  return { partialPaymentEnabled: true, depositPercent };
}
async function notifyBuyer(buyerId, buyerName, body, orderId) {
  try {
    await submitPlatformMessage({
      buyerId,
      userName: buyerName || buyerId,
      body,
      orderId
    });
  } catch (err) {
    console.warn("[Booking] Buyer notify failed:", err);
  }
}
async function notifySeller(sellerId, sellerName, body, orderId) {
  try {
    await submitPlatformMessage({
      buyerId: sellerId,
      userName: sellerName || sellerId,
      body,
      orderId
    });
  } catch (err) {
    console.warn("[Booking] Seller notify failed:", err);
  }
}
async function createBookingRequest(input) {
  const ts = nowIso13();
  const id = `BOOK-REQ-${Date.now()}`;
  const isService = input.isService ?? true;
  const price = Number(input.price) || 0;
  const base = {
    id,
    kind: "booking_offer",
    version: 1,
    conversationId: input.conversationId || `conv_platform_${input.buyerId}`,
    threadId: input.threadId,
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    listingImage: input.listingImage,
    listingHref: input.listingHref || `/products/${input.listingId}`,
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    buyerId: input.buyerId,
    buyerName: input.buyerName,
    serviceCategory: input.serviceCategory ? normalizeServiceCategory(input.serviceCategory) : void 0,
    isService,
    fields: input.fields || {},
    notes: input.notes,
    price,
    originalPrice: input.originalPrice,
    currency: "BDT",
    status: "pending",
    createdAt: ts,
    updatedAt: ts,
    partialPaymentEnabled: input.partialPaymentEnabled,
    depositPercent: input.depositPercent,
    sellerRespondBy: hoursFromNow(BOOKING_SELLER_RESPONSE_HOURS),
    versions: [
      {
        version: 1,
        price,
        fields: input.fields || {},
        notes: input.notes,
        status: "pending",
        changedAt: ts,
        changedBy: "buyer"
      }
    ]
  };
  if (!input.autoApprove) {
    await saveBookingRequest(base);
    return { request: base, offer: toBookingOfferCard(base) };
  }
  const { order, buyerPayBy, orderId, invoiceId } = buildOrderFromRequest(base, ts);
  operationsStore.createOrder(order);
  scheduleOperationsPersist();
  const accepted = {
    ...base,
    version: 2,
    status: "accepted",
    autoApproved: true,
    buyerPayBy,
    orderId,
    invoiceId,
    updatedAt: ts,
    versions: [
      ...base.versions,
      {
        version: 2,
        price,
        fields: base.fields,
        notes: base.notes,
        status: "accepted",
        changedAt: ts,
        changedBy: "system"
      }
    ]
  };
  await saveBookingRequest(accepted);
  await notifyBuyer(
    accepted.buyerId,
    accepted.buyerName,
    `${accepted.sellerName} has pre-approved instant booking for "${accepted.listingTitle}" \u2014 your request is already accepted. Complete payment within ${BOOKING_PAYMENT_WINDOW_HOURS} hours to confirm (order ${orderId}).`,
    orderId
  );
  return { request: accepted, offer: toBookingOfferCard(accepted), order };
}
async function acceptBookingRequest(id, actor) {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error("Booking request not found");
  if (existing.sellerId !== actor.sellerId) throw new Error("Only the listing seller can accept");
  if (existing.status !== "pending" && existing.status !== "countered") {
    throw new Error(`Cannot accept booking in status ${existing.status}`);
  }
  const ts = nowIso13();
  const { order, buyerPayBy, orderId, invoiceId } = buildOrderFromRequest(existing, ts);
  operationsStore.createOrder(order);
  scheduleOperationsPersist();
  const nextVersion = existing.version + 1;
  const updated = {
    ...existing,
    version: nextVersion,
    status: "accepted",
    buyerPayBy,
    orderId,
    invoiceId,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        notes: existing.notes,
        status: "accepted",
        changedAt: ts,
        changedBy: "seller"
      }
    ]
  };
  await saveBookingRequest(updated);
  await notifyBuyer(
    existing.buyerId,
    existing.buyerName,
    `${actor.sellerName || existing.sellerName} accepted your booking request for "${existing.listingTitle}". Complete payment within ${BOOKING_PAYMENT_WINDOW_HOURS} hours (order ${orderId}).`,
    orderId
  );
  return { request: updated, offer: toBookingOfferCard(updated), order };
}
async function declineBookingRequest(id, actor, declineReason) {
  const reason = String(declineReason || "").trim();
  if (!reason) throw new Error("declineReason is required");
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error("Booking request not found");
  if (existing.sellerId !== actor.sellerId) throw new Error("Only the listing seller can decline");
  if (existing.status !== "pending" && existing.status !== "countered") {
    throw new Error(`Cannot decline booking in status ${existing.status}`);
  }
  const ts = nowIso13();
  const nextVersion = existing.version + 1;
  const updated = {
    ...existing,
    version: nextVersion,
    status: "declined",
    declineReason: reason,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        notes: existing.notes,
        status: "declined",
        changedAt: ts,
        changedBy: "seller",
        declineReason: reason
      }
    ]
  };
  await saveBookingRequest(updated);
  await notifyBuyer(
    existing.buyerId,
    existing.buyerName,
    `${actor.sellerName || existing.sellerName} declined your booking request for "${existing.listingTitle}": ${reason}`
  );
  return { request: updated, offer: toBookingOfferCard(updated) };
}
async function buyerDeclineBookingRequest(id, actor, declineReason) {
  const reason = String(declineReason || "").trim();
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error("Booking request not found");
  if (existing.buyerId !== actor.buyerId) throw new Error("Only the buyer can decline this offer");
  if (existing.status !== "countered" && existing.status !== "accepted") {
    throw new Error(`Cannot buyer-decline booking in status ${existing.status}`);
  }
  const ts = nowIso13();
  const nextVersion = existing.version + 1;
  const updated = {
    ...existing,
    version: nextVersion,
    status: "declined",
    ...reason ? { declineReason: reason } : {},
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        notes: existing.notes,
        status: "declined",
        changedAt: ts,
        changedBy: "buyer",
        ...reason ? { declineReason: reason } : {}
      }
    ]
  };
  await saveBookingRequest(updated);
  await notifySeller(
    existing.sellerId,
    existing.sellerName,
    `${existing.buyerName || "Buyer"} declined the booking offer for "${existing.listingTitle}"${reason ? `: ${reason}` : ""}.`,
    existing.orderId
  );
  return { request: updated, offer: toBookingOfferCard(updated) };
}
async function counterBookingRequest(id, actor, patch) {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error("Booking request not found");
  if (existing.sellerId !== actor.sellerId) throw new Error("Only the listing seller can modify");
  if (existing.status !== "pending" && existing.status !== "countered") {
    throw new Error(`Cannot modify booking in status ${existing.status}`);
  }
  const price = patch.price !== void 0 ? Number(patch.price) : existing.price;
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid counter-offer price");
  const ts = nowIso13();
  const nextVersion = existing.version + 1;
  const buyerRespondBy = hoursFromNow(BOOKING_SELLER_RESPONSE_HOURS);
  const fields = { ...existing.fields, ...patch.fields || {} };
  const updated = {
    ...existing,
    version: nextVersion,
    status: "countered",
    price,
    fields,
    notes: patch.notes !== void 0 ? patch.notes : existing.notes,
    buyerRespondBy,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price,
        fields,
        notes: patch.notes !== void 0 ? patch.notes : existing.notes,
        status: "countered",
        changedAt: ts,
        changedBy: "seller"
      }
    ]
  };
  await saveBookingRequest(updated);
  await notifyBuyer(
    existing.buyerId,
    existing.buyerName,
    `${actor.sellerName || existing.sellerName} sent a counter-offer of BDT ${price.toLocaleString()} for "${existing.listingTitle}". Respond within ${BOOKING_SELLER_RESPONSE_HOURS} hours.`
  );
  return { request: updated, offer: toBookingOfferCard(updated) };
}
async function buyerAcceptCounter(id, actor) {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error("Booking request not found");
  if (existing.buyerId !== actor.buyerId) throw new Error("Only the buyer can accept this offer");
  if (existing.status !== "countered" && existing.status !== "accepted") {
    throw new Error(`Cannot buyer-accept booking in status ${existing.status}`);
  }
  if (existing.status === "accepted" && existing.orderId) {
    const order2 = operationsStore.getOrder(existing.orderId);
    if (order2) {
      const ts2 = nowIso13();
      const nextVersion2 = existing.version + 1;
      const updated2 = {
        ...existing,
        version: nextVersion2,
        status: "buyer_accepted",
        updatedAt: ts2,
        versions: [
          ...existing.versions,
          {
            version: nextVersion2,
            price: existing.price,
            fields: existing.fields,
            status: "buyer_accepted",
            changedAt: ts2,
            changedBy: "buyer"
          }
        ]
      };
      await saveBookingRequest(updated2);
      return { request: updated2, offer: toBookingOfferCard(updated2), order: order2 };
    }
  }
  const ts = nowIso13();
  const { order, buyerPayBy, orderId, invoiceId } = buildOrderFromRequest(existing, ts);
  operationsStore.createOrder(order);
  scheduleOperationsPersist();
  const nextVersion = existing.version + 1;
  const updated = {
    ...existing,
    version: nextVersion,
    status: "buyer_accepted",
    buyerPayBy,
    orderId,
    invoiceId,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        status: "buyer_accepted",
        changedAt: ts,
        changedBy: "buyer"
      }
    ]
  };
  await saveBookingRequest(updated);
  return { request: updated, offer: toBookingOfferCard(updated), order };
}
async function markBookingPaid(id, orderId, paymentType = "full") {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error("Booking request not found");
  if (paymentType === "partial" && !existing.partialPaymentEnabled) {
    throw new Error("This listing does not offer partial payment");
  }
  const ts = nowIso13();
  const resolvedOrderId = orderId || existing.orderId;
  if (resolvedOrderId) {
    if (paymentType === "partial" && existing.depositPercent) {
      const depositAmount = Math.round(existing.price * existing.depositPercent / 100);
      operationsStore.updateOrder(resolvedOrderId, {
        status: "confirmed",
        paidAt: ts,
        invoiceGeneratedAt: ts,
        isPartialPayment: true,
        depositPercent: existing.depositPercent,
        depositAmount,
        remainingAmount: Math.max(0, existing.price - depositAmount)
      });
    } else {
      operationsStore.updateOrder(resolvedOrderId, {
        status: "confirmed",
        paidAt: ts,
        invoiceGeneratedAt: ts
      });
    }
    scheduleOperationsPersist();
  }
  const nextVersion = existing.version + 1;
  const updated = {
    ...existing,
    version: nextVersion,
    status: "paid",
    orderId: resolvedOrderId,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        status: "paid",
        changedAt: ts,
        changedBy: "buyer"
      }
    ]
  };
  await saveBookingRequest(updated);
  return { request: updated, offer: toBookingOfferCard(updated) };
}
async function sweepExpiredBookings(now = Date.now()) {
  const result = {
    sellerResponseExpired: [],
    paymentExpired: [],
    counterExpired: []
  };
  const active = await listExpirableBookingRequests();
  for (const request of active) {
    const ts = new Date(now).toISOString();
    if (request.status === "pending" && new Date(request.sellerRespondBy).getTime() <= now) {
      const nextVersion = request.version + 1;
      const updated = {
        ...request,
        version: nextVersion,
        status: "expired",
        updatedAt: ts,
        versions: [
          ...request.versions,
          {
            version: nextVersion,
            price: request.price,
            fields: request.fields,
            status: "expired",
            changedAt: ts,
            changedBy: "system"
          }
        ]
      };
      await saveBookingRequest(updated);
      await notifyBuyer(
        request.buyerId,
        request.buyerName,
        `Your booking request for "${request.listingTitle}" expired because the seller did not respond within ${BOOKING_SELLER_RESPONSE_HOURS} hours.`
      );
      result.sellerResponseExpired.push(request.id);
      continue;
    }
    if (request.status === "countered" && request.buyerRespondBy && new Date(request.buyerRespondBy).getTime() <= now) {
      const nextVersion = request.version + 1;
      const updated = {
        ...request,
        version: nextVersion,
        status: "expired",
        updatedAt: ts,
        versions: [
          ...request.versions,
          {
            version: nextVersion,
            price: request.price,
            fields: request.fields,
            status: "expired",
            changedAt: ts,
            changedBy: "system"
          }
        ]
      };
      await saveBookingRequest(updated);
      result.counterExpired.push(request.id);
      continue;
    }
    if ((request.status === "accepted" || request.status === "buyer_accepted") && request.buyerPayBy && new Date(request.buyerPayBy).getTime() <= now) {
      const nextVersion = request.version + 1;
      if (request.orderId) {
        operationsStore.updateOrder(request.orderId, { status: "cancelled" });
        scheduleOperationsPersist();
      }
      const updated = {
        ...request,
        version: nextVersion,
        status: "payment_expired",
        updatedAt: ts,
        versions: [
          ...request.versions,
          {
            version: nextVersion,
            price: request.price,
            fields: request.fields,
            status: "payment_expired",
            changedAt: ts,
            changedBy: "system"
          }
        ]
      };
      await saveBookingRequest(updated);
      await notifyBuyer(
        request.buyerId,
        request.buyerName,
        `Payment window expired for "${request.listingTitle}". The pending booking order was cancelled.`,
        request.orderId
      );
      result.paymentExpired.push(request.id);
    }
  }
  return result;
}
var nowIso13;
var init_bookingService = __esm({
  "server/booking/bookingService.ts"() {
    init_bookingFieldConfig();
    init_bookingTypes();
    init_operationsStore();
    init_operationsPersistence();
    init_catalogStore();
    init_bookingStore();
    init_platformMessagingBridge();
    nowIso13 = () => (/* @__PURE__ */ new Date()).toISOString();
  }
});

// server/app.ts
import express from "express";
import dotenv2 from "dotenv";
import compression from "compression";

// server/messagingHub.ts
import { Router } from "express";

// server/messaging/config.ts
function getMessagingMode() {
  const mode = (process.env.MESSAGING_MODE || "mock").toLowerCase();
  return mode === "live" ? "live" : "mock";
}
function getMetaVerifyToken() {
  return process.env.META_VERIFY_TOKEN || "choosify_omni_secure_token_abc123";
}
function getMetaAppSecret() {
  return process.env.META_APP_SECRET?.trim() || void 0;
}
function shouldVerifyWebhookSignature() {
  return Boolean(getMetaAppSecret()) && getMessagingMode() === "live";
}
function getMessagingStatus() {
  const mode = getMessagingMode();
  const hasAppSecret = Boolean(getMetaAppSecret());
  const hasWhatsApp = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()) && Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim());
  const hasMessenger = Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim()) && Boolean(process.env.META_PAGE_ID?.trim());
  const hasInstagram = Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim()) && Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim());
  return {
    mode,
    webhookVerifyTokenConfigured: Boolean(process.env.META_VERIFY_TOKEN?.trim()),
    webhookSignatureVerification: shouldVerifyWebhookSignature(),
    channels: {
      whatsapp: mode === "live" && hasWhatsApp ? "ready" : mode === "mock" ? "simulated" : "pending_credentials",
      messenger: mode === "live" && hasMessenger ? "ready" : mode === "mock" ? "simulated" : "pending_credentials",
      instagram: mode === "live" && hasInstagram ? "ready" : mode === "mock" ? "simulated" : "pending_credentials"
    },
    metaCredentials: {
      appId: Boolean(process.env.META_APP_ID?.trim()),
      appSecret: hasAppSecret,
      pageAccessToken: Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim()),
      whatsappPhoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
      whatsappAccessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim()),
      instagramBusinessAccountId: Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim())
    },
    publicWebhookUrl: process.env.WEBHOOK_PUBLIC_URL || null
  };
}
function extractRecipientId(conversationId, platform) {
  const prefix = `conv_${platform}_`;
  if (conversationId.startsWith(prefix)) {
    return conversationId.slice(prefix.length);
  }
  return "";
}

// server/messaging/adapters/channelAdapter.ts
var ChannelAdapterError = class extends Error {
  constructor(message, platform, statusCode) {
    super(message);
    this.platform = platform;
    this.statusCode = statusCode;
    this.name = "ChannelAdapterError";
  }
};
async function graphPost(url, accessToken, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = payload.error;
    throw new Error(err?.message || `Graph API request failed (${response.status})`);
  }
  return payload;
}
var MockChannelAdapter = class {
  constructor(platform) {
    this.platform = platform;
  }
  async sendMessage(input) {
    console.log(`[MockChannel:${input.platform}] Outbound to ${input.recipientId}:`, input.content.body);
    return {
      platformMessageId: `mid.mock_${input.platform}_${Date.now()}`,
      delivered: false,
      mode: "mock",
      note: "Message saved in Choosify inbox only. Set MESSAGING_MODE=live and Meta credentials to deliver externally."
    };
  }
};
var MetaWhatsAppAdapter = class {
  constructor() {
    this.platform = "whatsapp";
  }
  async sendMessage(input) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    if (!phoneNumberId || !accessToken) {
      throw new ChannelAdapterError("WhatsApp credentials missing", "whatsapp");
    }
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    let body;
    if (input.content.templateName) {
      body = {
        messaging_product: "whatsapp",
        to: input.recipientId,
        type: "template",
        template: {
          name: input.content.templateName,
          language: { code: input.content.templateLanguage || "en" }
        }
      };
    } else if (input.content.type === "image" && input.content.mediaUrl) {
      body = {
        messaging_product: "whatsapp",
        to: input.recipientId,
        type: "image",
        image: { link: input.content.mediaUrl, caption: input.content.body }
      };
    } else {
      body = {
        messaging_product: "whatsapp",
        to: input.recipientId,
        type: "text",
        text: { body: input.content.body }
      };
    }
    const result = await graphPost(url, accessToken, body);
    const messages = result.messages;
    return {
      platformMessageId: messages?.[0]?.id || `mid.wa_${Date.now()}`,
      delivered: true,
      mode: "live"
    };
  }
};
var MetaMessengerAdapter = class {
  constructor() {
    this.platform = "messenger";
  }
  async sendMessage(input) {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
    if (!pageAccessToken) {
      throw new ChannelAdapterError("Messenger page access token missing", "messenger");
    }
    const url = "https://graph.facebook.com/v21.0/me/messages";
    let message;
    if (input.content.type === "image" && input.content.mediaUrl) {
      message = {
        attachment: {
          type: "image",
          payload: { url: input.content.mediaUrl, is_reusable: true }
        }
      };
    } else {
      message = { text: input.content.body };
    }
    const result = await graphPost(url, pageAccessToken, {
      recipient: { id: input.recipientId },
      message,
      messaging_type: "RESPONSE"
    });
    const messageId = result.message_id;
    return {
      platformMessageId: messageId || `mid.me_${Date.now()}`,
      delivered: true,
      mode: "live"
    };
  }
};
var MetaInstagramAdapter = class {
  constructor() {
    this.platform = "instagram";
  }
  async sendMessage(input) {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
    const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
    if (!pageAccessToken || !igUserId) {
      throw new ChannelAdapterError("Instagram credentials missing", "instagram");
    }
    const url = `https://graph.facebook.com/v21.0/${igUserId}/messages`;
    let message;
    if (input.content.type === "image" && input.content.mediaUrl) {
      message = {
        attachment: {
          type: "image",
          payload: { url: input.content.mediaUrl }
        }
      };
    } else {
      message = { text: input.content.body };
    }
    const result = await graphPost(url, pageAccessToken, {
      recipient: { id: input.recipientId },
      message
    });
    const messageId = result.message_id;
    return {
      platformMessageId: messageId || `mid.ig_${Date.now()}`,
      delivered: true,
      mode: "live"
    };
  }
};

// server/messaging/adapters/index.ts
var mockAdapters = {};
var liveAdapters = {};
function getMockAdapter(platform) {
  if (!mockAdapters[platform]) {
    mockAdapters[platform] = new MockChannelAdapter(platform);
  }
  return mockAdapters[platform];
}
function getLiveAdapter(platform) {
  if (platform === "platform") return null;
  if (!liveAdapters[platform]) {
    if (platform === "whatsapp") liveAdapters[platform] = new MetaWhatsAppAdapter();
    if (platform === "messenger") liveAdapters[platform] = new MetaMessengerAdapter();
    if (platform === "instagram") liveAdapters[platform] = new MetaInstagramAdapter();
  }
  return liveAdapters[platform] ?? null;
}
function getChannelAdapter(platform) {
  if (platform === "platform") {
    return getMockAdapter(platform);
  }
  if (getMessagingMode() === "live") {
    const live = getLiveAdapter(platform);
    if (live) return live;
  }
  return getMockAdapter(platform);
}

// server/messaging/normalizeWebhook.ts
function normalizeMetaWebhookPayload(webhookData) {
  const { object, entry } = webhookData;
  if (!object || !Array.isArray(entry) || entry.length === 0) {
    return null;
  }
  if (object === "whatsapp_business_account") {
    const changes = entry[0]?.changes?.[0]?.value;
    const messages = changes?.messages;
    if (!messages?.length) return null;
    const msg = messages[0];
    const senderId = String(msg.from ?? "");
    const contacts = changes?.contacts;
    const senderName = contacts?.[0]?.profile?.name || `WA User (${senderId})`;
    const platformMessageId = String(msg.id ?? "");
    if (msg.type === "text") {
      const text = msg.text;
      return {
        platform: "whatsapp",
        platformMessageId,
        senderId,
        senderName,
        bodyContent: text.body || "",
        type: "text"
      };
    }
    if (msg.type === "image") {
      const image = msg.image;
      return {
        platform: "whatsapp",
        platformMessageId,
        senderId,
        senderName,
        bodyContent: "[Image Attachment]",
        type: "image",
        mediaUrl: image.url || "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=400"
      };
    }
    return {
      platform: "whatsapp",
      platformMessageId,
      senderId,
      senderName,
      bodyContent: `[${String(msg.type)} File Attachment]`,
      type: "file"
    };
  }
  if (object === "page" || object === "instagram") {
    const platform = object === "page" ? "messenger" : "instagram";
    const messaging = entry[0]?.messaging?.[0];
    if (!messaging?.message) return null;
    const msg = messaging.message;
    const senderId = String(messaging.sender?.id ?? "");
    const senderName = platform === "messenger" ? `Messenger Contributor (${senderId.substring(0, 5)})` : `IG Fan (${senderId.substring(0, 5)})`;
    const platformMessageId = String(msg.mid ?? "");
    if (msg.text) {
      return {
        platform,
        platformMessageId,
        senderId,
        senderName,
        bodyContent: String(msg.text),
        type: "text"
      };
    }
    const attachments = msg.attachments;
    if (attachments?.[0]) {
      const att = attachments[0];
      if (att.type === "image") {
        return {
          platform,
          platformMessageId,
          senderId,
          senderName,
          bodyContent: platform === "messenger" ? "[Messenger Photo]" : "[Instagram Photo]",
          type: "image",
          mediaUrl: att.payload?.url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400"
        };
      }
    }
    return {
      platform,
      platformMessageId,
      senderId,
      senderName,
      bodyContent: "[Attachment Document]",
      type: "file"
    };
  }
  return null;
}
function buildInboundMessage(normalized, conversation) {
  const conversationId = `conv_${normalized.platform}_${normalized.senderId}`;
  const messageId = `m_in_${Date.now()}`;
  const message = {
    id: messageId,
    platform: normalized.platform,
    platformMessageId: normalized.platformMessageId,
    conversationId,
    senderId: normalized.senderId,
    senderName: normalized.senderName,
    senderAvatar: normalized.senderName[0],
    content: {
      type: normalized.type,
      body: normalized.bodyContent,
      mediaUrl: normalized.mediaUrl
    },
    direction: "inbound",
    status: "delivered",
    assignedAgent: conversation.assignedAgent || "agent_farhan",
    conversationStatus: conversation.status || "open",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  const updatedConversation = {
    conversationId,
    platform: normalized.platform,
    senderName: normalized.senderName,
    senderAvatar: normalized.senderName[0],
    lastMessage: normalized.bodyContent,
    assignedAgent: conversation.assignedAgent || "agent_farhan",
    status: conversation.status || "open",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return { message, conversation: updatedConversation };
}

// server/messagingHub.ts
init_omniStore();

// server/messaging/omniStaff.ts
init_firestoreAdmin();
async function upsertOmniStaff(uid, meta) {
  if (!uid) return;
  const db3 = await getAdminFirestore();
  if (!db3) return;
  await db3.collection("omni_staff").doc(uid).set(
    {
      uid,
      email: meta?.email || null,
      role: meta?.role || null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  );
}

// server/messaging/seedData.ts
init_omniStore();

// server/messaging/webhookJobs.ts
init_firestoreAdmin();
var COLLECTION = "webhook_jobs";
var MAX_ATTEMPTS = 3;
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
async function enqueueMetaWebhookJob(payload, process2) {
  const db3 = await getAdminFirestore();
  if (!db3) {
    await process2(payload);
    return "memory";
  }
  const ref = db3.collection(COLLECTION).doc();
  const record = {
    type: "process-meta-webhook",
    status: "pending",
    payload,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    attempts: 0
  };
  await ref.set(record);
  await processWebhookJobById(ref.id, process2);
  return ref.id;
}
async function processWebhookJobById(jobId, process2) {
  const db3 = await getAdminFirestore();
  if (!db3 || jobId === "memory") return;
  const ref = db3.collection(COLLECTION).doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data();
  if (data.status === "done") return;
  await ref.set(
    {
      status: "processing",
      updatedAt: nowIso(),
      attempts: (data.attempts || 0) + 1
    },
    { merge: true }
  );
  try {
    await process2(data.payload || {});
    await ref.set(
      {
        status: "done",
        updatedAt: nowIso(),
        error: null
      },
      { merge: true }
    );
  } catch (err) {
    const attempts = (data.attempts || 0) + 1;
    const message = err instanceof Error ? err.message : String(err);
    const failed = attempts >= MAX_ATTEMPTS;
    await ref.set(
      {
        status: failed ? "failed" : "pending",
        updatedAt: nowIso(),
        error: message,
        attempts
      },
      { merge: true }
    );
    if (!failed) {
      throw err;
    }
    console.error(`[webhook_jobs] Job ${jobId} failed after ${attempts} attempts:`, message);
  }
}

// server/messaging/webhookVerify.ts
import crypto from "crypto";
function verifyMetaWebhookSignature(rawBody, signatureHeader) {
  if (!shouldVerifyWebhookSignature()) {
    return true;
  }
  const appSecret = getMetaAppSecret();
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const expected = crypto.createHmac("sha256", appSecret).update(typeof rawBody === "string" ? rawBody : rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

// server/lib/abuseProtection.ts
var failedAuthAttempts = /* @__PURE__ */ new Map();
var suspiciousRequestCounts = /* @__PURE__ */ new Map();
var DEFAULT_WINDOW_MS = 15 * 60 * 1e3;
var DEFAULT_FAILED_AUTH_THRESHOLD = 20;
var DEFAULT_SUSPICIOUS_THRESHOLD = 200;
function getClientKey(ip, path) {
  return `${ip || "unknown"}:${path}`;
}
function pruneRecord(record, windowMs, now) {
  if (now - record.firstSeenAt > windowMs) {
    return null;
  }
  return record;
}
function increment(store, key, windowMs) {
  const now = Date.now();
  const existing = store.get(key);
  const current = existing ? pruneRecord(existing, windowMs, now) : null;
  const next = current ? { ...current, count: current.count + 1, lastSeenAt: now } : { count: 1, firstSeenAt: now, lastSeenAt: now };
  store.set(key, next);
  return next;
}
function recordFailedAuthAttempt(ip, path) {
  const windowMs = Number(process.env.ABUSE_FAILED_AUTH_WINDOW_MS || DEFAULT_WINDOW_MS);
  const threshold = Number(process.env.ABUSE_FAILED_AUTH_THRESHOLD || DEFAULT_FAILED_AUTH_THRESHOLD);
  const record = increment(failedAuthAttempts, getClientKey(ip, path), windowMs);
  return {
    count: record.count,
    thresholdExceeded: record.count >= threshold
  };
}
function recordSuspiciousRequest(ip, path) {
  const windowMs = Number(process.env.ABUSE_SUSPICIOUS_WINDOW_MS || DEFAULT_WINDOW_MS);
  const threshold = Number(process.env.ABUSE_SUSPICIOUS_THRESHOLD || DEFAULT_SUSPICIOUS_THRESHOLD);
  const record = increment(suspiciousRequestCounts, getClientKey(ip, path), windowMs);
  return {
    count: record.count,
    thresholdExceeded: record.count >= threshold
  };
}
var DEFAULT_CLAIM_CONFIRM_THRESHOLD = 20;
function recordClaimConfirmAttempt(ip, token) {
  const windowMs = Number(process.env.ABUSE_CLAIM_CONFIRM_WINDOW_MS || DEFAULT_WINDOW_MS);
  const threshold = Number(process.env.ABUSE_CLAIM_CONFIRM_THRESHOLD || DEFAULT_CLAIM_CONFIRM_THRESHOLD);
  const safeToken = (token || "unknown").slice(0, 64);
  const record = increment(
    suspiciousRequestCounts,
    getClientKey(ip, `order-claim-confirm:${safeToken}`),
    windowMs
  );
  return {
    count: record.count,
    thresholdExceeded: record.count >= threshold
  };
}
function getAbuseProtectionSnapshot() {
  return {
    failedAuthAttempts: failedAuthAttempts.size,
    suspiciousRequestCounts: suspiciousRequestCounts.size
  };
}

// server/lib/sanitizeLog.ts
var SENSITIVE_KEY_PATTERN = /(authorization|password|token|secret|api[_-]?key|bearer|cookie|firebase|credential|private[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token)/i;
var BEARER_PATTERN = /^Bearer\s+.+/i;
function maskValue(value) {
  if (typeof value === "string") {
    if (BEARER_PATTERN.test(value)) return "[REDACTED_BEARER_TOKEN]";
    if (value.length > 256) return `[REDACTED_STRING length=${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }
  if (value && typeof value === "object") {
    return sanitizeLogMeta(value);
  }
  return value;
}
function sanitizeLogValue(value) {
  return maskValue(value);
}
function sanitizeLogMeta(meta) {
  if (!meta) return meta;
  const sanitized = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    if (key === "payload" || key === "body" || key === "headers") {
      sanitized[key] = sanitizeLogMeta(value) ?? "[REDACTED_OBJECT]";
      continue;
    }
    if (key === "data" && typeof value === "string" && value.length > 256) {
      sanitized[key] = `[REDACTED_BASE64 length=${value.length}]`;
      continue;
    }
    sanitized[key] = maskValue(value);
  }
  return sanitized;
}

// server/lib/logger.ts
function formatLog(level, message, meta) {
  const safeMeta = sanitizeLogMeta(meta);
  return JSON.stringify({
    level,
    message,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: process.env.NODE_ENV || "development",
    app: process.env.APP_NAME || "choosify-admin",
    version: process.env.APP_VERSION || process.env.npm_package_version || "0.0.0",
    ...safeMeta
  });
}
function write(level, message, meta) {
  const line = formatLog(level, message, meta);
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  if (level === "WARN" || level === "SECURITY") {
    console.warn(line);
    return;
  }
  if (level === "DEBUG" && process.env.NODE_ENV === "production") {
    return;
  }
  console.log(line);
}
var Logger = {
  info(message, meta) {
    write("INFO", message, meta);
  },
  warn(message, meta) {
    write("WARN", message, meta);
  },
  error(message, meta) {
    write("ERROR", message, meta);
  },
  security(message, meta) {
    write("SECURITY", message, meta);
  },
  audit(message, meta) {
    write("AUDIT", message, meta);
  },
  debug(message, meta) {
    write("DEBUG", message, meta);
  }
};

// server/lib/runtimeInfo.ts
import os from "os";
function getAppVersion() {
  return process.env.APP_VERSION || process.env.npm_package_version || "0.0.0";
}
function getAppName() {
  return process.env.APP_NAME || "choosify-admin";
}
function getEnvironment() {
  return process.env.NODE_ENV || "development";
}
function getNodeVersion() {
  return process.version;
}
function getMemoryUsageSummary() {
  const memory3 = process.memoryUsage();
  return {
    rssBytes: memory3.rss,
    heapTotalBytes: memory3.heapTotal,
    heapUsedBytes: memory3.heapUsed,
    externalBytes: memory3.external,
    arrayBuffersBytes: memory3.arrayBuffers
  };
}
function getCpuUsageSummary() {
  const usage = process.cpuUsage();
  return {
    userMicros: usage.user,
    systemMicros: usage.system
  };
}
function getSystemSummary() {
  return {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    loadAverage: os.loadavg(),
    freeMemoryBytes: os.freemem(),
    totalMemoryBytes: os.totalmem()
  };
}

// server/logging/operationalEvents.ts
var operationalEvents = {
  applicationStarted(context) {
    Logger.info("Application started", {
      event: "application_started",
      app: getAppName(),
      version: getAppVersion(),
      environment: getEnvironment(),
      nodeVersion: getNodeVersion(),
      port: context.port,
      allowedOrigins: context.allowedOrigins,
      loadedModules: context.loadedModules,
      warnings: context.warnings?.length ? context.warnings : void 0
    });
  },
  applicationShutdown(context) {
    Logger.info("Application shutdown", {
      event: "application_shutdown",
      signal: context.signal,
      uptimeSeconds: Math.floor(process.uptime())
    });
  },
  configurationWarning(message, metadata) {
    Logger.warn("Configuration warning", {
      event: "configuration_warning",
      message,
      ...metadata
    });
  },
  securityWarning(message, metadata) {
    Logger.security("Security warning", {
      event: "security_warning",
      message,
      ...metadata
    });
  },
  validationFailure(context) {
    Logger.warn("Validation failure", {
      event: "validation_failure",
      ...context
    });
  },
  authenticationFailure(context) {
    Logger.security("Authentication failure", {
      event: "authentication_failure",
      ...context
    });
  }
};

// server/auth/authErrors.ts
var AUTH_ERROR_CODES = {
  MISSING_TOKEN: "AUTH_MISSING_TOKEN",
  INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  EXPIRED_TOKEN: "AUTH_EXPIRED_TOKEN",
  UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  FORBIDDEN: "AUTH_FORBIDDEN"
};
function sendAuthError(res, status, code, message) {
  const requestId = res.locals.requestId;
  const body = {
    success: false,
    error: message,
    code,
    ...requestId ? { requestId } : {}
  };
  return res.status(status).json(body);
}
function isExpiredFirebaseTokenError(error2) {
  if (!error2 || typeof error2 !== "object") return false;
  const candidate = error2;
  return candidate.name === "TokenExpiredError" || candidate.code === "auth/id-token-expired" || typeof candidate.message === "string" && candidate.message.toLowerCase().includes("expired");
}

// server/permissions/roles.ts
var ROLES = {
  USER: "user",
  SELLER: "seller",
  VERIFIED_SELLER: "verified_seller",
  MODERATOR: "moderator",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  CREATOR: "creator",
  FINANCE_MANAGER: "finance_manager",
  SUPPORT_AGENT: "support_agent",
  MARKETING_MANAGER: "marketing_manager"
};
var ROLE_VALUES = Object.values(ROLES);
var ROLE_LABELS = {
  [ROLES.USER]: "User",
  [ROLES.SELLER]: "Seller",
  [ROLES.VERIFIED_SELLER]: "Verified Seller",
  [ROLES.MODERATOR]: "Moderator",
  [ROLES.ADMIN]: "Admin",
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.CREATOR]: "Creator",
  [ROLES.FINANCE_MANAGER]: "Finance Manager",
  [ROLES.SUPPORT_AGENT]: "Support Agent",
  [ROLES.MARKETING_MANAGER]: "Marketing Manager"
};
var ROLE_INHERITANCE = {
  [ROLES.USER]: [ROLES.USER],
  [ROLES.SELLER]: [ROLES.SELLER, ROLES.USER],
  [ROLES.VERIFIED_SELLER]: [ROLES.VERIFIED_SELLER, ROLES.SELLER, ROLES.USER],
  [ROLES.MODERATOR]: [ROLES.MODERATOR, ROLES.USER],
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.MODERATOR, ROLES.USER],
  [ROLES.SUPER_ADMIN]: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.MODERATOR,
    ROLES.VERIFIED_SELLER,
    ROLES.SELLER,
    ROLES.CREATOR,
    ROLES.FINANCE_MANAGER,
    ROLES.SUPPORT_AGENT,
    ROLES.MARKETING_MANAGER,
    ROLES.USER
  ],
  [ROLES.CREATOR]: [ROLES.CREATOR, ROLES.USER],
  [ROLES.FINANCE_MANAGER]: [ROLES.FINANCE_MANAGER, ROLES.USER],
  [ROLES.SUPPORT_AGENT]: [ROLES.SUPPORT_AGENT, ROLES.USER],
  [ROLES.MARKETING_MANAGER]: [ROLES.MARKETING_MANAGER, ROLES.USER]
};
function isUserRole(value) {
  return typeof value === "string" && ROLE_VALUES.includes(value);
}
function toUserRole(value, fallback = ROLES.USER) {
  return isUserRole(value) ? value : fallback;
}

// server/permissions/permissions.ts
var PERMISSIONS = {
  PRODUCT_READ: "product:read",
  PRODUCT_CREATE: "product:create",
  PRODUCT_EDIT: "product:edit",
  PRODUCT_DELETE: "product:delete",
  SELLER_APPROVE: "seller:approve",
  SELLER_SUSPEND: "seller:suspend",
  USER_MANAGE: "user:manage",
  CMS_EDIT: "cms:edit",
  ANALYTICS_VIEW: "analytics:view",
  ROLE_MANAGE: "role:manage"
};
var PERMISSION_VALUES = Object.values(PERMISSIONS);
var ROLE_PERMISSIONS = {
  [ROLES.USER]: [PERMISSIONS.PRODUCT_READ],
  [ROLES.SELLER]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.ANALYTICS_VIEW
  ],
  [ROLES.VERIFIED_SELLER]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.ANALYTICS_VIEW
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.SELLER_APPROVE,
    PERMISSIONS.CMS_EDIT,
    PERMISSIONS.ANALYTICS_VIEW
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.SELLER_APPROVE,
    PERMISSIONS.SELLER_SUSPEND,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.CMS_EDIT,
    PERMISSIONS.ANALYTICS_VIEW
  ],
  [ROLES.SUPER_ADMIN]: PERMISSION_VALUES,
  [ROLES.CREATOR]: [PERMISSIONS.PRODUCT_READ, PERMISSIONS.ANALYTICS_VIEW],
  [ROLES.FINANCE_MANAGER]: [PERMISSIONS.ANALYTICS_VIEW],
  [ROLES.SUPPORT_AGENT]: [PERMISSIONS.PRODUCT_READ, PERMISSIONS.ANALYTICS_VIEW],
  [ROLES.MARKETING_MANAGER]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.CMS_EDIT,
    PERMISSIONS.ANALYTICS_VIEW
  ]
};

// server/permissions/authorization.ts
function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}
function hasRole(userRole, requiredRole) {
  if (!userRole) return false;
  return ROLE_INHERITANCE[userRole]?.includes(requiredRole) ?? false;
}
function hasPermission(userRole, permission, permissions = userRole ? getPermissionsForRole(userRole) : []) {
  if (!userRole) return false;
  return permissions.includes(permission);
}
function hasAnyPermission(userRole, requiredPermissions, permissions = userRole ? getPermissionsForRole(userRole) : []) {
  if (!userRole) return false;
  return requiredPermissions.some((permission) => permissions.includes(permission));
}

// server/auth/authProfile.ts
init_operationsDb();

// server/auth/jwtTokens.ts
init_client();
init_schema();
import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { and, eq as eq2, gt, isNull } from "drizzle-orm";
var ACCESS_TTL = "15m";
var REFRESH_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
var REFRESH_COOKIE = "choosify_refresh";
function requireAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set. Add it to .env and Vercel env vars.");
  }
  return secret;
}
function hashRefreshToken(raw) {
  const pepper = process.env.JWT_REFRESH_SECRET?.trim() || "";
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}
function signAccessToken(user) {
  const claims = {
    uid: user.id,
    email: user.email,
    emailVerified: user.emailVerified
  };
  return jwt.sign(claims, requireAccessSecret(), {
    expiresIn: ACCESS_TTL,
    subject: user.id
  });
}
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, requireAccessSecret());
    const uid = decoded.uid || decoded.sub;
    if (!uid || typeof uid !== "string") return null;
    return {
      uid,
      email: typeof decoded.email === "string" ? decoded.email : void 0,
      emailVerified: Boolean(decoded.emailVerified)
    };
  } catch (error2) {
    if (isExpiredJwtError(error2)) throw error2;
    return null;
  }
}
function isExpiredJwtError(error2) {
  return typeof error2 === "object" && error2 !== null && "name" in error2 && error2.name === "TokenExpiredError";
}
async function issueRefreshToken(userId) {
  const raw = randomBytes(32).toString("base64url");
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt
  });
  return raw;
}
function setRefreshTokenCookie(res, rawToken) {
  const secure = process.env.NODE_ENV === "production";
  res.cookie(REFRESH_COOKIE, rawToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TTL_MS
  });
}
function clearRefreshTokenCookie(res) {
  const secure = process.env.NODE_ENV === "production";
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/"
  });
}
function readRefreshTokenCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === REFRESH_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}
async function rotateRefreshToken(rawToken) {
  const tokenHash = hashRefreshToken(rawToken);
  const rows = await db.select().from(refreshTokens).where(
    and(
      eq2(refreshTokens.tokenHash, tokenHash),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, /* @__PURE__ */ new Date())
    )
  ).limit(1);
  const row = rows[0];
  if (!row) return null;
  await db.update(refreshTokens).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq2(refreshTokens.id, row.id));
  const userRows = await db.select().from(users).where(eq2(users.id, row.userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified
  });
  const refreshToken = await issueRefreshToken(user.id);
  return { userId: user.id, accessToken, refreshToken };
}
async function revokeRefreshToken(rawToken) {
  const tokenHash = hashRefreshToken(rawToken);
  await db.update(refreshTokens).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and(eq2(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}
async function hashPassword(password) {
  return argon2.hash(password);
}
async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// server/auth/authProfile.ts
var DEV_ROLE_MAP = {
  "admin@choosify.com.bd": ROLES.SUPER_ADMIN,
  "finance@choosify.com.bd": ROLES.FINANCE_MANAGER,
  "support@choosify.com.bd": ROLES.SUPPORT_AGENT,
  "marketing@choosify.com.bd": ROLES.MARKETING_MANAGER,
  "moderator@choosify.com.bd": ROLES.MODERATOR,
  "seller@choosify.com.bd": ROLES.SELLER,
  "creator@choosify.com.bd": ROLES.CREATOR
};
function getBearerToken(authorizationHeader) {
  const header = authorizationHeader || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
async function verifyFirebaseToken(token) {
  return verifyAccessToken(token);
}
async function resolveAuthenticatedUser(decoded) {
  const profile = await loadAdminUser(decoded.uid) || (decoded.email ? await loadAdminUserByEmail(decoded.email) : null);
  const role = profile?.role ? toUserRole(profile.role) : decoded.email ? DEV_ROLE_MAP[decoded.email.toLowerCase()] : void 0;
  if (!role) {
    return {
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.email,
      role: ROLES.USER,
      permissions: getPermissionsForRole(ROLES.USER),
      emailVerified: decoded.emailVerified
    };
  }
  return {
    uid: decoded.uid,
    email: profile?.email || decoded.email,
    displayName: profile?.displayName || decoded.email,
    role,
    permissions: getPermissionsForRole(role),
    emailVerified: decoded.emailVerified
  };
}
async function resolveAuthenticatedUserFromToken(token) {
  const decoded = verifyAccessToken(token);
  if (!decoded) return null;
  return resolveAuthenticatedUser(decoded);
}

// server/middleware/auth.ts
async function authenticateRequest(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    recordFailedAuthAttempt(req.ip, req.originalUrl);
    sendAuthError(res, 401, AUTH_ERROR_CODES.MISSING_TOKEN, "Missing bearer token");
    return;
  }
  try {
    const decoded = await verifyFirebaseToken(token);
    if (!decoded) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_TOKEN, "Invalid token");
      return;
    }
    const user = await resolveAuthenticatedUser(decoded);
    if (!user) {
      sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, "User is not authorized.");
      return;
    }
    req.user = user;
    req.userId = user.uid;
    req.userRole = user.role;
    req.permissions = user.permissions;
    next();
  } catch (error2) {
    const expired = isExpiredFirebaseTokenError(error2) || isExpiredJwtError(error2);
    const reason = expired ? AUTH_ERROR_CODES.EXPIRED_TOKEN : AUTH_ERROR_CODES.INVALID_TOKEN;
    operationalEvents.authenticationFailure({
      requestId: req.requestId,
      path: req.originalUrl,
      message: error2 instanceof Error ? error2.message : String(error2),
      metadata: { reason }
    });
    sendAuthError(
      res,
      401,
      reason,
      expired ? "Expired token" : "Invalid token"
    );
    const abuse = recordFailedAuthAttempt(req.ip, req.originalUrl);
    if (abuse.thresholdExceeded) {
      operationalEvents.securityWarning("Excessive failed authentication attempts", {
        requestId: req.requestId,
        path: req.originalUrl,
        count: abuse.count
      });
    }
  }
}

// server/lib/apiErrorCodes.ts
var API_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_PHONE: "INVALID_PHONE",
  INVALID_PRICE: "INVALID_PRICE",
  INVALID_SLUG: "INVALID_SLUG",
  INVALID_QUERY: "INVALID_QUERY",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  SERVER_ERROR: "SERVER_ERROR",
  CONFLICT: "CONFLICT",
  BAD_REQUEST: "BAD_REQUEST"
};

// server/lib/apiResponse.ts
function attachRequestId(res, body) {
  const requestId = res.locals.requestId || void 0;
  if (!requestId) return body;
  return { ...body, requestId };
}
function success(res, data, status = 200) {
  return res.status(status).json(
    attachRequestId(res, {
      success: true,
      data
    })
  );
}
function created(res, data) {
  return success(res, data, 201);
}
function error(res, message, status = 500, details, code) {
  const body = attachRequestId(res, {
    success: false,
    error: message,
    ...code ? { code } : {},
    ...details !== void 0 ? { details } : {}
  });
  return res.status(status).json(body);
}
function validationError(res, message, details, code = API_ERROR_CODES.VALIDATION_ERROR) {
  return error(res, message, 400, details, code);
}

// server/validation/shared/formatZodError.ts
function formatZodIssues(error2) {
  return error2.issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message,
    code: issue.code
  }));
}
function resolveValidationErrorCode(issues) {
  const joined = issues.map((issue) => `${issue.path}:${issue.message}`).join(" ").toLowerCase();
  if (joined.includes("email")) return API_ERROR_CODES.INVALID_EMAIL;
  if (joined.includes("phone")) return API_ERROR_CODES.INVALID_PHONE;
  if (joined.includes("price")) return API_ERROR_CODES.INVALID_PRICE;
  if (joined.includes("slug")) return API_ERROR_CODES.INVALID_SLUG;
  if (issues.some((issue) => issue.path.startsWith("query") || issue.path === "q")) {
    return API_ERROR_CODES.INVALID_QUERY;
  }
  if (issues.some((issue) => issue.path.length > 0 && issue.path !== "root")) {
    return API_ERROR_CODES.INVALID_PARAMETER;
  }
  return API_ERROR_CODES.VALIDATION_ERROR;
}

// server/middleware/validate.ts
function rejectValidation(res, message, issues, code) {
  validationError(res, message, issues, code);
}
function validate(schemas) {
  return (req, res, next) => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        rejectValidation(
          res,
          "Invalid request parameters",
          issues,
          resolveValidationErrorCode(issues)
        );
        return;
      }
      req.params = result.data;
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        rejectValidation(
          res,
          "Invalid query parameters",
          issues,
          resolveValidationErrorCode(issues)
        );
        return;
      }
      req.query = result.data;
    }
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        rejectValidation(
          res,
          "Invalid request body",
          issues,
          resolveValidationErrorCode(issues)
        );
        return;
      }
      req.body = result.data;
    }
    next();
  };
}

// server/validation/messaging/sendMessageSchema.ts
import { z } from "zod";
var SendMessageBodySchema = z.object({
  conversationId: z.string().trim().min(1, "conversationId is required"),
  content: z.object({
    body: z.string().trim().min(1, "content.body is required"),
    type: z.string().trim().optional(),
    mediaUrl: z.string().trim().optional()
  }),
  senderId: z.string().trim().optional(),
  senderName: z.string().trim().optional(),
  templateName: z.string().trim().optional(),
  templateLanguage: z.string().trim().optional()
});

// server/messagingHub.ts
var messagingRouter = Router();
var MESSAGING_LISTENER_ROLES = /* @__PURE__ */ new Set([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MODERATOR,
  ROLES.SUPPORT_AGENT,
  ROLES.FINANCE_MANAGER,
  ROLES.MARKETING_MANAGER
]);
async function handleNormalizedMetaMessage(webhookData) {
  const normalized = normalizeMetaWebhookPayload(webhookData);
  if (!normalized) return;
  if (await messageExistsByPlatformId(normalized.platformMessageId)) {
    console.log(`[Deduplication] Message ${normalized.platformMessageId} already processed.`);
    return;
  }
  const conversationId = `conv_${normalized.platform}_${normalized.senderId}`;
  const existing = await getConversation(conversationId);
  const { message, conversation } = buildInboundMessage(normalized, {
    assignedAgent: existing?.assignedAgent || "agent_farhan",
    status: existing?.status || "open"
  });
  await saveMessage(message);
  await saveConversation(conversation);
}
messagingRouter.get("/messaging/status", (_req, res) => {
  return res.status(200).json(getMessagingStatus());
});
messagingRouter.post(
  "/messaging/register-listener",
  authenticateRequest,
  async (req, res) => {
    try {
      const role = req.userRole;
      if (!role || !MESSAGING_LISTENER_ROLES.has(role)) {
        return res.status(403).json({ error: "Messaging listener registration requires staff role." });
      }
      const uid = req.userId || req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Missing authenticated user." });
      }
      await upsertOmniStaff(uid, { email: req.user?.email, role });
      return res.status(200).json({ status: "ok", uid });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ error: message });
    }
  }
);
messagingRouter.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === getMetaVerifyToken()) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});
async function handleMetaWebhookPost(req, res) {
  const rawBody = req.body;
  const signature = req.headers["x-hub-signature-256"];
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn("[Webhook] Invalid Meta signature");
    return res.sendStatus(403);
  }
  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  if (!body.object) {
    return res.status(400).json({ error: "Invalid meta webhook payload structure" });
  }
  void enqueueMetaWebhookJob(body, handleNormalizedMetaMessage).catch((err) => {
    console.error("[webhook_jobs] Failed to enqueue/process Meta webhook:", err);
  });
  return res.status(200).json({ status: "EVENT_RECEIVED", object: body.object });
}
messagingRouter.get("/conversations", async (_req, res) => {
  try {
    return res.status(200).json(await listConversations());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});
messagingRouter.get("/conversations/:id", async (req, res) => {
  try {
    const conversation = await getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation thread not found." });
    }
    return res.status(200).json(conversation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});
messagingRouter.get("/messages/:conversationId", async (req, res) => {
  try {
    return res.status(200).json(await listMessages(req.params.conversationId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});
messagingRouter.post(
  "/messages/send",
  validate({ body: SendMessageBodySchema }),
  async (req, res) => {
    try {
      const { conversationId, content, senderId, senderName, templateName, templateLanguage } = req.body;
      const conv = await getConversation(conversationId);
      if (!conv) {
        return res.status(404).json({ error: "Active context thread not found" });
      }
      let whatsappRuleViolation = false;
      if (conv.platform === "whatsapp") {
        const latestInbound = await getLatestInboundMessage(conversationId);
        if (latestInbound) {
          const hrsElapsed = (Date.now() - new Date(latestInbound.timestamp).getTime()) / (1e3 * 60 * 60);
          if (hrsElapsed > 24 && !templateName) {
            whatsappRuleViolation = true;
          }
        }
      }
      const recipientId = extractRecipientId(conversationId, conv.platform);
      const adapter = getChannelAdapter(conv.platform);
      let delivery = {
        platformMessageId: `mid.out_${Date.now()}_local`,
        delivered: false,
        mode: "mock"
      };
      if (!whatsappRuleViolation && conv.platform !== "platform") {
        try {
          delivery = await adapter.sendMessage({
            platform: conv.platform,
            recipientId,
            content: {
              type: content.type || "text",
              body: content.body,
              mediaUrl: content.mediaUrl,
              templateName,
              templateLanguage
            }
          });
        } catch (err) {
          console.error("[Outbound Adapter Error]", err);
          return res.status(502).json({
            error: err instanceof Error ? err.message : "Failed to deliver message via channel adapter"
          });
        }
      }
      const outboundMsg = {
        id: `m_out_${Date.now()}`,
        platform: conv.platform,
        platformMessageId: delivery.platformMessageId,
        conversationId,
        senderId: senderId || "agent_farhan",
        senderName: senderName || "Kazi Farhan (Supervisor)",
        content: {
          type: content.type || "text",
          body: content.body,
          mediaUrl: content.mediaUrl
        },
        direction: "outbound",
        status: delivery.delivered ? "delivered" : "sent",
        assignedAgent: conv.assignedAgent || "agent_farhan",
        conversationStatus: conv.status || "open",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      await saveMessage(outboundMsg);
      await patchConversation(conversationId, { lastMessage: content.body });
      return res.status(200).json({
        status: "success",
        message: outboundMsg,
        delivery,
        whatsapp24HourWarning: whatsappRuleViolation ? "Outgoing message exceeds WhatsApp's active 24-hour user interaction window. Use an approved template." : null
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ error: message });
    }
  }
);
messagingRouter.patch("/conversation/status", async (req, res) => {
  try {
    const { conversationId, status } = req.body;
    if (!conversationId || !status) {
      return res.status(400).json({ error: "conversationId and status fields are mandatory." });
    }
    const updatedConv = await patchConversation(conversationId, { status });
    if (!updatedConv) {
      return res.status(404).json({ error: "Conversation context not found." });
    }
    return res.status(200).json({ status: "success", conversation: updatedConv });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});
messagingRouter.patch("/conversation/assign-agent", async (req, res) => {
  try {
    const { conversationId, agentId } = req.body;
    if (!conversationId || !agentId) {
      return res.status(400).json({ error: "conversationId and agentId fields are mandatory" });
    }
    const updatedConv = await patchConversation(conversationId, { assignedAgent: agentId });
    if (!updatedConv) {
      return res.status(404).json({ error: "Conversation thread not found" });
    }
    return res.status(200).json({ status: "success", conversation: updatedConv });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});
messagingRouter.get("/agents", async (_req, res) => {
  try {
    return res.status(200).json(await listAgents());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

// server/logisticsRouter.ts
import { Router as Router2 } from "express";

// src/services/logistics/LogisticsService.ts
init_firebase();
import {
  collection,
  doc as doc2,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc
} from "firebase/firestore";

// src/services/logistics/adapters/SteadfastAdapter.ts
var SteadfastAdapter = class {
  constructor(config) {
    this.name = "Steadfast";
    this.code = "steadfast";
    this.logo = "https://steadfast.com.bd/assets/logo.png";
    this.apiKey = "";
    this.apiSecret = "";
    this.apiUrl = "https://api.steadfast.com.bd";
    this.sandbox = true;
    if (config) {
      this.apiKey = config.apiKey || "";
      this.apiSecret = config.apiSecret || "";
      this.apiUrl = config.apiUrl || "https://api.steadfast.com.bd";
      this.sandbox = config.sandbox !== void 0 ? config.sandbox : true;
    }
  }
  async createConsignment(params) {
    console.log(`[SteadfastAdapter] Creating consignment for Invoice: ${params.invoiceId}, COD: ${params.codAmount}`);
    if (this.apiKey && !this.sandbox) {
      try {
        const response = await fetch(`${this.apiUrl}/api/v1/create_order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": this.apiKey,
            "Secret-Key": this.apiSecret
          },
          body: JSON.stringify({
            invoice: params.invoiceId,
            recipient_name: params.recipientName,
            recipient_phone: params.recipientPhone,
            recipient_address: params.recipientAddress,
            cod_amount: params.codAmount,
            weight: params.weight,
            note: params.note || ""
          })
        });
        const data = await response.json();
        if (response.ok && data.status === 200) {
          return {
            success: true,
            trackingNumber: data.consignment.tracking_code,
            waybillNumber: data.consignment.waybill_number || "",
            rawResponse: data
          };
        } else {
          return {
            success: false,
            trackingNumber: "",
            rawResponse: data,
            error: data.message || "Failed to create order on Steadfast API"
          };
        }
      } catch (err) {
        return {
          success: false,
          trackingNumber: "",
          rawResponse: null,
          error: err.message || "Network error connecting to Steadfast API"
        };
      }
    }
    const simulatedTracking = `STF${Math.floor(1e7 + Math.random() * 9e7)}`;
    const simulatedWaybill = `WB${Math.floor(1e8 + Math.random() * 9e8)}`;
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 200,
        message: "Order created successfully (Simulated Sandbox)",
        consignment: {
          tracking_code: simulatedTracking,
          waybill_number: simulatedWaybill,
          cod_amount: params.codAmount,
          weight: params.weight
        }
      }
    };
  }
  async cancelConsignment(trackingId) {
    console.log(`[SteadfastAdapter] Cancelling consignment: ${trackingId}`);
    if (this.apiKey && !this.sandbox) {
      try {
        const response = await fetch(`${this.apiUrl}/api/v1/cancel_order/${trackingId}`, {
          method: "POST",
          headers: {
            "Api-Key": this.apiKey,
            "Secret-Key": this.apiSecret
          }
        });
        const data = await response.json();
        return {
          success: response.ok && data.status === 200,
          message: data.message || "Cancel action processed",
          rawResponse: data
        };
      } catch (err) {
        return {
          success: false,
          message: err.message || "Error cancelling order",
          rawResponse: null
        };
      }
    }
    return {
      success: true,
      message: "Order cancelled successfully (Simulated Sandbox)",
      rawResponse: { status: 200, message: "Cancelled" }
    };
  }
  async requestPickup(params) {
    console.log(`[SteadfastAdapter] Requesting pickup from ${params.pickupAddress.city}, package count: ${params.packageCount}`);
    return {
      success: true,
      pickupId: `PUP-${Math.floor(1e5 + Math.random() * 9e5)}`,
      scheduledTime: params.scheduledDate,
      message: "Pickup scheduled successfully"
    };
  }
  async trackShipment(trackingId) {
    console.log(`[SteadfastAdapter] Tracking consignment: ${trackingId}`);
    if (this.apiKey && !this.sandbox) {
      try {
        const response = await fetch(`${this.apiUrl}/api/v1/status_by_trackingcode/${trackingId}`, {
          method: "GET",
          headers: {
            "Api-Key": this.apiKey,
            "Secret-Key": this.apiSecret
          }
        });
        const data = await response.json();
        if (response.ok) {
          const status = data.delivery_status || "Pending";
          return {
            success: true,
            status,
            trackingEvents: [
              {
                timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                status,
                location: "Dhaka Hub",
                description: `Order status is currently: ${status}`,
                remarks: data.remarks || ""
              }
            ]
          };
        }
      } catch (err) {
      }
    }
    return {
      success: true,
      status: "in_transit",
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 864e5 * 2).toISOString(),
          status: "pending_pickup",
          location: "Dhaka",
          description: "Shipment created and scheduled for pickup"
        },
        {
          timestamp: new Date(Date.now() - 864e5).toISOString(),
          status: "picked_up",
          location: "Dhaka Central Warehouse",
          description: "Package received at sorting facility"
        },
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "in_transit",
          location: "Chittagong Sorting Hub",
          description: "Consignment is in transit to destination hub",
          remarks: "Expected delivery tomorrow"
        }
      ]
    };
  }
  async printLabel(trackingId, format) {
    console.log(`[SteadfastAdapter] Printing label for: ${trackingId} format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.steadfast.com.bd/labels/print/${trackingId}?format=${format}`
    };
  }
  async estimateShipping(params) {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes("dhaka");
    const deliveryCharge = isDhakaCity ? 60 : 120;
    const codFee = params.codAmount > 0 ? Math.max(10, Math.round(params.codAmount * 0.01)) : 0;
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 3
    };
  }
  async healthCheck() {
    return {
      status: "healthy",
      message: "Steadfast Adapter initialized successfully"
    };
  }
};

// src/services/logistics/adapters/PathaoAdapter.ts
var PathaoAdapter = class {
  constructor(config) {
    this.name = "Pathao";
    this.code = "pathao";
    this.logo = "https://pathao.com/wp-content/uploads/2018/12/Pathao_logo_red.png";
    this.apiKey = "";
    this.apiSecret = "";
    this.apiUrl = "https://api.pathao.com";
    this.sandbox = true;
    if (config) {
      this.apiKey = config.apiKey || "";
      this.apiSecret = config.apiSecret || "";
      this.apiUrl = config.apiUrl || "https://api.pathao.com";
      this.sandbox = config.sandbox !== void 0 ? config.sandbox : true;
    }
  }
  async createConsignment(params) {
    console.log(`[PathaoAdapter] Creating consignment for Invoice: ${params.invoiceId}, COD: ${params.codAmount}`);
    const simulatedTracking = `PTH${Math.floor(1e7 + Math.random() * 9e7)}`;
    const simulatedWaybill = `WB-PTH-${Math.floor(1e8 + Math.random() * 9e8)}`;
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 200,
        message: "Order created successfully (Simulated Pathao Sandbox)",
        consignment: {
          tracking_code: simulatedTracking,
          waybill_number: simulatedWaybill,
          cod_amount: params.codAmount,
          weight: params.weight
        }
      }
    };
  }
  async cancelConsignment(trackingId) {
    console.log(`[PathaoAdapter] Cancelling consignment: ${trackingId}`);
    return {
      success: true,
      message: "Order cancelled successfully (Simulated Pathao Sandbox)",
      rawResponse: { status: 200, message: "Cancelled" }
    };
  }
  async requestPickup(params) {
    console.log(`[PathaoAdapter] Requesting pickup from ${params.pickupAddress.city}, package count: ${params.packageCount}`);
    return {
      success: true,
      pickupId: `PUP-PTH-${Math.floor(1e5 + Math.random() * 9e5)}`,
      scheduledTime: params.scheduledDate,
      message: "Pathao pickup scheduled successfully"
    };
  }
  async trackShipment(trackingId) {
    console.log(`[PathaoAdapter] Tracking consignment: ${trackingId}`);
    return {
      success: true,
      status: "in_transit",
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 864e5 * 2).toISOString(),
          status: "pending_pickup",
          location: "Dhaka",
          description: "Shipment created and scheduled for Pathao pickup"
        },
        {
          timestamp: new Date(Date.now() - 864e5).toISOString(),
          status: "picked_up",
          location: "Dhaka Central Warehouse",
          description: "Package received at Pathao sorting hub"
        },
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "in_transit",
          location: "Destination Hub",
          description: "Consignment is in transit on Pathao vehicle",
          remarks: "Expected delivery soon"
        }
      ]
    };
  }
  async printLabel(trackingId, format) {
    console.log(`[PathaoAdapter] Printing label for: ${trackingId} format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.pathao.com/labels/print/${trackingId}?format=${format}`
    };
  }
  async estimateShipping(params) {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes("dhaka");
    const deliveryCharge = isDhakaCity ? 55 : 115;
    const codFee = params.codAmount > 0 ? Math.max(10, Math.round(params.codAmount * 5e-3)) : 0;
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 2
    };
  }
  async healthCheck() {
    return {
      status: "healthy",
      message: "Pathao Adapter initialized successfully"
    };
  }
};

// src/services/logistics/adapters/RedxAdapter.ts
var RedxAdapter = class {
  constructor(config) {
    this.name = "REDX";
    this.code = "redx";
    this.logo = "https://redx.com.bd/assets/images/redx-logo.svg";
    this.apiKey = "";
    this.apiSecret = "";
    this.apiUrl = "https://api.redx.com.bd";
    this.sandbox = true;
    if (config) {
      this.apiKey = config.apiKey || "";
      this.apiSecret = config.apiSecret || "";
      this.apiUrl = config.apiUrl || "https://api.redx.com.bd";
      this.sandbox = config.sandbox !== void 0 ? config.sandbox : true;
    }
  }
  async createConsignment(params) {
    console.log(`[RedxAdapter] Creating consignment for Invoice: ${params.invoiceId}, COD: ${params.codAmount}`);
    const simulatedTracking = `RDX${Math.floor(1e7 + Math.random() * 9e7)}`;
    const simulatedWaybill = `WB-RDX-${Math.floor(1e8 + Math.random() * 9e8)}`;
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 200,
        message: "Order created successfully (Simulated REDX Sandbox)",
        consignment: {
          tracking_code: simulatedTracking,
          waybill_number: simulatedWaybill,
          cod_amount: params.codAmount,
          weight: params.weight
        }
      }
    };
  }
  async cancelConsignment(trackingId) {
    console.log(`[RedxAdapter] Cancelling consignment: ${trackingId}`);
    return {
      success: true,
      message: "Order cancelled successfully (Simulated REDX Sandbox)",
      rawResponse: { status: 200, message: "Cancelled" }
    };
  }
  async requestPickup(params) {
    console.log(`[RedxAdapter] Requesting pickup from ${params.pickupAddress.city}, package count: ${params.packageCount}`);
    return {
      success: true,
      pickupId: `PUP-RDX-${Math.floor(1e5 + Math.random() * 9e5)}`,
      scheduledTime: params.scheduledDate,
      message: "REDX pickup scheduled successfully"
    };
  }
  async trackShipment(trackingId) {
    console.log(`[RedxAdapter] Tracking consignment: ${trackingId}`);
    return {
      success: true,
      status: "in_transit",
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 864e5 * 2).toISOString(),
          status: "pending_pickup",
          location: "Dhaka",
          description: "Shipment created and scheduled for REDX pickup"
        },
        {
          timestamp: new Date(Date.now() - 864e5).toISOString(),
          status: "picked_up",
          location: "Dhaka Central Warehouse",
          description: "Package received at REDX sorting hub"
        },
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "in_transit",
          location: "Destination Hub",
          description: "Consignment is in transit on REDX network",
          remarks: "Expected delivery soon"
        }
      ]
    };
  }
  async printLabel(trackingId, format) {
    console.log(`[RedxAdapter] Printing label for: ${trackingId} format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.redx.com.bd/labels/print/${trackingId}?format=${format}`
    };
  }
  async estimateShipping(params) {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes("dhaka");
    const deliveryCharge = isDhakaCity ? 60 : 130;
    const codFee = params.codAmount > 0 ? Math.max(10, Math.round(params.codAmount * 0.01)) : 0;
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 3
    };
  }
  async healthCheck() {
    return {
      status: "healthy",
      message: "REDX Adapter initialized successfully"
    };
  }
};

// src/services/logistics/adapters/PaperflyAdapter.ts
var PaperflyAdapter = class {
  constructor(config) {
    this.name = "Paperfly";
    this.code = "paperfly";
    this.logo = "https://www.paperfly.com.bd/images/paperfly-logo.png";
    this.apiKey = "";
    this.apiSecret = "";
    this.apiUrl = "https://api.paperfly.com.bd";
    this.sandbox = true;
    if (config) {
      this.apiKey = config.apiKey || "";
      this.apiSecret = config.apiSecret || "";
      this.apiUrl = config.apiUrl || "https://api.paperfly.com.bd";
      this.sandbox = config.sandbox !== void 0 ? config.sandbox : true;
    }
  }
  async createConsignment(params) {
    console.log(`[PaperflyAdapter] Dispatching order: ${params.invoiceId}, COD: ${params.codAmount}`);
    const simulatedTracking = `PFL${Math.floor(1e7 + Math.random() * 9e7)}`;
    const simulatedWaybill = `WB-PFL-${Math.floor(1e8 + Math.random() * 9e8)}`;
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: "success",
        code: 200,
        message: "Order accepted by Paperfly Sandbox API",
        data: {
          tracking_code: simulatedTracking,
          waybill_no: simulatedWaybill,
          invoice_id: params.invoiceId
        }
      }
    };
  }
  async cancelConsignment(trackingId) {
    console.log(`[PaperflyAdapter] Cancelling delivery: ${trackingId}`);
    return {
      success: true,
      message: "Paperfly shipment cancelled successfully (Simulated)",
      rawResponse: { status: "success", code: 200 }
    };
  }
  async requestPickup(params) {
    console.log(`[PaperflyAdapter] Requesting shipment pickup at ${params.pickupAddress.street}`);
    return {
      success: true,
      pickupId: `PUP-PFL-${Math.floor(1e5 + Math.random() * 9e5)}`,
      scheduledTime: params.scheduledDate,
      message: "Paperfly scheduled pickup request successful"
    };
  }
  async trackShipment(trackingId) {
    console.log(`[PaperflyAdapter] Tracking delivery status: ${trackingId}`);
    return {
      success: true,
      status: "in_transit",
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 864e5 * 2).toISOString(),
          status: "pending_pickup",
          location: "Dhaka",
          description: "Shipment booking generated at Paperfly merchant portal"
        },
        {
          timestamp: new Date(Date.now() - 864e5).toISOString(),
          status: "picked_up",
          location: "Paperfly Dhaka Central Hub",
          description: "Shipment received and sorted into outbound bags"
        },
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "in_transit",
          location: "In-Transit to Local Point",
          description: "Dispatched to target hub point for local rider delivery"
        }
      ]
    };
  }
  async printLabel(trackingId, format) {
    console.log(`[PaperflyAdapter] Dispatching label render: ${trackingId} Format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.paperfly.com.bd/labels/print/${trackingId}?format=${format}`
    };
  }
  async estimateShipping(params) {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes("dhaka");
    const deliveryCharge = isDhakaCity ? 60 : 120;
    const codFee = params.codAmount > 0 ? Math.max(15, Math.round(params.codAmount * 0.01)) : 0;
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 3
    };
  }
  async healthCheck() {
    return {
      status: "healthy",
      message: "Paperfly Courier API gateway integration is active and listening."
    };
  }
};

// src/services/logistics/adapters/ECourierAdapter.ts
var ECourierAdapter = class {
  constructor(config) {
    this.name = "eCourier";
    this.code = "ecourier";
    this.logo = "https://ecourier.com.bd/wp-content/uploads/2021/04/e-courier-logo.png";
    this.apiKey = "";
    this.apiSecret = "";
    this.apiUrl = "https://api.ecourier.com.bd";
    this.sandbox = true;
    if (config) {
      this.apiKey = config.apiKey || "";
      this.apiSecret = config.apiSecret || "";
      this.apiUrl = config.apiUrl || "https://api.ecourier.com.bd";
      this.sandbox = config.sandbox !== void 0 ? config.sandbox : true;
    }
  }
  async createConsignment(params) {
    console.log(`[ECourierAdapter] Registering parcel order: ${params.invoiceId}, COD: ${params.codAmount}`);
    const simulatedTracking = `ECR${Math.floor(1e7 + Math.random() * 9e7)}`;
    const simulatedWaybill = `WB-ECR-${Math.floor(1e8 + Math.random() * 9e8)}`;
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: "success",
        code: 200,
        message: "eCourier consignment created",
        data: {
          tracking_id: simulatedTracking,
          waybill_number: simulatedWaybill,
          recipient_phone: params.recipientPhone
        }
      }
    };
  }
  async cancelConsignment(trackingId) {
    console.log(`[ECourierAdapter] Sending cancel request for: ${trackingId}`);
    return {
      success: true,
      message: "eCourier consignment cancelled successfully (Simulated)",
      rawResponse: { status: "success", code: 200 }
    };
  }
  async requestPickup(params) {
    console.log(`[ECourierAdapter] Requesting pickup schedule for address: ${params.pickupAddress.street}`);
    return {
      success: true,
      pickupId: `PUP-ECR-${Math.floor(1e5 + Math.random() * 9e5)}`,
      scheduledTime: params.scheduledDate,
      message: "eCourier courier dispatcher assigned"
    };
  }
  async trackShipment(trackingId) {
    console.log(`[ECourierAdapter] Syncing status with eCourier: ${trackingId}`);
    return {
      success: true,
      status: "in_transit",
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 864e5 * 2).toISOString(),
          status: "pending_pickup",
          location: "Dhaka",
          description: "Shipment created and registered in eCourier core system"
        },
        {
          timestamp: new Date(Date.now() - 864e5).toISOString(),
          status: "picked_up",
          location: "eCourier Dhaka Hub",
          description: "Parcel collected and weighed. Sorted for destination transport."
        },
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "in_transit",
          location: "Dhaka In-Transit Hub",
          description: "In transit to distribution hub office."
        }
      ]
    };
  }
  async printLabel(trackingId, format) {
    console.log(`[ECourierAdapter] Printing label for: ${trackingId} Format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.ecourier.com.bd/labels/print/${trackingId}?format=${format}`
    };
  }
  async estimateShipping(params) {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes("dhaka");
    const deliveryCharge = isDhakaCity ? 50 : 110;
    const codFee = params.codAmount > 0 ? Math.max(10, Math.round(params.codAmount * 75e-4)) : 0;
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 2
    };
  }
  async healthCheck() {
    return {
      status: "healthy",
      message: "eCourier Endpoint status: stable. Gateway ready."
    };
  }
};

// src/services/logistics/adapters/SundarbanAdapter.ts
var SundarbanAdapter = class {
  constructor(config) {
    this.name = "Sundarban";
    this.code = "sundarban";
    this.logo = "https://sundarbancourierltd.com/images/logo.png";
    this.apiKey = "";
    this.apiSecret = "";
    this.apiUrl = "https://api.sundarbancourierltd.com";
    this.sandbox = true;
    if (config) {
      this.apiKey = config.apiKey || "";
      this.apiSecret = config.apiSecret || "";
      this.apiUrl = config.apiUrl || "https://api.sundarbancourierltd.com";
      this.sandbox = config.sandbox !== void 0 ? config.sandbox : true;
    }
  }
  async createConsignment(params) {
    console.log(`[SundarbanAdapter] Creating consignment for Invoice: ${params.invoiceId}, COD: ${params.codAmount}`);
    const simulatedTracking = `SND${Math.floor(1e7 + Math.random() * 9e7)}`;
    const simulatedWaybill = `WB-SND-${Math.floor(1e8 + Math.random() * 9e8)}`;
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: "success",
        code: 200,
        message: "Order created successfully (Simulated Sundarban Sandbox)",
        consignment: {
          tracking_code: simulatedTracking,
          waybill_number: simulatedWaybill,
          cod_amount: params.codAmount,
          weight: params.weight
        }
      }
    };
  }
  async cancelConsignment(trackingId) {
    console.log(`[SundarbanAdapter] Cancelling Sundarban booking: ${trackingId}`);
    return {
      success: true,
      message: "Sundarban booking cancelled successfully (Simulated)",
      rawResponse: { status: 200, message: "Cancelled" }
    };
  }
  async requestPickup(params) {
    console.log(`[SundarbanAdapter] Requesting pickup from ${params.pickupAddress.city}, package count: ${params.packageCount}`);
    return {
      success: true,
      pickupId: `PUP-SND-${Math.floor(1e5 + Math.random() * 9e5)}`,
      scheduledTime: params.scheduledDate,
      message: "Sundarban pickup scheduled successfully"
    };
  }
  async trackShipment(trackingId) {
    console.log(`[SundarbanAdapter] Tracking consignment: ${trackingId}`);
    return {
      success: true,
      status: "in_transit",
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 864e5 * 2).toISOString(),
          status: "pending_pickup",
          location: "Dhaka Main Branch",
          description: "Booking recorded and packet registered under Sundarban parcel dispatch roster"
        },
        {
          timestamp: new Date(Date.now() - 864e5).toISOString(),
          status: "picked_up",
          location: "Dhaka Central Sort Facility",
          description: "Package received at sorting facility and dispatched via internal transport vehicles"
        },
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "in_transit",
          location: "Destination District Hub",
          description: "Arrived at distribution hub. Assigned to local delivery team."
        }
      ]
    };
  }
  async printLabel(trackingId, format) {
    console.log(`[SundarbanAdapter] Printing label for: ${trackingId} format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.sundarbancourierltd.com/labels/print/${trackingId}?format=${format}`
    };
  }
  async estimateShipping(params) {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes("dhaka");
    const deliveryCharge = isDhakaCity ? 70 : 130;
    const codFee = params.codAmount > 0 ? Math.max(20, Math.round(params.codAmount * 0.015)) : 0;
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 3
    };
  }
  async healthCheck() {
    return {
      status: "healthy",
      message: "Sundarban Courier system API endpoint is fully operational."
    };
  }
};

// src/services/logistics/LogisticsService.ts
var LogisticsService = class _LogisticsService {
  constructor() {
    this.adapters = /* @__PURE__ */ new Map();
    this.memoryStore = /* @__PURE__ */ new Map();
    this.registerAdapter(new SteadfastAdapter());
    this.registerAdapter(new PathaoAdapter());
    this.registerAdapter(new RedxAdapter());
    this.registerAdapter(new PaperflyAdapter());
    this.registerAdapter(new ECourierAdapter());
    this.registerAdapter(new SundarbanAdapter());
  }
  safeGetItem(key) {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        return localStorage.getItem(key);
      } catch (e) {
      }
    }
    return this.memoryStore.get(key) || null;
  }
  safeSetItem(key, value) {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e) {
      }
    }
    this.memoryStore.set(key, value);
  }
  static getInstance() {
    if (!_LogisticsService.instance) {
      _LogisticsService.instance = new _LogisticsService();
    }
    return _LogisticsService.instance;
  }
  /**
   * Register a custom courier provider adapter
   */
  registerAdapter(adapter) {
    this.adapters.set(adapter.code, adapter);
    console.log(`[LogisticsService] Registered courier adapter: ${adapter.name} (${adapter.code})`);
  }
  /**
   * Get registered adapter by code
   */
  getAdapter(code) {
    return this.adapters.get(code) || null;
  }
  /**
   * Fetch active courier configurations from Firestore
   */
  async getActiveCouriers() {
    const path = "courier_configs";
    try {
      const querySnapshot = await getDocs(collection(db2, path));
      const configs = [];
      querySnapshot.forEach((d) => {
        configs.push(d.data());
      });
      this.safeSetItem("lms_courier_configs", JSON.stringify(configs));
      return configs;
    } catch (error2) {
      console.warn("Firestore failed to load courier configs, falling back to localStorage:", error2);
      const local = this.safeGetItem("lms_courier_configs");
      if (local) {
        return JSON.parse(local);
      }
      return [
        {
          id: "config_steadfast",
          code: "steadfast",
          name: "Steadfast",
          apiUrl: "https://api.steadfast.com.bd",
          apiKey: "demo_key_steadfast",
          apiSecret: "demo_secret_steadfast",
          webhookSecret: "webhook_secret_steadfast",
          sandbox: true,
          production: false,
          enabled: true,
          healthStatus: "healthy",
          logo: "https://steadfast.com.bd/assets/logo.png",
          coverageDistricts: ["Dhaka", "Chittagong", "Sylhet"],
          lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "config_pathao",
          code: "pathao",
          name: "Pathao",
          apiUrl: "https://api.pathao.com",
          apiKey: "demo_key_pathao",
          apiSecret: "demo_secret_pathao",
          webhookSecret: "webhook_secret_pathao",
          sandbox: true,
          production: false,
          enabled: true,
          healthStatus: "healthy",
          logo: "https://pathao.com/wp-content/uploads/2018/12/Pathao_logo_red.png",
          coverageDistricts: ["Dhaka", "Chittagong", "Sylhet", "Rajshahi"],
          lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "config_redx",
          code: "redx",
          name: "REDX",
          apiUrl: "https://api.redx.com.bd",
          apiKey: "demo_key_redx",
          apiSecret: "demo_secret_redx",
          webhookSecret: "webhook_secret_redx",
          sandbox: true,
          production: false,
          enabled: true,
          healthStatus: "healthy",
          logo: "https://redx.com.bd/assets/images/redx-logo.svg",
          coverageDistricts: ["Dhaka", "Chittagong", "Sylhet", "Khulna", "Barisal"],
          lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ];
    }
  }
  getCourier(code) {
    const adapter = this.getAdapter(code);
    if (!adapter) return null;
    return {
      name: adapter.name,
      healthCheck: async () => {
        try {
          return await adapter.healthCheck();
        } catch (e) {
          return { status: "down", message: e.message || "Error checking health" };
        }
      }
    };
  }
  async getCourierConfigs() {
    return this.getActiveCouriers();
  }
  async updateCourierStatus(courierCode, enabled) {
    const configs = await this.getActiveCouriers();
    const updated = configs.map((c) => {
      if (c.code === courierCode) {
        return { ...c, enabled, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      }
      return c;
    });
    const target = updated.find((c) => c.code === courierCode);
    if (target) {
      try {
        await setDoc(doc2(db2, "courier_configs", target.id), target);
      } catch (err) {
        console.warn("Firestore failed to update courier status, updating local only:", err);
      }
    }
    this.safeSetItem("lms_courier_configs", JSON.stringify(updated));
  }
  async deleteCourierConfig(courierCode) {
    const configs = await this.getActiveCouriers();
    const filtered = configs.filter((c) => c.code !== courierCode);
    this.safeSetItem("lms_courier_configs", JSON.stringify(filtered));
  }
  async saveCourierConfig(config) {
    const configs = await this.getActiveCouriers();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existingIdx = configs.findIndex((c) => c.code === config.code);
    let updatedConfig;
    if (existingIdx !== -1) {
      updatedConfig = {
        ...configs[existingIdx],
        ...config,
        updatedAt: now
      };
      configs[existingIdx] = updatedConfig;
    } else {
      updatedConfig = {
        ...config,
        id: config.id || `config_${config.code || Math.floor(Math.random() * 1e6)}`,
        createdAt: now,
        updatedAt: now,
        healthStatus: config.healthStatus || "healthy",
        enabled: config.enabled !== void 0 ? config.enabled : true,
        coverageDistricts: config.coverageDistricts || ["Dhaka", "Chittagong"],
        lastSyncAt: now
      };
      configs.push(updatedConfig);
    }
    try {
      await setDoc(doc2(db2, "courier_configs", updatedConfig.id), updatedConfig);
    } catch (err) {
      console.warn("Firestore failed to save courier config, saving local only:", err);
    }
    this.safeSetItem("lms_courier_configs", JSON.stringify(configs));
  }
  async getShipments(filters) {
    let shipments = [];
    try {
      const querySnapshot = await getDocs(collection(db2, "shipments"));
      querySnapshot.forEach((doc3) => {
        shipments.push(doc3.data());
      });
    } catch (error2) {
      console.warn("Firestore failed to load shipments, using local storage fallback:", error2);
      const local = this.safeGetItem("lms_shipments");
      if (local) {
        shipments = JSON.parse(local);
      }
    }
    if (filters) {
      if (filters.dateFrom) {
        shipments = shipments.filter((s) => s.createdAt >= filters.dateFrom);
      }
      if (filters.dateTo) {
        shipments = shipments.filter((s) => s.createdAt <= filters.dateTo);
      }
    }
    if (shipments.length === 0) {
      shipments = this.getMockShipments();
      this.safeSetItem("lms_shipments", JSON.stringify(shipments));
      for (const sh of shipments) {
        try {
          await setDoc(doc2(db2, "shipments", sh.id), sh);
        } catch (e) {
        }
      }
    }
    return shipments;
  }
  async searchShipment(searchTerm) {
    const shipments = await this.getShipments();
    const cleanSearch = searchTerm.trim().toLowerCase();
    const found = shipments.find(
      (s) => s.trackingNumber.toLowerCase() === cleanSearch || s.orderId.toLowerCase() === cleanSearch || s.id.toLowerCase() === cleanSearch
    );
    if (!found) {
      throw new Error(`No shipment found matching tracking number or order ID "${searchTerm}".`);
    }
    return found;
  }
  getMockShipments() {
    const now = /* @__PURE__ */ new Date();
    const formatOffsetDate = (daysAgo) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1e3).toISOString();
    return [
      {
        id: "ship_847192",
        orderId: "ORD-99182",
        sellerId: "seller_001",
        customerId: "c_01",
        status: "delivered",
        courier: { code: "steadfast", name: "Steadfast" },
        trackingNumber: "STF82741920",
        waybillNumber: "WB829104812",
        pickupAddress: { street: "Mirpur 10", city: "Dhaka", district: "Dhaka", postalCode: "1216", phone: "01711122233" },
        deliveryAddress: { street: "GEC Circle", city: "Chittagong", district: "Chittagong", postalCode: "4000", phone: "01811122233" },
        weight: 1.5,
        packageType: "regular",
        contents: [{ productId: "prod_001", name: "Premium Leather Wallet", quantity: 1, price: 1500 }],
        codAmount: 1620,
        deliveryCharge: 120,
        totalCharge: 135,
        createdAt: formatOffsetDate(5),
        updatedAt: formatOffsetDate(2),
        estimatedDeliveryAt: formatOffsetDate(2),
        trackingEvents: [
          { id: "evt_1", timestamp: formatOffsetDate(5), status: "pending_pickup", location: "Dhaka", description: "Shipment created and scheduled for pickup" },
          { id: "evt_2", timestamp: formatOffsetDate(4), status: "picked_up", location: "Dhaka sorting hub", description: "Package picked up by courier" },
          { id: "evt_3", timestamp: formatOffsetDate(3), status: "in_transit", location: "Chittagong sorting hub", description: "Package in transit" },
          { id: "evt_4", timestamp: formatOffsetDate(2), status: "delivered", location: "Chittagong", description: "Successfully delivered to customer" }
        ],
        sellerContact: { name: "Rifat Store", phone: "01711122233", email: "rifat@store.com" },
        customerContact: { name: "Imran Khan", phone: "01811122233", email: "imran@gmail.com" },
        autoGeneratedLabel: true,
        autoRequestedPickup: true
      },
      {
        id: "ship_294810",
        orderId: "ORD-10294",
        sellerId: "seller_001",
        customerId: "c_02",
        status: "in_transit",
        courier: { code: "pathao", name: "Pathao" },
        trackingNumber: "PTH20194810",
        waybillNumber: "WB-PTH-182749102",
        pickupAddress: { street: "Gulshan 2", city: "Dhaka", district: "Dhaka", postalCode: "1212", phone: "01911122233" },
        deliveryAddress: { street: "Upashahar", city: "Sylhet", district: "Sylhet", postalCode: "3100", phone: "01722233344" },
        weight: 0.8,
        packageType: "express",
        contents: [{ productId: "prod_002", name: "Wireless Noise Cancelling Earbuds", quantity: 1, price: 3500 }],
        codAmount: 3620,
        deliveryCharge: 120,
        totalCharge: 140,
        createdAt: formatOffsetDate(2),
        updatedAt: formatOffsetDate(1),
        estimatedDeliveryAt: formatOffsetDate(-1),
        trackingEvents: [
          { id: "evt_1", timestamp: formatOffsetDate(2), status: "pending_pickup", location: "Dhaka", description: "Shipment created and scheduled for Pathao pickup" },
          { id: "evt_2", timestamp: formatOffsetDate(1), status: "picked_up", location: "Dhaka Central Warehouse", description: "Package received at Pathao sorting hub" }
        ],
        sellerContact: { name: "TechBD", phone: "01911122233", email: "techbd@gmail.com" },
        customerContact: { name: "Nusrat Jahan", phone: "01722233344", email: "nusrat@gmail.com" },
        autoGeneratedLabel: true,
        autoRequestedPickup: true
      },
      {
        id: "ship_581928",
        orderId: "ORD-55281",
        sellerId: "seller_002",
        customerId: "c_03",
        status: "failed_delivery",
        courier: { code: "redx", name: "REDX" },
        trackingNumber: "RDX91827391",
        waybillNumber: "WB-RDX-291827391",
        pickupAddress: { street: "Banani", city: "Dhaka", district: "Dhaka", postalCode: "1213", phone: "01311122233" },
        deliveryAddress: { street: "Chashara", city: "Narayanganj", district: "Narayanganj", postalCode: "1400", phone: "01511122233" },
        weight: 2.2,
        packageType: "fragile",
        contents: [{ productId: "prod_003", name: "Ceramic Table Vase", quantity: 1, price: 1800 }],
        codAmount: 1950,
        deliveryCharge: 150,
        totalCharge: 170,
        createdAt: formatOffsetDate(4),
        updatedAt: formatOffsetDate(1),
        estimatedDeliveryAt: formatOffsetDate(1),
        trackingEvents: [
          { id: "evt_1", timestamp: formatOffsetDate(4), status: "pending_pickup", location: "Dhaka", description: "Shipment created and scheduled for REDX pickup" },
          { id: "evt_2", timestamp: formatOffsetDate(3), status: "picked_up", location: "Dhaka sorting hub", description: "Package received at REDX hub" },
          { id: "evt_3", timestamp: formatOffsetDate(2), status: "in_transit", location: "Narayanganj hub", description: "Package out for delivery" },
          { id: "evt_4", timestamp: formatOffsetDate(1), status: "failed_delivery", location: "Narayanganj", description: "Delivery failed: Customer unavailable, rescheduling" }
        ],
        sellerContact: { name: "Home Decor BD", phone: "01311122233", email: "decor@home.com" },
        customerContact: { name: "Ariful Islam", phone: "01511122233", email: "arif@outlook.com" },
        autoGeneratedLabel: true,
        autoRequestedPickup: true
      }
    ];
  }
  /**
   * Create a shipment consignment (Firestore + Courier dispatch)
   */
  async createShipment(params) {
    const adapter = this.getAdapter(params.courierCode);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${params.courierCode}" is not registered.`);
    }
    console.log(`[LogisticsService] Creating shipment on provider "${adapter.name}"`);
    const recipientAddressStr = `${params.deliveryAddress.street}, ${params.deliveryAddress.city}, ${params.deliveryAddress.district}`;
    const response = await adapter.createConsignment({
      invoiceId: params.orderId,
      recipientName: params.customerContact.name,
      recipientPhone: params.customerContact.phone,
      recipientAddress: recipientAddressStr,
      codAmount: params.codAmount,
      weight: params.weight,
      note: `Order from Seller: ${params.sellerId}`
    });
    if (!response.success) {
      throw new Error(response.error || "Failed to register consignment with courier provider.");
    }
    const shipmentId = `ship_${Math.floor(1e5 + Math.random() * 9e5)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const shipment = {
      id: shipmentId,
      orderId: params.orderId,
      sellerId: params.sellerId,
      customerId: params.customerId,
      status: "pending_pickup",
      courier: {
        code: adapter.code,
        name: adapter.name
      },
      trackingNumber: response.trackingNumber,
      waybillNumber: response.waybillNumber,
      pickupAddress: params.pickupAddress,
      deliveryAddress: params.deliveryAddress,
      weight: params.weight,
      packageType: params.packageType,
      contents: params.contents,
      codAmount: params.codAmount,
      deliveryCharge: 120,
      // default placeholder
      totalCharge: 120 + (params.codAmount > 0 ? Math.round(params.codAmount * 0.01) : 0),
      createdAt: now,
      updatedAt: now,
      trackingEvents: [
        {
          id: `evt_${Math.floor(1e4 + Math.random() * 9e4)}`,
          timestamp: now,
          status: "pending_pickup",
          location: params.pickupAddress.city,
          description: "Shipment created and scheduled for pickup"
        }
      ],
      sellerContact: params.sellerContact,
      customerContact: params.customerContact,
      autoGeneratedLabel: true,
      autoRequestedPickup: true
    };
    const path = "shipments";
    try {
      await setDoc(doc2(db2, path, shipmentId), shipment);
      console.log(`[LogisticsService] Saved shipment ${shipmentId} in Firestore`);
    } catch (error2) {
      console.warn("Firestore failed to save shipment, using localStorage fallback:", error2);
    }
    const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
    const localShipments = JSON.parse(localShipmentsStr);
    localShipments.push(shipment);
    this.safeSetItem("lms_shipments", JSON.stringify(localShipments));
    return shipment;
  }
  /**
   * Retrieve shipment by ID
   */
  async getShipment(shipmentId) {
    try {
      const docSnap = await getDoc(doc2(db2, "shipments", shipmentId));
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (error2) {
      console.warn("Firestore failed to get shipment, using localStorage fallback:", error2);
    }
    const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
    const localShipments = JSON.parse(localShipmentsStr);
    return localShipments.find((s) => s.id === shipmentId) || null;
  }
  /**
   * Retrieve shipments by Order ID
   */
  async getShipmentsByOrder(orderId) {
    try {
      const q = query(collection(db2, "shipments"), where("orderId", "==", orderId));
      const querySnapshot = await getDocs(q);
      const shipments = [];
      querySnapshot.forEach((d) => {
        shipments.push(d.data());
      });
      return shipments;
    } catch (error2) {
      console.warn("Firestore failed to get shipments by order, using localStorage fallback:", error2);
      const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
      const localShipments = JSON.parse(localShipmentsStr);
      return localShipments.filter((s) => s.orderId === orderId);
    }
  }
  /**
   * Retrieve shipments by Seller ID
   */
  async getShipmentsBySeller(sellerId) {
    try {
      const q = query(collection(db2, "shipments"), where("sellerId", "==", sellerId));
      const querySnapshot = await getDocs(q);
      const shipments = [];
      querySnapshot.forEach((d) => {
        shipments.push(d.data());
      });
      return shipments;
    } catch (error2) {
      console.warn("Firestore failed to get shipments by seller, using localStorage fallback:", error2);
      const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
      const localShipments = JSON.parse(localShipmentsStr);
      return localShipments.filter((s) => s.sellerId === sellerId);
    }
  }
  /**
   * Cancel shipment
   */
  async cancelShipment(shipmentId, reason) {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }
    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }
    const response = await adapter.cancelConsignment(shipment.trackingNumber);
    if (!response.success) {
      throw new Error(response.message || "Courier provider rejected cancellation.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updatedEvents = [
      ...shipment.trackingEvents,
      {
        id: `evt_${Math.floor(1e4 + Math.random() * 9e4)}`,
        timestamp: now,
        status: "cancelled",
        location: shipment.pickupAddress.city,
        description: `Shipment cancelled. Reason: ${reason}`
      }
    ];
    try {
      await updateDoc(doc2(db2, "shipments", shipmentId), {
        status: "cancelled",
        updatedAt: now,
        trackingEvents: updatedEvents
      });
      console.log(`[LogisticsService] Shipment ${shipmentId} status updated to "cancelled"`);
    } catch (error2) {
      console.warn("Firestore failed to cancel shipment, updating localStorage:", error2);
    }
    const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
    const localShipments = JSON.parse(localShipmentsStr);
    const idx = localShipments.findIndex((s) => s.id === shipmentId);
    if (idx !== -1) {
      localShipments[idx].status = "cancelled";
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = updatedEvents;
      this.safeSetItem("lms_shipments", JSON.stringify(localShipments));
    }
  }
  /**
   * Fetch and sync live tracking events from Courier Adapter
   */
  async syncTracking(shipmentId) {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }
    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }
    const response = await adapter.trackShipment(shipment.trackingNumber);
    if (!response.success) {
      throw new Error("Failed to fetch updated tracking info.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newEvents = response.trackingEvents.map((evt, idx2) => ({
      id: `evt_synced_${idx2}_${Math.floor(1e3 + Math.random() * 9e3)}`,
      timestamp: evt.timestamp,
      status: evt.status,
      location: evt.location,
      description: evt.description,
      remarks: evt.remarks || null
    }));
    const finalStatus = response.status.toLowerCase();
    try {
      await updateDoc(doc2(db2, "shipments", shipmentId), {
        status: finalStatus,
        updatedAt: now,
        trackingEvents: newEvents
      });
    } catch (error2) {
      console.warn("Firestore failed to sync tracking, updating localStorage:", error2);
    }
    const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
    const localShipments = JSON.parse(localShipmentsStr);
    const idx = localShipments.findIndex((s) => s.id === shipmentId);
    if (idx !== -1) {
      localShipments[idx].status = finalStatus;
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = newEvents;
      this.safeSetItem("lms_shipments", JSON.stringify(localShipments));
    }
    return {
      ...shipment,
      status: finalStatus,
      updatedAt: now,
      trackingEvents: newEvents
    };
  }
  /**
   * Evaluate Automation Rules for Courier Selection
   */
  async evaluateShippingRules(order, sellerId) {
    const path = "shipping_rules";
    let rules = [];
    try {
      const q = query(
        collection(db2, path),
        where("sellerId", "==", sellerId),
        where("enabled", "==", true)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((d) => {
        rules.push(d.data());
      });
    } catch (error2) {
      console.warn("Error evaluating shipping rules from Firestore, using localStorage:", error2);
      const key = `lms_shipping_rules_${sellerId}`;
      const localRulesStr = this.safeGetItem(key) || this.safeGetItem("lms_shipping_rules") || "[]";
      const localRules = JSON.parse(localRulesStr);
      rules = localRules.filter((r) => r.sellerId === sellerId && r.enabled === true);
    }
    rules.sort((a, b) => b.priority - a.priority);
    for (const rule of rules) {
      let matches = true;
      if (rule.conditions.destinationDistricts && rule.conditions.destinationDistricts.length > 0) {
        const matchedDistrict = rule.conditions.destinationDistricts.some(
          (dist) => order.deliveryDistrict.toLowerCase().includes(dist.toLowerCase())
        );
        if (!matchedDistrict) matches = false;
      }
      if (rule.conditions.weightRange) {
        const { min, max } = rule.conditions.weightRange;
        if (min !== void 0 && order.weight < min) matches = false;
        if (max !== void 0 && order.weight > max) matches = false;
      }
      if (rule.conditions.orderValueRange) {
        const { min, max } = rule.conditions.orderValueRange;
        if (min !== void 0 && order.totalAmount < min) matches = false;
        if (max !== void 0 && order.totalAmount > max) matches = false;
      }
      if (matches) {
        return rule;
      }
    }
    return null;
  }
  /**
   * Fetch Warehouse by ID
   */
  async getWarehouse(warehouseId) {
    try {
      const docSnap = await getDoc(doc2(db2, "warehouses", warehouseId));
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (error2) {
      console.warn("Firestore failed to get warehouse, using localStorage:", error2);
    }
    const localWarehousesStr = this.safeGetItem("lms_warehouses") || "[]";
    const localWarehouses = JSON.parse(localWarehousesStr);
    return localWarehouses.find((w) => w.id === warehouseId) || null;
  }
  /**
   * Fetch Warehouses for a Seller
   */
  async getWarehousesBySeller(sellerId) {
    try {
      const q = query(collection(db2, "warehouses"), where("sellerId", "==", sellerId));
      const querySnapshot = await getDocs(q);
      const warehouses = [];
      querySnapshot.forEach((d) => {
        warehouses.push(d.data());
      });
      return warehouses;
    } catch (error2) {
      console.warn("Firestore failed to get warehouses by seller, using localStorage:", error2);
      const key = `lms_warehouses_${sellerId}`;
      const localWarehousesStr = this.safeGetItem(key) || this.safeGetItem("lms_warehouses") || "[]";
      const localWarehouses = JSON.parse(localWarehousesStr);
      return localWarehouses.filter((w) => w.sellerId === sellerId);
    }
  }
  /**
   * Seed Initial Courier Configuration
   */
  async seedDefaultCourierConfigs() {
    const couriers = [
      {
        id: "config_steadfast",
        code: "steadfast",
        name: "Steadfast",
        apiUrl: "https://api.steadfast.com.bd",
        apiKey: "demo_key_steadfast",
        apiSecret: "demo_secret_steadfast",
        webhookSecret: "webhook_secret_steadfast",
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: "healthy",
        logo: "https://steadfast.com.bd/assets/logo.png",
        coverageDistricts: ["Dhaka", "Chittagong", "Sylhet"],
        lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "config_pathao",
        code: "pathao",
        name: "Pathao",
        apiUrl: "https://api.pathao.com",
        apiKey: "demo_key_pathao",
        apiSecret: "demo_secret_pathao",
        webhookSecret: "webhook_secret_pathao",
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: "healthy",
        logo: "https://pathao.com/wp-content/uploads/2018/12/Pathao_logo_red.png",
        coverageDistricts: ["Dhaka", "Chittagong", "Sylhet", "Rajshahi"],
        lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "config_redx",
        code: "redx",
        name: "REDX",
        apiUrl: "https://api.redx.com.bd",
        apiKey: "demo_key_redx",
        apiSecret: "demo_secret_redx",
        webhookSecret: "webhook_secret_redx",
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: "healthy",
        logo: "https://redx.com.bd/assets/images/redx-logo.svg",
        coverageDistricts: ["Dhaka", "Chittagong", "Sylhet", "Khulna", "Barisal"],
        lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "config_paperfly",
        code: "paperfly",
        name: "Paperfly",
        apiUrl: "https://api.paperfly.com.bd",
        apiKey: "demo_key_paperfly",
        apiSecret: "demo_secret_paperfly",
        webhookSecret: "webhook_secret_paperfly",
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: "healthy",
        logo: "https://www.paperfly.com.bd/images/paperfly-logo.png",
        coverageDistricts: ["Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Rangpur"],
        lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "config_ecourier",
        code: "ecourier",
        name: "eCourier",
        apiUrl: "https://api.ecourier.com.bd",
        apiKey: "demo_key_ecourier",
        apiSecret: "demo_secret_ecourier",
        webhookSecret: "webhook_secret_ecourier",
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: "healthy",
        logo: "https://ecourier.com.bd/wp-content/uploads/2021/04/e-courier-logo.png",
        coverageDistricts: ["Dhaka", "Chittagong", "Sylhet", "Khulna", "Barisal", "Mymensingh"],
        lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "config_sundarban",
        code: "sundarban",
        name: "Sundarban",
        apiUrl: "https://api.sundarbancourierltd.com",
        apiKey: "demo_key_sundarban",
        apiSecret: "demo_secret_sundarban",
        webhookSecret: "webhook_secret_sundarban",
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: "healthy",
        logo: "https://sundarbancourierltd.com/images/logo.png",
        coverageDistricts: ["Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barisal", "Rangpur", "Mymensingh"],
        lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    for (const courier of couriers) {
      try {
        const docRef = doc2(db2, "courier_configs", courier.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, courier);
          console.log(`[LogisticsService] Seeded default configuration for ${courier.name}`);
        }
      } catch (err) {
        console.warn("Failed to seed courier configuration to Firestore (will use local fallback):", err);
      }
    }
    const local = this.safeGetItem("lms_courier_configs");
    if (!local) {
      this.safeSetItem("lms_courier_configs", JSON.stringify(couriers));
    }
  }
  /**
   * Request pickup for a shipment
   */
  async requestPickup(shipmentId) {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }
    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }
    const response = await adapter.requestPickup({
      pickupAddress: shipment.pickupAddress,
      contactPerson: shipment.sellerContact,
      scheduledDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      packageCount: 1
    });
    if (!response.success) {
      throw new Error(response.message || "Failed to request pickup.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updatedEvents = [
      ...shipment.trackingEvents,
      {
        id: `evt_${Math.floor(1e4 + Math.random() * 9e4)}`,
        timestamp: now,
        status: "pending_pickup",
        location: shipment.pickupAddress.city,
        description: "Courier pickup requested successfully."
      }
    ];
    try {
      await updateDoc(doc2(db2, "shipments", shipmentId), {
        status: "pending_pickup",
        updatedAt: now,
        trackingEvents: updatedEvents,
        pickupScheduledAt: response.scheduledTime || now
      });
      console.log(`[LogisticsService] Shipment ${shipmentId} pickup requested`);
    } catch (error2) {
      console.warn("Firestore failed to save pickup request, updating localStorage:", error2);
    }
    const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
    const localShipments = JSON.parse(localShipmentsStr);
    const idx = localShipments.findIndex((s) => s.id === shipmentId);
    if (idx !== -1) {
      localShipments[idx].status = "pending_pickup";
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = updatedEvents;
      localShipments[idx].pickupScheduledAt = response.scheduledTime || now;
      this.safeSetItem("lms_shipments", JSON.stringify(localShipments));
    }
  }
  /**
   * Generate shipping label
   */
  async generateLabel(shipmentId, format) {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }
    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }
    const response = await adapter.printLabel(shipment.trackingNumber, format);
    if (!response.success) {
      throw new Error("Failed to generate label.");
    }
    const content = `SHIPPING LABEL - ${shipment.courier.name}
-------------------------------------------
TRACKING #: ${shipment.trackingNumber}
ORDER ID: ${shipment.orderId}
SENDER: ${shipment.sellerContact.name} (${shipment.pickupAddress.city})
RECIPIENT: ${shipment.customerContact.name} (${shipment.deliveryAddress.city})
COD AMOUNT: BDT ${shipment.codAmount}
WEIGHT: ${shipment.weight} kg
FORMAT: ${format.toUpperCase()}`;
    return new Blob([content], { type: format === "pdf" ? "application/pdf" : "text/plain" });
  }
  /**
   * Update shipment from a normalized webhook event
   */
  async updateShipmentFromWebhook(trackingNumber, status, event) {
    const shipments = await this.getShipments();
    const shipment = shipments.find((s) => s.trackingNumber === trackingNumber);
    if (!shipment) {
      throw new Error(`Shipment with tracking number ${trackingNumber} not found.`);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newEvent = {
      id: `evt_web_${Math.floor(1e4 + Math.random() * 9e4)}`,
      timestamp: now,
      status: event.status,
      location: event.location,
      description: event.description,
      remarks: event.remarks || null
    };
    const updatedEvents = [...shipment.trackingEvents, newEvent];
    try {
      await updateDoc(doc2(db2, "shipments", shipment.id), {
        status,
        updatedAt: now,
        trackingEvents: updatedEvents
      });
      console.log(`[LogisticsService] Shipment ${shipment.id} successfully updated from webhook to ${status}`);
    } catch (err) {
      console.warn("Failed to update shipment in Firestore via Webhook, modifying localStorage fallback:", err);
    }
    const localShipmentsStr = this.safeGetItem("lms_shipments") || "[]";
    const localShipments = JSON.parse(localShipmentsStr);
    const idx = localShipments.findIndex((s) => s.id === shipment.id);
    if (idx !== -1) {
      localShipments[idx].status = status;
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = updatedEvents;
      this.safeSetItem("lms_shipments", JSON.stringify(localShipments));
    }
    return {
      ...shipment,
      status,
      updatedAt: now,
      trackingEvents: updatedEvents
    };
  }
};

// src/services/logistics/webhook/WebhookNormalizer.ts
var WebhookNormalizer = class {
  /**
   * Normalize any courier webhook payload into a unified LMS format
   */
  static normalize(courier, payload) {
    const cleanCourier = courier.toLowerCase();
    switch (cleanCourier) {
      case "steadfast":
        return {
          trackingNumber: payload.tracking_code || payload.trackingNumber || "",
          status: this.mapSteadfastStatus(payload.status_code || payload.status),
          location: payload.current_location || "Steadfast Depot",
          description: payload.comment || `Steadfast status update: ${payload.status_code || "unknown"}`,
          remarks: payload.comment
        };
      case "pathao":
        return {
          trackingNumber: payload.consignment_id || payload.tracking_number || "",
          status: this.mapPathaoStatus(payload.status),
          location: payload.location || "Pathao Station",
          description: payload.remarks || `Pathao checkpoint update: ${payload.status || "unknown"}`,
          remarks: payload.remarks
        };
      case "redx":
        return {
          trackingNumber: payload.tracking_id || payload.tracking_number || "",
          status: this.mapRedxStatus(payload.status),
          location: payload.location || "REDX Hub",
          description: payload.note || `REDX routing checkpoint: ${payload.status || "unknown"}`,
          remarks: payload.note
        };
      case "paperfly":
        return {
          trackingNumber: payload.tracking_number || payload.barcode || "",
          status: this.mapPaperflyStatus(payload.status),
          location: payload.hub || payload.location || "Paperfly Point",
          description: payload.comment || `Paperfly scanned: ${payload.status || "unknown"}`,
          remarks: payload.comment
        };
      case "ecourier":
        return {
          trackingNumber: payload.tracking_id || payload.ep_id || "",
          status: this.mapECourierStatus(payload.status),
          location: payload.location || payload.branch || "eCourier Office",
          description: payload.remarks || payload.status_desc || `eCourier status: ${payload.status || "unknown"}`,
          remarks: payload.remarks
        };
      case "sundarban":
        return {
          trackingNumber: payload.sdn_tracking || payload.consignment_no || "",
          status: this.mapSundarbanStatus(payload.sdn_status || payload.status),
          location: payload.location || "Sundarban Branch",
          description: payload.message || `Sundarban tracking event: ${payload.sdn_status || payload.status}`,
          remarks: payload.message
        };
      default:
        return {
          trackingNumber: payload.trackingNumber || payload.trackingId || payload.id || "",
          status: payload.status || "in_transit",
          location: payload.location || "Sorting Facility",
          description: payload.description || payload.message || "Status updated via webhook"
        };
    }
  }
  static mapSteadfastStatus(status) {
    const s = String(status).toLowerCase();
    if (s.includes("delivered") || s === "success") return "delivered";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("hold") || s.includes("pending")) return "pending_pickup";
    if (s.includes("pick") || s.includes("received")) return "picked_up";
    if (s.includes("return")) return "returned";
    if (s.includes("fail") || s.includes("reject")) return "failed_delivery";
    return "in_transit";
  }
  static mapPathaoStatus(status) {
    const s = String(status).toLowerCase();
    if (s.includes("delivered")) return "delivered";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("pending") || s.includes("created")) return "pending_pickup";
    if (s.includes("picked") || s.includes("received")) return "picked_up";
    if (s.includes("return")) return "returned";
    if (s.includes("fail") || s.includes("reject") || s.includes("undelivered")) return "failed_delivery";
    return "in_transit";
  }
  static mapRedxStatus(status) {
    const s = String(status).toLowerCase();
    if (s.includes("delivered")) return "delivered";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("ready_to_pickup") || s.includes("pending")) return "pending_pickup";
    if (s.includes("picked") || s.includes("received")) return "picked_up";
    if (s.includes("return")) return "returned";
    if (s.includes("failed") || s.includes("retry")) return "failed_delivery";
    return "in_transit";
  }
  static mapPaperflyStatus(status) {
    const s = String(status).toLowerCase();
    if (s.includes("delivered") || s === "done") return "delivered";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("pending") || s.includes("order")) return "pending_pickup";
    if (s.includes("received") || s.includes("picked")) return "picked_up";
    if (s.includes("return")) return "returned";
    if (s.includes("failed") || s.includes("undelivered")) return "failed_delivery";
    return "in_transit";
  }
  static mapECourierStatus(status) {
    const s = String(status).toLowerCase();
    if (s.includes("delivered") || s.includes("success")) return "delivered";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("pending")) return "pending_pickup";
    if (s.includes("picked") || s.includes("received")) return "picked_up";
    if (s.includes("return")) return "returned";
    if (s.includes("failed") || s.includes("undelivered") || s.includes("hold")) return "failed_delivery";
    return "in_transit";
  }
  static mapSundarbanStatus(status) {
    const s = String(status).toLowerCase();
    if (s.includes("delivered") || s === "success" || s === "delivered_ready") return "delivered";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("booking") || s === "pending") return "pending_pickup";
    if (s.includes("received") || s === "dispatched") return "picked_up";
    if (s.includes("return")) return "returned";
    if (s.includes("failed") || s.includes("unreached")) return "failed_delivery";
    return "in_transit";
  }
};

// server/logisticsRouter.ts
init_shipmentStore();
var router = Router2();
router.post("/webhooks/logistics/:courier", async (req, res) => {
  const { courier } = req.params;
  const payload = req.body;
  console.log(`[LogisticsWebhookRouter] Received webhook from: ${courier}`);
  console.log("[LogisticsWebhookRouter] Payload:", JSON.stringify(payload, null, 2));
  try {
    const normalized = WebhookNormalizer.normalize(courier, payload);
    if (!normalized.trackingNumber) {
      return res.status(400).json({
        success: false,
        message: "Could not extract tracking number from webhook payload."
      });
    }
    const service = LogisticsService.getInstance();
    const updatedShipment = await service.updateShipmentFromWebhook(
      normalized.trackingNumber,
      normalized.status,
      {
        status: normalized.status,
        location: normalized.location,
        description: normalized.description,
        remarks: normalized.remarks
      }
    );
    shipmentStore.updateFromWebhook(
      normalized.trackingNumber,
      normalized.status,
      {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: normalized.status,
        location: normalized.location || "Unknown",
        description: normalized.description || normalized.status
      }
    );
    return res.json({
      success: true,
      message: `Webhook processed and shipment updated.`,
      normalized,
      shipmentId: updatedShipment.id,
      trackingNumber: updatedShipment.trackingNumber,
      status: updatedShipment.status
    });
  } catch (error2) {
    console.error("[LogisticsWebhookRouter Error]", error2);
    return res.status(500).json({
      success: false,
      message: error2.message || "Internal server error processing webhook."
    });
  }
});
router.post("/logistics/simulate-webhook", async (req, res) => {
  const { courier, payload } = req.body;
  console.log(`[LogisticsWebhookSimulation] Simulating webhook for: ${courier}`);
  try {
    const normalized = WebhookNormalizer.normalize(courier, payload);
    if (!normalized.trackingNumber) {
      return res.status(400).json({
        success: false,
        message: "Simulation failed: Could not extract tracking number."
      });
    }
    const service = LogisticsService.getInstance();
    const updatedShipment = await service.updateShipmentFromWebhook(
      normalized.trackingNumber,
      normalized.status,
      {
        status: normalized.status,
        location: normalized.location,
        description: normalized.description,
        remarks: normalized.remarks
      }
    );
    shipmentStore.updateFromWebhook(
      normalized.trackingNumber,
      normalized.status,
      {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: normalized.status,
        location: normalized.location || "Unknown",
        description: normalized.description || normalized.status
      }
    );
    return res.json({
      success: true,
      message: `Simulated webhook processed. Shipment status is now: ${updatedShipment.status}`,
      normalized,
      shipment: updatedShipment
    });
  } catch (error2) {
    console.error("[LogisticsWebhookSimulation Error]", error2);
    return res.status(400).json({
      success: false,
      message: error2.message || "Error executing webhook simulation."
    });
  }
});

// server/catalogRouter.ts
import { Router as Router3 } from "express";

// lib/vercel-catalog/catalogDefaults.ts
init_storefrontCategories();
var nowIso3 = () => (/* @__PURE__ */ new Date()).toISOString();
var defaultCategories = () => buildDefaultCatalogCategories();
var defaultBrands = () => {
  const ts = nowIso3();
  return [
    {
      id: "brand-walton",
      slug: "walton",
      name: "Walton",
      category: "Electronics",
      description: "Made in Bangladesh, Trusted Nationwide",
      logo: "https://images.unsplash.com/photo-1560179707-f14ee839484f?w=200&h=200&fit=crop",
      coverImage: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=1200&h=400&fit=crop",
      tagline: "Made in Bangladesh, Trusted Nationwide",
      website: "https://waltonbd.com",
      socialLinks: {
        facebook: "https://facebook.com/waltonbd",
        instagram: "https://instagram.com/waltonbd",
        youtube: "https://youtube.com/@waltonbd"
      },
      story: "Walton is a leading Bangladeshi electronics brand serving households nationwide.",
      credentials: "Verified manufacturer \xB7 Nationwide service network",
      overview: {
        address: "Walton Corporate HQ, Chandra, Gazipur",
        email: "support.bd@waltonbd.com",
        phone: "09666-701701",
        priceRange: "\u09F33,000 \u2013 \u09F3180,000",
        ageFocus: "18 \u2013 60 Years",
        audience: "Households, Nationwide",
        services: ["Nationwide Service Center", "2 Year Warranty", "EMI up to 12 Months"],
        tags: ["#MadeInBD", "#Appliances", "#Trusted"]
      },
      verifiedStatus: true,
      claimStatus: "verified",
      followers: 41500,
      ratings: 4.7,
      featuredFlag: true,
      sponsoredFlag: false,
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "brand-samsung",
      slug: "samsung",
      name: "Samsung",
      category: "Electronics",
      description: "Samsung Bangladesh official storefront",
      logo: "S",
      verifiedStatus: true,
      claimStatus: "verified",
      followers: 12400,
      ratings: 4.8,
      featuredFlag: true,
      sponsoredFlag: false,
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "brand-apple",
      slug: "apple",
      name: "Apple",
      category: "Tech",
      description: "Apple products and ecosystem",
      logo: "A",
      verifiedStatus: true,
      claimStatus: "verified",
      followers: 8920,
      ratings: 4.9,
      featuredFlag: true,
      sponsoredFlag: true,
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "brand-apex",
      slug: "apex",
      name: "Apex",
      category: "Fashion",
      description: "Bangladesh fashion and footwear",
      logo: "Ap",
      verifiedStatus: true,
      claimStatus: "verified",
      followers: 5400,
      ratings: 4.6,
      featuredFlag: false,
      sponsoredFlag: false,
      createdAt: ts,
      updatedAt: ts
    }
  ];
};
var defaultProducts = () => {
  const ts = nowIso3();
  return [
    {
      id: "prod-s24-ultra",
      slug: "samsung-galaxy-s24-ultra",
      title: "Samsung Galaxy S24 Ultra",
      description: "Flagship Samsung phone with advanced camera features.",
      brandId: "brand-samsung",
      brandName: "Samsung",
      categoryId: "cat-mobile",
      categoryName: "Mobile & Phones",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop",
      gallery: [],
      modeType: "retail",
      price: 145e3,
      originalPrice: 155e3,
      stock: 42,
      status: "live",
      tags: ["NEW"],
      isDeal: true,
      dealType: "flash",
      discountPercent: 6.5,
      promoCode: "S24FLASH",
      dealValidUntil: new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString(),
      featuredFlag: true,
      isNewArrival: true,
      isBestseller: true,
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "prod-macbook-air-m3",
      slug: "apple-macbook-air-m3",
      title: "Apple MacBook Air M3",
      description: "Lightweight laptop for creators and professionals.",
      brandId: "brand-apple",
      brandName: "Apple",
      categoryId: "cat-tech",
      categoryName: "Tech & Electronics",
      image: "https://images.unsplash.com/photo-1496181133227-f83bb023945d?w=400&h=400&fit=crop",
      gallery: [],
      modeType: "retail",
      price: 128e3,
      stock: 18,
      status: "live",
      tags: ["HOT"],
      isDeal: false,
      featuredFlag: true,
      isNewArrival: false,
      isBestseller: true,
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "prod-apex-loafer",
      slug: "apex-mens-royal-loafer",
      title: "Apex Men's Royal Loafer",
      description: "Comfortable premium loafers for everyday style.",
      brandId: "brand-apex",
      brandName: "Apex",
      categoryId: "cat-fashion",
      categoryName: "Fashion & Lifestyle",
      image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop",
      gallery: [],
      modeType: "retail",
      price: 3200,
      originalPrice: 4500,
      stock: 120,
      status: "live",
      tags: ["SALE"],
      isDeal: true,
      dealType: "brand",
      discountPercent: 28,
      promoCode: "APEXFLAT400",
      dealValidUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1e3).toISOString(),
      featuredFlag: false,
      isNewArrival: true,
      isBestseller: false,
      createdAt: ts,
      updatedAt: ts
    }
  ];
};
var defaultDeals = () => {
  const ts = nowIso3();
  return [
    {
      id: "deal-s24-flash",
      slug: "s24-flash-deal",
      name: "S24 Ultra Flash Deal",
      seller: "Samsung Bangladesh",
      category: "Electronics",
      status: "live",
      type: "retail",
      discountType: "percentage",
      discountValue: 8,
      promoCode: "S24FLASH",
      productId: "prod-s24-ultra",
      brandId: "brand-samsung",
      clicks: 0,
      validFrom: ts,
      validUntil: new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString(),
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "deal-apex-eid",
      slug: "apex-eid-deal",
      name: "Apex Eid Special",
      seller: "Apex",
      category: "Fashion",
      status: "pending",
      type: "retail",
      discountType: "flat",
      discountValue: 400,
      promoCode: "APEXFLAT400",
      productId: "prod-apex-loafer",
      brandId: "brand-apex",
      clicks: 0,
      validFrom: ts,
      validUntil: new Date(Date.now() + 6 * 24 * 60 * 60 * 1e3).toISOString(),
      createdAt: ts,
      updatedAt: ts
    }
  ];
};
var defaultHomepage = () => {
  const ts = nowIso3();
  return {
    id: "default",
    heroBanners: [
      {
        id: "hero-main",
        headline: "Bangladesh's Most Trusted Product Discovery Platform",
        subtitle: "Manage this content from admin dashboard CMS.",
        ctaText: "Explore Products",
        ctaUrl: "/products",
        backgroundImage: "",
        isActive: true,
        order: 0
      }
    ],
    dealsBanners: [
      {
        id: "deals-banner-1",
        image: "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&h=320&fit=crop",
        destinationType: "custom-url",
        destinationRef: "/deals",
        order: 0,
        isActive: true,
        createdAt: ts,
        updatedAt: ts
      },
      {
        id: "deals-banner-2",
        image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=320&fit=crop",
        destinationType: "custom-url",
        destinationRef: "/deals",
        order: 1,
        isActive: true,
        createdAt: ts,
        updatedAt: ts
      },
      {
        id: "deals-banner-3",
        image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=320&fit=crop",
        destinationType: "custom-url",
        destinationRef: "/brands",
        order: 2,
        isActive: true,
        createdAt: ts,
        updatedAt: ts
      },
      {
        id: "deals-banner-4",
        image: "https://images.unsplash.com/photo-1556740714-a8395b3bf30f?w=800&h=320&fit=crop",
        destinationType: "custom-url",
        destinationRef: "/products",
        order: 3,
        isActive: true,
        createdAt: ts,
        updatedAt: ts
      }
    ],
    sections: [
      { id: "hero", label: "Hero Banner", isVisible: true, order: 0, itemIds: [] },
      { id: "categories", label: "Featured Categories", isVisible: true, order: 1, itemIds: [] },
      { id: "trending", label: "Trending Products", isVisible: true, order: 2, itemIds: ["prod-s24-ultra", "prod-macbook-air-m3"] },
      { id: "featured-brands", label: "Featured Brands", isVisible: true, order: 3, itemIds: ["brand-samsung", "brand-apple"] },
      { id: "deals", label: "Flash Deals", isVisible: true, order: 4, itemIds: ["deal-s24-flash"] },
      { id: "creators", label: "Featured Creators", isVisible: true, order: 5, itemIds: ["creator-farhan", "creator-sarah"] },
      { id: "recommended", label: "Recommended For You", isVisible: true, order: 6, itemIds: ["guide-top-smartphones-2026"] },
      { id: "newsletter", label: "Newsletter Banner", isVisible: true, order: 7, itemIds: [] }
    ],
    featuredProductIds: ["prod-s24-ultra", "prod-macbook-air-m3"],
    featuredBrandIds: ["brand-samsung", "brand-apple"],
    featuredDealIds: ["deal-s24-flash"],
    featuredCreatorIds: ["creator-farhan", "creator-sarah"],
    featuredGuideIds: ["guide-top-smartphones-2026", "guide-s24-ultra-review"],
    updatedAt: ts
  };
};
var defaultSiteConfig = () => {
  const ts = nowIso3();
  return {
    id: "default",
    navigation: [
      { id: "nav-home", label: "Home", path: "/", order: 0 },
      { id: "nav-categories", label: "Categories", path: "/categories", order: 1 },
      { id: "nav-products", label: "Browse", path: "/products", order: 2 },
      { id: "nav-brands", label: "Brands", path: "/brands", order: 3 },
      { id: "nav-guides", label: "Recommendations", path: "/guides", order: 4 },
      { id: "nav-deals", label: "Deals", path: "/deals", order: 5 },
      { id: "nav-creators", label: "Creators", path: "/creators", order: 6 }
    ],
    footer: {
      description: "Bangladesh's Smartest Product Discovery Platform. Find the best brands, compare prices, and shop with confidence.",
      copyrightText: "\xA9 2025 Choosify Bangladesh. All rights reserved.",
      columns: [
        {
          id: "discover",
          title: "Discover",
          links: [
            { label: "Top Brands", url: "/brands" },
            { label: "Browse", url: "/products" },
            { label: "New Arrivals", url: "/products" },
            { label: "Compare", url: "/compare" },
            { label: "Best Deals", url: "/deals" }
          ]
        },
        {
          id: "company",
          title: "Company",
          links: [
            { label: "Suggest a Brand", url: "/suggest-brand" },
            { label: "Partnership", url: "/partnership" },
            { label: "Advertise", url: "/advertise" }
          ]
        },
        {
          id: "legal",
          title: "Legal",
          links: [
            { label: "Terms", url: "/terms" },
            { label: "Privacy", url: "/privacy" },
            { label: "Contact", url: "/contact" },
            { label: "About", url: "/about" }
          ]
        }
      ],
      newsletterEnabled: true
    },
    socialLinks: [
      { id: "social-fb", platform: "Facebook", url: "https://www.facebook.com/choosify.bd", isVisible: true, order: 0 },
      { id: "social-ig", platform: "Instagram", url: "https://www.instagram.com/choosify.bd/", isVisible: true, order: 1 },
      { id: "social-tt", platform: "TikTok", url: "https://www.tiktok.com/@choosify5", isVisible: true, order: 2 },
      { id: "social-yt", platform: "YouTube", url: "https://www.youtube.com/@choosify5", isVisible: true, order: 3 }
    ],
    popularSearches: [
      { id: "ps-samsung", term: "Samsung", order: 0, isActive: true },
      { id: "ps-apple", term: "Apple", order: 1, isActive: true },
      { id: "ps-aarong", term: "Aarong", order: 2, isActive: true },
      { id: "ps-sailor", term: "Sailor", order: 3, isActive: true }
    ],
    seoEntries: [
      {
        pageId: "home",
        pageLabel: "Homepage",
        title: "Choosify Bangladesh \u2014 Smart Product Discovery",
        metaDescription: "Bangladesh's most trusted product discovery platform. Compare prices, read guides, and shop with confidence.",
        keywords: "choosify, bangladesh, product discovery, compare prices",
        ogImage: "",
        canonicalUrl: "https://www.choosify.bd/"
      },
      {
        pageId: "guides",
        pageLabel: "Recommendations",
        title: "Buying Guides & Recommendations | Choosify",
        metaDescription: "Expert buying guides, reviews, and recommendations for Bangladesh shoppers.",
        keywords: "buying guides, reviews, recommendations",
        ogImage: "",
        canonicalUrl: "https://www.choosify.bd/guides"
      },
      {
        pageId: "creators",
        pageLabel: "Creators",
        title: "Verified Creators | Choosify",
        metaDescription: "Discover verified creators producing trusted reviews and buying insights.",
        keywords: "creators, influencers, tech reviews",
        ogImage: "",
        canonicalUrl: "https://www.choosify.bd/creators"
      }
    ],
    announcementBarText: "",
    announcementBarEnabled: false,
    updatedAt: ts
  };
};

// lib/vercel-catalog/catalogEditorialDefaults.ts
var nowIso4 = () => (/* @__PURE__ */ new Date()).toISOString();
var defaultCreators = () => {
  const ts = nowIso4();
  return [
    {
      id: "creator-techtalks",
      slug: "tech-talks-bd",
      name: "Tech Talks BD",
      handle: "@techtalksbd",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
      coverImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop",
      role: "Creator & Product Researcher",
      location: "Dhaka, Bangladesh",
      score: 4.9,
      bestFor: "Tech",
      bestForTags: ["Smartphones", "Laptops", "PC Components"],
      platforms: ["YouTube", "Facebook"],
      bio: "Senior Tech Analyst & Digital Product Researcher with 10+ years of experience analyzing electronic imports, consumer durables, and PC components in the Bangladesh market.",
      followers: { YouTube: "482K", Facebook: "95K" },
      socialLinks: {
        youtube: "https://youtube.com/@techtalksbd",
        facebook: "https://facebook.com/techtalksbd",
        instagram: "https://instagram.com/techtalksbd"
      },
      brandPartners: [
        { name: "Samsung" },
        { name: "Xiaomi" },
        { name: "ASUS" },
        { name: "Sony" },
        { name: "Dell" },
        { name: "Acer" }
      ],
      collabTypes: ["Product Reviews", "Brand Stories", "Buying Guides", "Tech Analysis"],
      responseTime: "24 \u2013 48 hours",
      preferredContact: "Email",
      email: "farhan.outreach@choosify.bd",
      phone: "+880 1712-345678",
      category: "Tech",
      verifiedStatus: true,
      featuredFlag: true,
      videos: [],
      reels: [],
      blogs: [],
      status: "live",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "creator-farhan",
      slug: "farhan-bin-rafiq",
      name: "Farhan Bin Rafiq",
      handle: "@farhan_tech",
      avatar: "https://res.cloudinary.com/djdyqr8yd/image/upload/v1781880900/FBR_n3eycm.png",
      score: 96,
      bestFor: "Tech",
      bestForTags: ["Smartphones", "Laptops", "Gadget Guides"],
      platforms: ["YouTube", "Facebook"],
      bio: "Senior Tech Analyst & Digital Product Researcher covering electronics in Bangladesh.",
      followers: { YouTube: "450K", Facebook: "120K" },
      email: "farhan.outreach@choosify.bd",
      phone: "+880 1712-345678",
      category: "Tech",
      verifiedStatus: true,
      featuredFlag: true,
      videos: [],
      reels: [],
      blogs: [],
      status: "live",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "creator-sarah",
      slug: "sarah-jenkins",
      name: "Sarah Jenkins",
      handle: "@sarah_style",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
      score: 92,
      bestFor: "Fashion",
      bestForTags: ["Fashion", "Beauty", "Lifestyle"],
      platforms: ["Instagram", "YouTube"],
      bio: "Fashion and lifestyle reviewer focused on Bangladesh brands.",
      followers: { Instagram: "210K", YouTube: "85K" },
      category: "Fashion",
      verifiedStatus: true,
      featuredFlag: true,
      videos: [],
      reels: [],
      blogs: [],
      status: "live",
      createdAt: ts,
      updatedAt: ts
    }
  ];
};
var defaultGuides = () => {
  const ts = nowIso4();
  return [
    {
      id: "guide-top-smartphones-2026",
      slug: "top-10-smartphones-2026",
      title: "Top 10 Smartphones to Buy in 2026",
      author: "Farhan Rafiq",
      authorAvatar: "https://res.cloudinary.com/djdyqr8yd/image/upload/v1781880900/FBR_n3eycm.png",
      category: "MOBILE",
      excerpt: "The best options available right now, from titanium flagships to budget-friendly powerhouses.",
      image: "https://images.unsplash.com/photo-1556656793-062ff9f1b74b?w=1200&h=800&fit=crop",
      type: "article",
      readTime: "15 MIN READ",
      views: "125K",
      shares: "12K",
      tags: ["smartphones", "flagship", "budget"],
      creatorId: "creator-farhan",
      productIds: ["prod-s24-ultra"],
      whatWeLike: ["Excellent camera", "Long battery life"],
      whatToConsider: ["Premium pricing"],
      status: "live",
      publishedAt: ts,
      updatedAt: ts
    },
    {
      id: "guide-s24-ultra-review",
      slug: "s24-ultra-still-worth-it",
      title: "Is the S24 Ultra Still Worth It in Late 2026?",
      author: "Sarah Jenkins",
      category: "MOBILE",
      excerpt: "We revisit Samsung's titanium giant after 6 months of heavy usage.",
      image: "https://images.unsplash.com/photo-1707251759491-18d48607ea0c?w=1200&h=675&fit=crop",
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-taking-photos-with-a-smartphone-34356-large.mp4",
      duration: "12:45",
      type: "video",
      readTime: "12 MIN VIDEO",
      views: "540K",
      shares: "45K",
      tags: ["samsung", "review"],
      creatorId: "creator-sarah",
      productIds: ["prod-s24-ultra"],
      whatWeLike: ["Display quality", "Build"],
      whatToConsider: ["Weight"],
      status: "live",
      publishedAt: ts,
      updatedAt: ts
    }
  ];
};
var defaultPlacements = () => {
  const ts = nowIso4();
  const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1e3).toISOString();
  return [
    {
      id: "placement-samsung-spotlight",
      entityType: "brand",
      entityId: "brand-samsung",
      sponsorType: "spotlight_brand",
      placement: "spotlight_section",
      startDate: ts,
      endDate: end,
      hasCountdown: false,
      priority: 10,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "placement-s24-deal",
      entityType: "product",
      entityId: "prod-s24-ultra",
      sponsorType: "sponsored_deal",
      placement: "deals_section",
      startDate: ts,
      endDate: end,
      hasCountdown: true,
      dealPrice: 145e3,
      originalPrice: 155e3,
      priority: 20,
      isActive: true,
      createdAt: ts,
      updatedAt: ts
    }
  ];
};
var defaultProductDetails = () => {
  const ts = nowIso4();
  return [
    {
      productId: "prod-s24-ultra",
      relatedInfoType: "price_across_stores",
      priceAcrossStoresEnabled: false,
      whatsNearby: {
        restaurantCafe: [],
        entertainmentAttraction: [],
        hospitalPoliceStation: [],
        transportAirport: [],
        shoppingAtm: []
      },
      beforeYourVisit: {
        parkingAvailability: "",
        cancellationPolicy: "",
        whatToBring: "",
        wheelchairAccess: "",
        insuranceAccepted: ""
      },
      about: "Flagship Samsung phone with advanced camera features and titanium frame.",
      specs: [
        { key: "Display", value: '6.8" Dynamic AMOLED 2X' },
        { key: "Storage", value: "256GB" },
        { key: "Camera", value: "200MP main sensor" }
      ],
      pros: ["Excellent camera", "Premium build", "Long software support"],
      cons: ["Heavy", "High price"],
      bestForTags: ["Photography", "Power users", "Premium buyers"],
      storeComparisonList: [],
      physicalStores: [],
      overviewBlocks: [],
      optionGroups: [],
      productVariants: [],
      creatorContent: [],
      seoTitle: "Samsung Galaxy S24 Ultra Price in Bangladesh",
      seoDescription: "Compare Samsung Galaxy S24 Ultra prices and verified sellers on Choosify.",
      seoKeywords: "s24 ultra, samsung bangladesh, smartphone",
      updatedAt: ts
    }
  ];
};

// lib/vercel-catalog/catalogBrandPostDefaults.ts
var nowIso5 = () => (/* @__PURE__ */ new Date()).toISOString();
var defaultBrandPosts = () => {
  const ts = nowIso5();
  return [
    {
      id: "bp-1",
      slug: "aarong-eid-carnival-2026",
      brandId: "10",
      brandName: "Aarong",
      brandLogo: "Aa",
      kind: "festival",
      title: "Aarong Eid Carnival 2026 \u2014 Heritage Collection Preview",
      excerpt: "Experience handcrafted Eid collections, live artisan demos, and exclusive early access to limited festive pieces across Dhaka outlets.",
      heroImage: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=1200&h=700&fit=crop",
      bannerImages: [
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=1920&h=800&fit=crop",
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1920&h=800&fit=crop"
      ],
      body: [
        "Aarong invites you to the Eid Carnival 2026 \u2014 a celebration of Bangladeshi craftsmanship with curated heritage collections, trunk shows, and live weaving demonstrations.",
        "Visit participating outlets in Gulshan, Dhanmondi, and Bashundhara City for styling sessions, gift wrapping, and members-only preview hours before the public launch.",
        "Sponsored brand awareness post. Product availability varies by outlet. Terms apply."
      ],
      startDate: "2026-04-10T10:00:00",
      endDate: "2026-04-20T22:00:00",
      location: "Multiple Aarong outlets \xB7 Dhaka",
      ctaLabel: "Find nearest outlet",
      ctaUrl: "/brands/10",
      linkedProductIds: ["5", "6"],
      sponsored: true,
      status: "live",
      publishedAt: "2026-03-28",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "bp-2",
      slug: "sailor-summer-drop-preview",
      brandId: "12",
      brandName: "Sailor",
      brandLogo: "Sa",
      kind: "launch",
      title: "Sailor Summer Drop \u2014 Linen & Resort Line Preview",
      excerpt: "First look at Sailor's breathable linen shirts and resort polos. Notify-me slots open for verified Choosify shoppers.",
      heroImage: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=700&fit=crop",
      body: [
        "Sailor's Summer Drop focuses on lightweight linen blends engineered for Bangladesh's heat \u2014 wrinkle-resistant finishes and expanded tall sizing.",
        "Preview pieces will appear in select stores from April 1. Choosify users can save the drop to their dashboard for restock alerts."
      ],
      startDate: "2026-04-01T09:00:00",
      endDate: "2026-06-30T23:59:00",
      location: "Nationwide Sailor stores",
      ctaLabel: "View brand profile",
      ctaUrl: "/brands/12",
      sponsored: true,
      status: "live",
      publishedAt: "2026-03-25",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "bp-3",
      slug: "yellow-dhaka-fashion-week-styling",
      brandId: "11",
      brandName: "Yellow",
      brandLogo: "Y",
      kind: "event",
      title: "Yellow \xD7 Dhaka Fashion Week \u2014 Styling Lounge",
      excerpt: "Book a 15-minute styling session with Yellow consultants during Dhaka Fashion Week. Limited daily slots.",
      heroImage: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&h=700&fit=crop",
      body: [
        "Yellow hosts an on-site styling lounge at Dhaka Fashion Week with complimentary fit checks and accessory pairing for registered guests.",
        "Walk-ins welcome after 4 PM subject to availability. Sponsored event listing by Yellow."
      ],
      startDate: "2026-05-05T11:00:00",
      endDate: "2026-05-08T21:00:00",
      location: "ICCB, Dhaka",
      ctaLabel: "Explore Yellow",
      ctaUrl: "/brands/11",
      sponsored: true,
      status: "scheduled",
      publishedAt: "2026-03-20",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "bp-4",
      slug: "star-tech-gaming-fest",
      brandId: "15",
      brandName: "Star Tech",
      brandLogo: "ST",
      kind: "event",
      title: "Star Tech Gaming Fest \u2014 Builds, Demos & Bundle Deals",
      excerpt: "Hands-on RTX demo stations, custom PC build consults, and fest-only bundle pricing on peripherals.",
      heroImage: "https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=1200&h=700&fit=crop",
      body: [
        "Star Tech Gaming Fest returns with live benchmark demos, peripheral try-before-you-buy zones, and certified technician Q&A sessions.",
        "Fest bundles are valid in-store during event hours only. Sponsored post \u2014 prices confirmed at checkout."
      ],
      startDate: "2026-04-18T12:00:00",
      endDate: "2026-04-19T20:00:00",
      location: "Star Tech \xB7 IDB Bhaban & Multiplan",
      ctaLabel: "See Star Tech deals",
      ctaUrl: "/brands/15",
      linkedProductIds: ["1", "2", "3"],
      sponsored: true,
      status: "live",
      publishedAt: "2026-03-22",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "bp-5",
      slug: "apex-marathon-collab",
      brandId: "3",
      brandName: "Apex",
      brandLogo: "Ap",
      kind: "campaign",
      title: "Apex \xD7 City Marathon \u2014 Performance Runner Preview",
      excerpt: "Meet the upcoming Apex endurance runner developed with local athletes. Test pairs at the marathon expo zone.",
      heroImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&h=700&fit=crop",
      body: [
        "Apex showcases a marathon-focused silhouette with upgraded midsole foam and reflective upper panels at the city marathon expo.",
        "Limited tester sizes available \u2014 first come, first served. Sponsored campaign by Apex Footwear."
      ],
      startDate: "2026-05-12T08:00:00",
      endDate: "2026-05-12T18:00:00",
      location: "Hatirjheel Expo Ground",
      ctaLabel: "Visit Apex brand page",
      ctaUrl: "/brands/3",
      sponsored: true,
      status: "scheduled",
      publishedAt: "2026-03-18",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "bp-6",
      slug: "bata-back-to-school",
      brandId: "4",
      brandName: "Bata",
      brandLogo: "B",
      kind: "campaign",
      title: "Bata Back-to-School \u2014 Family Fit Day",
      excerpt: "Free foot measurement for kids, school shoe bundles, and same-day insole fitting at participating Bata stores.",
      heroImage: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&h=700&fit=crop",
      body: [
        "Bata's Back-to-School campaign offers bundled pricing on verified school shoes with extended exchange windows through May.",
        "Family Fit Day events run every Saturday morning at flagship locations."
      ],
      startDate: "2026-04-05T09:00:00",
      endDate: "2026-05-31T20:00:00",
      location: "Bata flagship stores",
      ctaLabel: "Browse Bata",
      ctaUrl: "/brands/4",
      sponsored: true,
      status: "live",
      publishedAt: "2026-03-15",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "bp-7",
      slug: "perfume-world-ramadan-gifting",
      brandId: "8",
      brandName: "Perfume World",
      brandLogo: "PW",
      kind: "store_moment",
      title: "Perfume World \u2014 Ramadan Gifting Atelier",
      excerpt: "Curated gift sets, engraving, and concierge fragrance matching for Eid gifting.",
      heroImage: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&h=700&fit=crop",
      body: [
        "Perfume World opens a seasonal gifting atelier with complimentary wrapping and scent profiling sessions.",
        "Appointment slots recommended on weekends. Sponsored store moment listing."
      ],
      startDate: "2026-03-20T10:00:00",
      endDate: "2026-04-15T21:00:00",
      location: "Banani & Gulshan branches",
      ctaLabel: "View Perfume World",
      ctaUrl: "/brands/8",
      sponsored: true,
      status: "live",
      publishedAt: "2026-03-10",
      createdAt: ts,
      updatedAt: ts
    },
    {
      id: "bp-8",
      slug: "samsung-galaxy-unpacked-bd",
      brandId: "1",
      brandName: "Samsung",
      brandLogo: "S",
      kind: "launch",
      title: "Samsung Galaxy Unpacked \u2014 Bangladesh Watch Party",
      excerpt: "Join authorized Samsung partners for the global Unpacked livestream with pre-order incentives.",
      heroImage: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&h=700&fit=crop",
      bannerImages: [
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1920&h=800&fit=crop",
        "https://images.unsplash.com/photo-1610945415295-d9bbfbe99f95?w=1920&h=800&fit=crop",
        "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=1920&h=800&fit=crop"
      ],
      body: [
        "Authorized Samsung outlets host watch parties with live Q&A, trade-in assessments, and pre-order bundles for Choosify-verified shoppers.",
        "Registration opens one week before the event. Sponsored launch awareness by Samsung."
      ],
      startDate: "2026-07-15T19:00:00",
      endDate: "2026-07-15T23:00:00",
      location: "Authorized Samsung stores \xB7 Dhaka & Chittagong",
      ctaLabel: "Explore Samsung",
      ctaUrl: "/brands/1",
      linkedProductIds: ["1"],
      sponsored: true,
      status: "scheduled",
      publishedAt: "2026-03-01",
      createdAt: ts,
      updatedAt: ts
    }
  ];
};

// lib/vercel-catalog/catalogMemoryStore.ts
var PRODUCTS_COLLECTION = "catalog_products";
var CATEGORIES_COLLECTION = "catalog_categories";
var BRANDS_COLLECTION = "catalog_brands";
var DEALS_COLLECTION = "catalog_deals";
var CREATORS_COLLECTION = "catalog_creators";
var GUIDES_COLLECTION = "catalog_guides";
var PLACEMENTS_COLLECTION = "catalog_placements";
var PRODUCT_DETAILS_COLLECTION = "catalog_product_details";
var BRAND_POSTS_COLLECTION = "catalog_brand_posts";
var memoryState = {
  products: defaultProducts(),
  categories: defaultCategories(),
  brands: defaultBrands(),
  deals: defaultDeals(),
  creators: defaultCreators(),
  guides: defaultGuides(),
  placements: defaultPlacements(),
  productDetails: defaultProductDetails(),
  brandPosts: defaultBrandPosts(),
  homepage: defaultHomepage(),
  site: defaultSiteConfig()
};
var collectionMemoryRef = (collectionName) => {
  switch (collectionName) {
    case PRODUCTS_COLLECTION:
      return memoryState.products;
    case CATEGORIES_COLLECTION:
      return memoryState.categories;
    case BRANDS_COLLECTION:
      return memoryState.brands;
    case DEALS_COLLECTION:
      return memoryState.deals;
    case CREATORS_COLLECTION:
      return memoryState.creators;
    case GUIDES_COLLECTION:
      return memoryState.guides;
    case PLACEMENTS_COLLECTION:
      return memoryState.placements;
    case PRODUCT_DETAILS_COLLECTION:
      return memoryState.productDetails;
    case BRAND_POSTS_COLLECTION:
      return memoryState.brandPosts;
    default:
      return [];
  }
};
async function listCollection2(collectionName) {
  return [...collectionMemoryRef(collectionName)];
}
async function getById(collectionName, id) {
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    const found2 = memoryState.productDetails.find((item) => item.productId === id);
    return found2 || null;
  }
  const found = collectionMemoryRef(collectionName).find((item) => item.id === id);
  return found || null;
}
async function upsert(collectionName, data) {
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    const detail = data;
    const existingIdx2 = memoryState.productDetails.findIndex((item) => item.productId === detail.productId);
    if (existingIdx2 >= 0) {
      memoryState.productDetails[existingIdx2] = { ...memoryState.productDetails[existingIdx2], ...detail };
    } else {
      memoryState.productDetails.push(detail);
    }
    return data;
  }
  const memoryCollection = collectionMemoryRef(collectionName);
  const existingIdx = memoryCollection.findIndex((item) => item.id === data.id);
  if (existingIdx >= 0) {
    memoryCollection[existingIdx] = { ...memoryCollection[existingIdx], ...data };
  } else {
    memoryCollection.push(data);
  }
  return data;
}
async function remove(collectionName, id) {
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    memoryState.productDetails = memoryState.productDetails.filter((item) => item.productId !== id);
    return;
  }
  const memoryCollection = collectionMemoryRef(collectionName);
  const filtered = memoryCollection.filter((item) => item.id !== id);
  memoryCollection.splice(0, memoryCollection.length, ...filtered);
}
var catalogStore = {
  listProducts: () => listCollection2(PRODUCTS_COLLECTION),
  getProduct: (id) => getById(PRODUCTS_COLLECTION, id),
  upsertProduct: (payload) => upsert(PRODUCTS_COLLECTION, payload),
  deleteProduct: (id) => remove(PRODUCTS_COLLECTION, id),
  listCategories: () => listCollection2(CATEGORIES_COLLECTION),
  getCategory: (id) => getById(CATEGORIES_COLLECTION, id),
  upsertCategory: (payload) => upsert(CATEGORIES_COLLECTION, payload),
  deleteCategory: (id) => remove(CATEGORIES_COLLECTION, id),
  listBrands: () => listCollection2(BRANDS_COLLECTION),
  getBrand: (id) => getById(BRANDS_COLLECTION, id),
  upsertBrand: (payload) => upsert(BRANDS_COLLECTION, payload),
  deleteBrand: (id) => remove(BRANDS_COLLECTION, id),
  listDeals: () => listCollection2(DEALS_COLLECTION),
  getDeal: (id) => getById(DEALS_COLLECTION, id),
  upsertDeal: (payload) => upsert(DEALS_COLLECTION, payload),
  deleteDeal: (id) => remove(DEALS_COLLECTION, id),
  listCreators: () => listCollection2(CREATORS_COLLECTION),
  getCreator: (id) => getById(CREATORS_COLLECTION, id),
  upsertCreator: (payload) => upsert(CREATORS_COLLECTION, payload),
  deleteCreator: (id) => remove(CREATORS_COLLECTION, id),
  listGuides: () => listCollection2(GUIDES_COLLECTION),
  getGuide: (id) => getById(GUIDES_COLLECTION, id),
  upsertGuide: (payload) => upsert(GUIDES_COLLECTION, payload),
  deleteGuide: (id) => remove(GUIDES_COLLECTION, id),
  listPlacements: () => listCollection2(PLACEMENTS_COLLECTION),
  getPlacement: (id) => getById(PLACEMENTS_COLLECTION, id),
  upsertPlacement: (payload) => upsert(PLACEMENTS_COLLECTION, payload),
  deletePlacement: (id) => remove(PLACEMENTS_COLLECTION, id),
  listProductDetails: () => listCollection2(PRODUCT_DETAILS_COLLECTION),
  getProductDetail: (productId) => getById(PRODUCT_DETAILS_COLLECTION, productId),
  upsertProductDetail: (payload) => upsert(PRODUCT_DETAILS_COLLECTION, payload),
  deleteProductDetail: (productId) => remove(PRODUCT_DETAILS_COLLECTION, productId),
  listBrandPosts: () => listCollection2(BRAND_POSTS_COLLECTION),
  getBrandPost: (id) => getById(BRAND_POSTS_COLLECTION, id),
  upsertBrandPost: (payload) => upsert(BRAND_POSTS_COLLECTION, payload),
  deleteBrandPost: (id) => remove(BRAND_POSTS_COLLECTION, id),
  async getHomepage() {
    return memoryState.homepage;
  },
  async upsertHomepage(homepage) {
    memoryState.homepage = homepage;
    return homepage;
  },
  async getSiteConfig() {
    return memoryState.site;
  },
  async upsertSiteConfig(site) {
    memoryState.site = site;
    return site;
  }
};

// lib/vercel-catalog/firebaseAdmin.ts
var databaseId2 = process.env.FIRESTORE_DATABASE_ID || "ai-studio-c2303f92-945b-405b-9b0b-230b63fef478";
function hasFirebaseAdminCredentials2() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}

// lib/vercel-catalog/catalogStore.ts
var PRODUCTS_COLLECTION3 = "catalog_products";
var CATEGORIES_COLLECTION3 = "catalog_categories";
var BRANDS_COLLECTION3 = "catalog_brands";
var DEALS_COLLECTION3 = "catalog_deals";
var CREATORS_COLLECTION3 = "catalog_creators";
var GUIDES_COLLECTION3 = "catalog_guides";
var PLACEMENTS_COLLECTION3 = "catalog_placements";
var PRODUCT_DETAILS_COLLECTION3 = "catalog_product_details";
var BRAND_POSTS_COLLECTION3 = "catalog_brand_posts";
var useAdminFirestore = process.env.CATALOG_USE_FIRESTORE === "true" && hasFirebaseAdminCredentials2();
var adminStorePromise = null;
async function getAdminStore() {
  if (!adminStorePromise) {
    adminStorePromise = Promise.resolve().then(() => (init_catalogFirestoreAdmin(), catalogFirestoreAdmin_exports)).then((mod) => mod.firestoreAdminStore);
  }
  return adminStorePromise;
}
async function listCollection3(collectionName) {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION3:
        return admin.listProducts();
      case CATEGORIES_COLLECTION3:
        return admin.listCategories();
      case BRANDS_COLLECTION3:
        return admin.listBrands();
      case DEALS_COLLECTION3:
        return admin.listDeals();
      case CREATORS_COLLECTION3:
        return admin.listCreators();
      case GUIDES_COLLECTION3:
        return admin.listGuides();
      case PLACEMENTS_COLLECTION3:
        return admin.listPlacements();
      case PRODUCT_DETAILS_COLLECTION3:
        return admin.listProductDetails();
      case BRAND_POSTS_COLLECTION3:
        return admin.listBrandPosts();
      default:
        return [];
    }
  }
  return listFromMemory(collectionName);
}
function listFromMemory(collectionName) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION3:
      return catalogStore.listProducts();
    case CATEGORIES_COLLECTION3:
      return catalogStore.listCategories();
    case BRANDS_COLLECTION3:
      return catalogStore.listBrands();
    case DEALS_COLLECTION3:
      return catalogStore.listDeals();
    case CREATORS_COLLECTION3:
      return catalogStore.listCreators();
    case GUIDES_COLLECTION3:
      return catalogStore.listGuides();
    case PLACEMENTS_COLLECTION3:
      return catalogStore.listPlacements();
    case PRODUCT_DETAILS_COLLECTION3:
      return catalogStore.listProductDetails();
    case BRAND_POSTS_COLLECTION3:
      return catalogStore.listBrandPosts();
    default:
      return Promise.resolve([]);
  }
}
function getFromMemory(collectionName, id) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION3:
      return catalogStore.getProduct(id);
    case CATEGORIES_COLLECTION3:
      return catalogStore.getCategory(id);
    case BRANDS_COLLECTION3:
      return catalogStore.getBrand(id);
    case DEALS_COLLECTION3:
      return catalogStore.getDeal(id);
    case CREATORS_COLLECTION3:
      return catalogStore.getCreator(id);
    case GUIDES_COLLECTION3:
      return catalogStore.getGuide(id);
    case PLACEMENTS_COLLECTION3:
      return catalogStore.getPlacement(id);
    case PRODUCT_DETAILS_COLLECTION3:
      return catalogStore.getProductDetail(id);
    case BRAND_POSTS_COLLECTION3:
      return catalogStore.getBrandPost(id);
    default:
      return Promise.resolve(null);
  }
}
function upsertToMemory(collectionName, data) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION3:
      return catalogStore.upsertProduct(data);
    case CATEGORIES_COLLECTION3:
      return catalogStore.upsertCategory(data);
    case BRANDS_COLLECTION3:
      return catalogStore.upsertBrand(data);
    case DEALS_COLLECTION3:
      return catalogStore.upsertDeal(data);
    case CREATORS_COLLECTION3:
      return catalogStore.upsertCreator(data);
    case GUIDES_COLLECTION3:
      return catalogStore.upsertGuide(data);
    case PLACEMENTS_COLLECTION3:
      return catalogStore.upsertPlacement(data);
    case PRODUCT_DETAILS_COLLECTION3:
      return catalogStore.upsertProductDetail(data);
    case BRAND_POSTS_COLLECTION3:
      return catalogStore.upsertBrandPost(data);
    default:
      return Promise.resolve(data);
  }
}
function removeFromMemory(collectionName, id) {
  switch (collectionName) {
    case PRODUCTS_COLLECTION3:
      return catalogStore.deleteProduct(id);
    case CATEGORIES_COLLECTION3:
      return catalogStore.deleteCategory(id);
    case BRANDS_COLLECTION3:
      return catalogStore.deleteBrand(id);
    case DEALS_COLLECTION3:
      return catalogStore.deleteDeal(id);
    case CREATORS_COLLECTION3:
      return catalogStore.deleteCreator(id);
    case GUIDES_COLLECTION3:
      return catalogStore.deleteGuide(id);
    case PLACEMENTS_COLLECTION3:
      return catalogStore.deletePlacement(id);
    case PRODUCT_DETAILS_COLLECTION3:
      return catalogStore.deleteProductDetail(id);
    case BRAND_POSTS_COLLECTION3:
      return catalogStore.deleteBrandPost(id);
    default:
      return Promise.resolve();
  }
}
async function getById2(collectionName, id) {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION3:
        return admin.getProduct(id);
      case CATEGORIES_COLLECTION3:
        return admin.getCategory(id);
      case BRANDS_COLLECTION3:
        return admin.getBrand(id);
      case DEALS_COLLECTION3:
        return admin.getDeal(id);
      case CREATORS_COLLECTION3:
        return admin.getCreator(id);
      case GUIDES_COLLECTION3:
        return admin.getGuide(id);
      case PLACEMENTS_COLLECTION3:
        return admin.getPlacement(id);
      case PRODUCT_DETAILS_COLLECTION3:
        return admin.getProductDetail(id);
      case BRAND_POSTS_COLLECTION3:
        return admin.getBrandPost(id);
      default:
        return null;
    }
  }
  return getFromMemory(collectionName, id);
}
async function upsert2(collectionName, data) {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION3:
        return admin.upsertProduct(data);
      case CATEGORIES_COLLECTION3:
        return admin.upsertCategory(data);
      case BRANDS_COLLECTION3:
        return admin.upsertBrand(data);
      case DEALS_COLLECTION3:
        return admin.upsertDeal(data);
      case CREATORS_COLLECTION3:
        return admin.upsertCreator(data);
      case GUIDES_COLLECTION3:
        return admin.upsertGuide(data);
      case PLACEMENTS_COLLECTION3:
        return admin.upsertPlacement(data);
      case PRODUCT_DETAILS_COLLECTION3:
        return admin.upsertProductDetail(data);
      case BRAND_POSTS_COLLECTION3:
        return admin.upsertBrandPost(data);
      default:
        return data;
    }
  }
  return upsertToMemory(collectionName, data);
}
async function remove2(collectionName, id) {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION3:
        return admin.deleteProduct(id);
      case CATEGORIES_COLLECTION3:
        return admin.deleteCategory(id);
      case BRANDS_COLLECTION3:
        return admin.deleteBrand(id);
      case DEALS_COLLECTION3:
        return admin.deleteDeal(id);
      case CREATORS_COLLECTION3:
        return admin.deleteCreator(id);
      case GUIDES_COLLECTION3:
        return admin.deleteGuide(id);
      case PLACEMENTS_COLLECTION3:
        return admin.deletePlacement(id);
      case PRODUCT_DETAILS_COLLECTION3:
        return admin.deleteProductDetail(id);
      case BRAND_POSTS_COLLECTION3:
        return admin.deleteBrandPost(id);
      default:
        return;
    }
  }
  return removeFromMemory(collectionName, id);
}
var catalogStore2 = {
  listProducts: () => listCollection3(PRODUCTS_COLLECTION3),
  getProduct: (id) => getById2(PRODUCTS_COLLECTION3, id),
  upsertProduct: (payload) => upsert2(PRODUCTS_COLLECTION3, payload),
  deleteProduct: (id) => remove2(PRODUCTS_COLLECTION3, id),
  listCategories: () => listCollection3(CATEGORIES_COLLECTION3),
  getCategory: (id) => getById2(CATEGORIES_COLLECTION3, id),
  upsertCategory: (payload) => upsert2(CATEGORIES_COLLECTION3, payload),
  deleteCategory: (id) => remove2(CATEGORIES_COLLECTION3, id),
  listBrands: () => listCollection3(BRANDS_COLLECTION3),
  getBrand: (id) => getById2(BRANDS_COLLECTION3, id),
  upsertBrand: (payload) => upsert2(BRANDS_COLLECTION3, payload),
  deleteBrand: (id) => remove2(BRANDS_COLLECTION3, id),
  listDeals: () => listCollection3(DEALS_COLLECTION3),
  getDeal: (id) => getById2(DEALS_COLLECTION3, id),
  upsertDeal: (payload) => upsert2(DEALS_COLLECTION3, payload),
  deleteDeal: (id) => remove2(DEALS_COLLECTION3, id),
  listCreators: () => listCollection3(CREATORS_COLLECTION3),
  getCreator: (id) => getById2(CREATORS_COLLECTION3, id),
  upsertCreator: (payload) => upsert2(CREATORS_COLLECTION3, payload),
  deleteCreator: (id) => remove2(CREATORS_COLLECTION3, id),
  listGuides: () => listCollection3(GUIDES_COLLECTION3),
  getGuide: (id) => getById2(GUIDES_COLLECTION3, id),
  upsertGuide: (payload) => upsert2(GUIDES_COLLECTION3, payload),
  deleteGuide: (id) => remove2(GUIDES_COLLECTION3, id),
  listPlacements: () => listCollection3(PLACEMENTS_COLLECTION3),
  getPlacement: (id) => getById2(PLACEMENTS_COLLECTION3, id),
  upsertPlacement: (payload) => upsert2(PLACEMENTS_COLLECTION3, payload),
  deletePlacement: (id) => remove2(PLACEMENTS_COLLECTION3, id),
  listProductDetails: () => listCollection3(PRODUCT_DETAILS_COLLECTION3),
  getProductDetail: (productId) => getById2(PRODUCT_DETAILS_COLLECTION3, productId),
  upsertProductDetail: (payload) => upsert2(PRODUCT_DETAILS_COLLECTION3, { ...payload, id: payload.productId }),
  deleteProductDetail: (productId) => remove2(PRODUCT_DETAILS_COLLECTION3, productId),
  listBrandPosts: () => listCollection3(BRAND_POSTS_COLLECTION3),
  getBrandPost: (id) => getById2(BRAND_POSTS_COLLECTION3, id),
  upsertBrandPost: (payload) => upsert2(BRAND_POSTS_COLLECTION3, payload),
  deleteBrandPost: (id) => remove2(BRAND_POSTS_COLLECTION3, id),
  async getHomepage() {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      const homepage = await admin.getHomepage();
      return homepage ?? catalogStore.getHomepage();
    }
    return catalogStore.getHomepage();
  },
  async upsertHomepage(homepage) {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      return admin.upsertHomepage(homepage);
    }
    return catalogStore.upsertHomepage(homepage);
  },
  async getSiteConfig() {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      const site = await admin.getSiteConfig();
      return site ?? catalogStore.getSiteConfig();
    }
    return catalogStore.getSiteConfig();
  },
  async upsertSiteConfig(site) {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      return admin.upsertSiteConfig(site);
    }
    return catalogStore.upsertSiteConfig(site);
  }
};

// server/catalogContract.ts
import { z as z2 } from "zod";
var nonEmpty = z2.string().trim().min(1);
var isoDate = z2.string().datetime();
var nowIso6 = () => (/* @__PURE__ */ new Date()).toISOString();
var slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
var ensureUniqueSlug = (base, takenSlugs) => {
  const normalized = slugify(base) || "item";
  const taken = new Set(takenSlugs);
  if (!taken.has(normalized)) return normalized;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = attempt === 0 ? Date.now().toString(36).slice(-5) : Math.random().toString(36).slice(2, 7);
    const candidate = `${normalized}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${normalized}-${Date.now().toString(36)}`;
};
var toString = (value, fallback) => typeof value === "string" ? value : fallback ?? "";
var toNumber = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(normalized)) return normalized;
  }
  return fallback;
};
var toBoolean = (value, fallback = false) => typeof value === "boolean" ? value : fallback;
var toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.length > 0);
};
var categorySchema = z2.object({
  id: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  description: z2.string(),
  icon: z2.string(),
  parentId: z2.string().nullable(),
  enabled: z2.boolean(),
  displayOrder: z2.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate
});
var brandSchema = z2.object({
  id: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  category: z2.string(),
  description: z2.string(),
  logo: z2.string(),
  coverImage: z2.string().optional(),
  tagline: z2.string().optional(),
  website: z2.string().optional(),
  socialLinks: z2.object({
    facebook: z2.string().optional(),
    instagram: z2.string().optional(),
    youtube: z2.string().optional(),
    tiktok: z2.string().optional(),
    linkedin: z2.string().optional()
  }).optional(),
  story: z2.string().optional(),
  /** HTTPS URL for brand story / creator-review embed on storefront */
  storyVideoUrl: z2.string().optional(),
  credentials: z2.string().optional(),
  overview: z2.object({
    address: z2.string().optional(),
    email: z2.string().optional(),
    phone: z2.string().optional(),
    priceRange: z2.string().optional(),
    ageFocus: z2.string().optional(),
    audience: z2.string().optional(),
    services: z2.array(z2.string()).optional(),
    tags: z2.array(z2.string()).optional()
  }).optional(),
  faq: z2.array(z2.object({ q: z2.string(), a: z2.string() })).optional(),
  stores: z2.object({
    authorized: z2.array(z2.object({ name: z2.string(), sub: z2.string().optional() })).optional(),
    distributors: z2.array(z2.object({ name: z2.string(), sub: z2.string().optional() })).optional(),
    serviceCenters: z2.array(z2.object({ name: z2.string(), sub: z2.string().optional(), hours: z2.string().optional() })).optional()
  }).optional(),
  promoCodes: z2.array(
    z2.object({
      id: nonEmpty,
      code: z2.string(),
      discountType: z2.enum(["Percentage", "Flat"]),
      discountValue: z2.number(),
      startDate: z2.string(),
      endDate: z2.string(),
      usageLimit: z2.number(),
      enabled: z2.boolean()
    })
  ).optional(),
  verifiedStatus: z2.boolean(),
  claimStatus: z2.enum(["community", "pending", "verified"]),
  followers: z2.number().nonnegative(),
  ratings: z2.number().min(0).max(5),
  featuredFlag: z2.boolean(),
  sponsoredFlag: z2.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate
});
var productSchema = z2.object({
  id: nonEmpty,
  slug: nonEmpty,
  title: nonEmpty,
  description: z2.string(),
  brandId: nonEmpty,
  brandName: z2.string(),
  categoryId: nonEmpty,
  categoryName: z2.string(),
  image: nonEmpty,
  gallery: z2.array(z2.string()),
  modeType: z2.literal("retail"),
  productType: z2.enum(["physical", "service"]).optional(),
  serviceCategory: z2.enum(["hotels", "restaurants", "travel", "doctors", "education", "beauty", "real_estate", "transport"]).optional(),
  relatedInfoType: z2.enum(["price_across_stores", "whats_nearby", "before_your_visit"]).optional(),
  priceAcrossStoresEnabled: z2.boolean().optional(),
  partialPaymentEnabled: z2.boolean().optional(),
  depositPercent: z2.number().optional(),
  requiredBookingFieldKeys: z2.array(z2.string()).optional(),
  requiresApproval: z2.boolean().optional(),
  price: z2.number().nonnegative(),
  originalPrice: z2.number().nonnegative().optional(),
  stock: z2.number().int(),
  status: z2.enum(["draft", "live", "archived"]),
  tags: z2.array(z2.string()),
  isDeal: z2.boolean(),
  dealType: z2.enum(["flash", "seasonal", "brand", "promo", "clearance"]).optional(),
  discountPercent: z2.number().nonnegative().optional(),
  promoCode: z2.string().optional(),
  dealValidUntil: z2.string().optional(),
  featuredFlag: z2.boolean(),
  isNewArrival: z2.boolean(),
  isBestseller: z2.boolean(),
  /** Firebase uid of owning seller when listing is seller-managed; omitted for legacy/admin rows. */
  sellerId: z2.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate
});
var dealSchema = z2.object({
  id: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  seller: z2.string(),
  category: z2.string(),
  status: z2.enum(["live", "pending", "expiring", "expired", "rejected", "draft"]),
  type: z2.literal("retail"),
  discountType: z2.enum(["percentage", "flat"]),
  discountValue: z2.number().nonnegative(),
  promoCode: z2.string().optional(),
  productId: z2.string().optional(),
  brandId: z2.string().optional(),
  clicks: z2.number().nonnegative(),
  validFrom: isoDate,
  validUntil: isoDate,
  createdAt: isoDate,
  updatedAt: isoDate
});
var heroBannerSchema = z2.object({
  id: nonEmpty,
  headline: z2.string(),
  subtitle: z2.string(),
  ctaText: z2.string(),
  ctaUrl: z2.string(),
  backgroundImage: z2.string(),
  isActive: z2.boolean(),
  order: z2.number().int()
});
var dealsBannerSchema = z2.object({
  id: nonEmpty,
  image: z2.string(),
  destinationType: z2.enum(["product", "brand", "custom-url"]),
  destinationRef: z2.string(),
  order: z2.number().int(),
  isActive: z2.boolean(),
  brandName: z2.string().optional(),
  brandLogoUrl: z2.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate
});
var sectionSchema = z2.object({
  id: nonEmpty,
  label: z2.string(),
  isVisible: z2.boolean(),
  order: z2.number().int(),
  itemIds: z2.array(z2.string())
});
var homepageSchema = z2.object({
  id: z2.literal("default"),
  heroBanners: z2.array(heroBannerSchema),
  dealsBanners: z2.array(dealsBannerSchema).default([]),
  sections: z2.array(sectionSchema),
  featuredProductIds: z2.array(z2.string()),
  featuredBrandIds: z2.array(z2.string()),
  featuredDealIds: z2.array(z2.string()),
  featuredCreatorIds: z2.array(z2.string()),
  featuredGuideIds: z2.array(z2.string()),
  updatedAt: isoDate
});
var existingOrNow = (existingDate) => existingDate ? existingDate : nowIso6();
var normalizeCategoryInput = (payload, existing) => {
  const raw = payload ?? {};
  const name = toString(raw.name, existing?.name ?? "Untitled Category");
  const id = toString(raw.id, existing?.id ?? `cat-${Date.now()}`);
  const normalized = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
    name,
    description: toString(raw.description, existing?.description ?? ""),
    icon: toString(raw.icon, existing?.icon ?? "Folder"),
    parentId: raw.parentId === null ? null : toString(raw.parentId, existing?.parentId ?? "") || null,
    enabled: toBoolean(raw.enabled, existing?.enabled ?? true),
    displayOrder: Math.floor(toNumber(raw.displayOrder, existing?.displayOrder ?? 0)),
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso6()
  };
  return categorySchema.parse(normalized);
};
var normalizeBrandInput = (payload, existing, context) => {
  const raw = payload ?? {};
  const name = toString(raw.name, existing?.name ?? "Untitled Brand");
  const id = toString(raw.id, existing?.id ?? `brand-${Date.now()}`);
  const claimStatusRaw = toString(raw.claimStatus, existing?.claimStatus ?? "community");
  const requestedSlug = toString(raw.slug, existing?.slug ?? slugify(name || id));
  const takenSlugs = (context?.existingBrandSlugs ?? []).filter(
    (slug2) => !existing || slug2 !== existing.slug
  );
  const slug = ensureUniqueSlug(requestedSlug, takenSlugs);
  const socialRaw = raw.socialLinks && typeof raw.socialLinks === "object" ? raw.socialLinks : null;
  const overviewRaw = raw.overview && typeof raw.overview === "object" ? raw.overview : null;
  const normalized = {
    id,
    slug,
    name,
    category: toString(raw.category, existing?.category ?? "General"),
    description: toString(raw.description, existing?.description ?? ""),
    logo: toString(raw.logo, existing?.logo ?? ""),
    coverImage: toString(raw.coverImage, existing?.coverImage ?? "") || void 0,
    tagline: toString(raw.tagline, existing?.tagline ?? "") || void 0,
    website: toString(raw.website, existing?.website ?? "") || void 0,
    socialLinks: socialRaw || existing?.socialLinks ? {
      facebook: toString(socialRaw?.facebook, existing?.socialLinks?.facebook ?? "") || void 0,
      instagram: toString(socialRaw?.instagram, existing?.socialLinks?.instagram ?? "") || void 0,
      youtube: toString(socialRaw?.youtube, existing?.socialLinks?.youtube ?? "") || void 0,
      tiktok: toString(socialRaw?.tiktok, existing?.socialLinks?.tiktok ?? "") || void 0,
      linkedin: toString(socialRaw?.linkedin, existing?.socialLinks?.linkedin ?? "") || void 0
    } : void 0,
    story: toString(raw.story, existing?.story ?? "") || void 0,
    storyVideoUrl: toString(raw.storyVideoUrl, existing?.storyVideoUrl ?? "") || void 0,
    credentials: toString(raw.credentials, existing?.credentials ?? "") || void 0,
    overview: overviewRaw || existing?.overview ? {
      address: toString(overviewRaw?.address, existing?.overview?.address ?? "") || void 0,
      email: toString(overviewRaw?.email, existing?.overview?.email ?? "") || void 0,
      phone: toString(overviewRaw?.phone, existing?.overview?.phone ?? "") || void 0,
      priceRange: toString(overviewRaw?.priceRange, existing?.overview?.priceRange ?? "") || void 0,
      ageFocus: toString(overviewRaw?.ageFocus, existing?.overview?.ageFocus ?? "") || void 0,
      audience: toString(overviewRaw?.audience, existing?.overview?.audience ?? "") || void 0,
      services: toStringArray(overviewRaw?.services).length ? toStringArray(overviewRaw?.services) : existing?.overview?.services,
      tags: toStringArray(overviewRaw?.tags).length ? toStringArray(overviewRaw?.tags) : existing?.overview?.tags
    } : void 0,
    faq: Array.isArray(raw.faq) ? raw.faq : existing?.faq,
    stores: raw.stores && typeof raw.stores === "object" ? raw.stores : existing?.stores,
    promoCodes: Array.isArray(raw.promoCodes) ? raw.promoCodes : existing?.promoCodes,
    verifiedStatus: toBoolean(raw.verifiedStatus, existing?.verifiedStatus ?? false),
    claimStatus: claimStatusRaw === "verified" || claimStatusRaw === "pending" ? claimStatusRaw : "community",
    followers: toNumber(raw.followers, existing?.followers ?? 0),
    ratings: Math.max(0, Math.min(5, toNumber(raw.ratings, existing?.ratings ?? 0))),
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    sponsoredFlag: toBoolean(raw.sponsoredFlag, existing?.sponsoredFlag ?? false),
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso6()
  };
  return brandSchema.parse(normalized);
};
var normalizeProductInput = (payload, existing, context) => {
  const raw = payload ?? {};
  const title = toString(raw.title, toString(raw.name, existing?.title ?? "Untitled Product"));
  const id = toString(raw.id, existing?.id ?? `prod-${Date.now()}`);
  const statusRaw = toString(raw.status, existing?.status ?? "draft").toLowerCase();
  const brandId = toString(raw.brandId, existing?.brandId ?? "");
  const categoryId = toString(raw.categoryId, existing?.categoryId ?? "");
  if (!brandId) {
    throw new Error("brandId is required and must reference an existing brand.");
  }
  if (!categoryId) {
    throw new Error("categoryId is required and must reference an existing category.");
  }
  const brands = context?.brands ?? [];
  const categories = context?.categories ?? [];
  const matchedBrand = brands.find((brand) => brand.id === brandId);
  const matchedCategory = categories.find((category) => category.id === categoryId);
  if (context && !matchedBrand) {
    throw new Error(`brandId "${brandId}" does not match an existing brand.`);
  }
  if (context && !matchedCategory) {
    throw new Error(`categoryId "${categoryId}" does not match an existing category.`);
  }
  const brandName = matchedBrand ? matchedBrand.name : toString(raw.brandName, toString(raw.brand, existing?.brandName ?? ""));
  const categoryName = matchedCategory ? matchedCategory.name : toString(raw.categoryName, toString(raw.category, existing?.categoryName ?? ""));
  const hasVariants = Array.isArray(raw.productVariants) && raw.productVariants.length > 0 || Array.isArray(raw.variants) && raw.variants.length > 0 || raw.hasVariants === true;
  const stockExplicitlyProvided = raw.stock !== void 0 && raw.stock !== null && String(raw.stock).trim() !== "";
  let stock;
  if (stockExplicitlyProvided) {
    stock = Math.floor(toNumber(raw.stock, 0));
  } else if (existing?.stock !== void 0) {
    stock = existing.stock;
  } else if (!hasVariants) {
    throw new Error(
      "STOCK_REQUIRED: Provide an explicit stock value when the product has no variants. Stock was not defaulted to 0."
    );
  } else {
    stock = 0;
  }
  const requestedSlug = toString(raw.slug, existing?.slug ?? slugify(title || id));
  const takenSlugs = (context?.existingProductSlugs ?? []).filter(
    (slug2) => !existing || slug2 !== existing.slug
  );
  const slug = ensureUniqueSlug(requestedSlug, takenSlugs);
  const normalized = {
    id,
    slug,
    title,
    description: toString(raw.description, existing?.description ?? ""),
    brandId,
    brandName,
    categoryId,
    categoryName,
    image: toString(raw.image, existing?.image ?? ""),
    gallery: toStringArray(raw.gallery).length > 0 ? toStringArray(raw.gallery) : existing?.gallery ?? [],
    modeType: "retail",
    productType: toString(raw.productType, existing?.productType),
    serviceCategory: toString(raw.serviceCategory, existing?.serviceCategory),
    relatedInfoType: toString(raw.relatedInfoType, existing?.relatedInfoType),
    priceAcrossStoresEnabled: raw.priceAcrossStoresEnabled !== void 0 ? toBoolean(raw.priceAcrossStoresEnabled) : existing?.priceAcrossStoresEnabled,
    partialPaymentEnabled: raw.partialPaymentEnabled !== void 0 ? toBoolean(raw.partialPaymentEnabled) : existing?.partialPaymentEnabled,
    depositPercent: raw.depositPercent !== void 0 ? toNumber(raw.depositPercent) : existing?.depositPercent,
    requiredBookingFieldKeys: toStringArray(raw.requiredBookingFieldKeys).length ? toStringArray(raw.requiredBookingFieldKeys) : existing?.requiredBookingFieldKeys,
    requiresApproval: raw.requiresApproval !== void 0 ? toBoolean(raw.requiresApproval) : existing?.requiresApproval,
    price: toNumber(raw.price, existing?.price ?? 0),
    originalPrice: raw.originalPrice !== void 0 ? toNumber(raw.originalPrice) : existing?.originalPrice,
    stock,
    status: statusRaw === "live" || statusRaw === "archived" ? statusRaw : "draft",
    tags: toStringArray(raw.tags).length > 0 ? toStringArray(raw.tags) : existing?.tags ?? [],
    isDeal: toBoolean(raw.isDeal, existing?.isDeal ?? false),
    dealType: toString(raw.dealType, existing?.dealType),
    discountPercent: raw.discountPercent !== void 0 ? toNumber(raw.discountPercent) : existing?.discountPercent,
    promoCode: toString(raw.promoCode, existing?.promoCode),
    dealValidUntil: toString(raw.dealValidUntil, existing?.dealValidUntil),
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    isNewArrival: toBoolean(raw.isNewArrival, existing?.isNewArrival ?? false),
    isBestseller: toBoolean(raw.isBestseller, existing?.isBestseller ?? false),
    sellerId: toString(raw.sellerId, existing?.sellerId) || void 0,
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso6()
  };
  return productSchema.parse(normalized);
};
var normalizeDealInput = (payload, existing) => {
  const raw = payload ?? {};
  const name = toString(raw.name, existing?.name ?? "Untitled Deal");
  const id = toString(raw.id, existing?.id ?? `deal-${Date.now()}`);
  const statusRaw = toString(raw.status, existing?.status ?? "draft").toLowerCase();
  const discountTypeRaw = toString(raw.discountType, existing?.discountType ?? "percentage").toLowerCase();
  const validUntil = toString(raw.validUntil, toString(raw.expiry, existing?.validUntil ?? nowIso6()));
  const normalized = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
    name,
    seller: toString(raw.seller, existing?.seller ?? "Platform"),
    category: toString(raw.category, existing?.category ?? "General"),
    status: statusRaw === "live" || statusRaw === "pending" || statusRaw === "expiring" || statusRaw === "expired" || statusRaw === "rejected" ? statusRaw : "draft",
    type: "retail",
    discountType: discountTypeRaw === "flat" ? "flat" : "percentage",
    discountValue: toNumber(raw.discountValue, toNumber(raw.discount, existing?.discountValue ?? 0)),
    promoCode: toString(raw.promoCode, existing?.promoCode),
    productId: toString(raw.productId, existing?.productId),
    brandId: toString(raw.brandId, existing?.brandId),
    clicks: toNumber(raw.clicks, existing?.clicks ?? 0),
    validFrom: toString(raw.validFrom, existing?.validFrom ?? nowIso6()),
    validUntil,
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso6()
  };
  return dealSchema.parse(normalized);
};
var normalizeHeroBannerInput = (payload, idx) => {
  const raw = payload ?? {};
  const id = toString(raw.id, `hero-${idx + 1}`);
  return heroBannerSchema.parse({
    id,
    headline: toString(raw.headline),
    subtitle: toString(raw.subtitle),
    ctaText: toString(raw.ctaText),
    ctaUrl: toString(raw.ctaUrl, "/products"),
    backgroundImage: toString(raw.backgroundImage),
    isActive: toBoolean(raw.isActive, true),
    order: Math.floor(toNumber(raw.order, idx))
  });
};
var normalizeDealsBannerInput = (payload, idx, existing) => {
  const raw = payload ?? {};
  const id = toString(raw.id, existing?.id ?? `deals-banner-${Date.now()}-${idx}`);
  const typeRaw = toString(raw.destinationType, existing?.destinationType ?? "custom-url").toLowerCase();
  const destinationType = typeRaw === "product" || typeRaw === "brand" || typeRaw === "custom-url" ? typeRaw : "custom-url";
  return dealsBannerSchema.parse({
    id,
    image: toString(raw.image, existing?.image ?? ""),
    destinationType,
    destinationRef: toString(raw.destinationRef, existing?.destinationRef ?? ""),
    order: Math.floor(toNumber(raw.order, existing?.order ?? idx)),
    isActive: toBoolean(raw.isActive, existing?.isActive ?? true),
    brandName: toString(raw.brandName, existing?.brandName ?? "") || void 0,
    brandLogoUrl: toString(raw.brandLogoUrl, existing?.brandLogoUrl ?? "") || void 0,
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso6()
  });
};
var normalizeSectionInput = (payload, idx) => {
  const raw = payload ?? {};
  const id = toString(raw.id, `section-${idx + 1}`);
  return sectionSchema.parse({
    id,
    label: toString(raw.label, id),
    isVisible: toBoolean(raw.isVisible, true),
    order: Math.floor(toNumber(raw.order, idx)),
    itemIds: toStringArray(raw.itemIds)
  });
};
var normalizeHomepageInput = (payload, existing) => {
  const raw = payload ?? {};
  const heroBannersInput = Array.isArray(raw.heroBanners) ? raw.heroBanners : existing?.heroBanners ?? [];
  const dealsBannersInput = Array.isArray(raw.dealsBanners) ? raw.dealsBanners : existing?.dealsBanners ?? [];
  const sectionsInput = Array.isArray(raw.sections) ? raw.sections : existing?.sections ?? [];
  const normalized = {
    id: "default",
    heroBanners: heroBannersInput.map(normalizeHeroBannerInput),
    dealsBanners: dealsBannersInput.map((item, idx) => {
      const existingBanner = existing?.dealsBanners?.find(
        (b) => b.id === toString(item?.id)
      );
      return normalizeDealsBannerInput(item, idx, existingBanner);
    }),
    sections: sectionsInput.map(normalizeSectionInput),
    featuredProductIds: toStringArray(raw.featuredProductIds).length > 0 ? toStringArray(raw.featuredProductIds) : existing?.featuredProductIds ?? [],
    featuredBrandIds: toStringArray(raw.featuredBrandIds).length > 0 ? toStringArray(raw.featuredBrandIds) : existing?.featuredBrandIds ?? [],
    featuredDealIds: toStringArray(raw.featuredDealIds).length > 0 ? toStringArray(raw.featuredDealIds) : existing?.featuredDealIds ?? [],
    featuredCreatorIds: toStringArray(raw.featuredCreatorIds).length > 0 ? toStringArray(raw.featuredCreatorIds) : existing?.featuredCreatorIds ?? [],
    featuredGuideIds: toStringArray(raw.featuredGuideIds).length > 0 ? toStringArray(raw.featuredGuideIds) : existing?.featuredGuideIds ?? [],
    updatedAt: nowIso6()
  };
  return homepageSchema.parse(normalized);
};
var brandPostKindSchema = z2.enum(["event", "launch", "festival", "campaign", "store_moment"]);
var brandPostStatusSchema = z2.enum(["scheduled", "live", "expired"]);
var brandPostSchema = z2.object({
  id: nonEmpty,
  slug: nonEmpty,
  brandId: nonEmpty,
  brandName: nonEmpty,
  brandLogo: z2.string().optional(),
  kind: brandPostKindSchema,
  title: nonEmpty,
  excerpt: z2.string(),
  heroImage: nonEmpty,
  bannerImages: z2.array(z2.string()).optional(),
  body: z2.array(z2.string()),
  startDate: z2.string().optional(),
  endDate: z2.string().optional(),
  location: z2.string().optional(),
  ctaLabel: z2.string().optional(),
  ctaUrl: z2.string().optional(),
  linkedProductIds: z2.array(z2.string()).optional(),
  sponsored: z2.boolean(),
  status: brandPostStatusSchema,
  publishedAt: z2.string(),
  createdAt: isoDate,
  updatedAt: isoDate
});
var normalizeBrandPostInput = (payload, existing) => {
  const raw = payload ?? {};
  const title = toString(raw.title, existing?.title ?? "Untitled Post");
  const id = toString(raw.id, existing?.id ?? `bp-${Date.now()}`);
  const kindRaw = toString(raw.kind, existing?.kind ?? "campaign");
  const statusRaw = toString(raw.status, existing?.status ?? "scheduled");
  const kindParsed = brandPostKindSchema.safeParse(kindRaw);
  const statusParsed = brandPostStatusSchema.safeParse(statusRaw);
  const normalized = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(title || id)),
    brandId: toString(raw.brandId, existing?.brandId ?? ""),
    brandName: toString(raw.brandName, existing?.brandName ?? ""),
    brandLogo: toString(raw.brandLogo, existing?.brandLogo ?? "") || void 0,
    kind: kindParsed.success ? kindParsed.data : "campaign",
    title,
    excerpt: toString(raw.excerpt, existing?.excerpt ?? ""),
    heroImage: toString(raw.heroImage, existing?.heroImage ?? ""),
    bannerImages: toStringArray(raw.bannerImages).length > 0 ? toStringArray(raw.bannerImages) : existing?.bannerImages,
    body: toStringArray(raw.body).length > 0 ? toStringArray(raw.body) : existing?.body ?? [],
    startDate: toString(raw.startDate, existing?.startDate ?? "") || void 0,
    endDate: toString(raw.endDate, existing?.endDate ?? "") || void 0,
    location: toString(raw.location, existing?.location ?? "") || void 0,
    ctaLabel: toString(raw.ctaLabel, existing?.ctaLabel ?? "") || void 0,
    ctaUrl: toString(raw.ctaUrl, existing?.ctaUrl ?? "") || void 0,
    linkedProductIds: toStringArray(raw.linkedProductIds).length > 0 ? toStringArray(raw.linkedProductIds) : existing?.linkedProductIds,
    sponsored: toBoolean(raw.sponsored, existing?.sponsored ?? false),
    status: statusParsed.success ? statusParsed.data : "scheduled",
    publishedAt: toString(raw.publishedAt, existing?.publishedAt ?? nowIso6().slice(0, 10)),
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso6()
  };
  return brandPostSchema.parse(normalized);
};

// lib/vercel-catalog/catalogEditorialContract.ts
var nowIso7 = () => (/* @__PURE__ */ new Date()).toISOString();
var toString2 = (value, fallback = "") => typeof value === "string" ? value : fallback;
var toNumber2 = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};
var toBoolean2 = (value, fallback = false) => typeof value === "boolean" ? value : fallback;
var toStringArray2 = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
var toBrandPartners = (value) => Array.isArray(value) ? value.filter((item) => !!item && typeof item === "object").map((item) => ({
  name: toString2(item.name),
  color: toString2(item.color) || void 0
})).filter((item) => item.name) : [];
var slugify2 = (value) => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
var normalizeCreatorInput = (payload, existing) => {
  const raw = payload ?? {};
  const name = toString2(raw.name, existing?.name ?? "Untitled Creator");
  const id = toString2(raw.id, existing?.id ?? `creator-${Date.now()}`);
  const statusRaw = toString2(raw.status, existing?.status ?? "live").toLowerCase();
  const socialRaw = raw.socialLinks && typeof raw.socialLinks === "object" ? raw.socialLinks : null;
  return {
    id,
    slug: toString2(raw.slug, existing?.slug ?? slugify2(name || id)),
    name,
    handle: toString2(raw.handle, existing?.handle ?? `@${slugify2(name)}`),
    avatar: toString2(raw.avatar, existing?.avatar ?? ""),
    coverImage: toString2(raw.coverImage, existing?.coverImage ?? "") || void 0,
    role: toString2(raw.role, existing?.role ?? "") || void 0,
    location: toString2(raw.location, existing?.location ?? "") || void 0,
    reviewVideoUrl: toString2(raw.reviewVideoUrl, existing?.reviewVideoUrl ?? "") || void 0,
    score: toNumber2(raw.score, existing?.score ?? 0),
    bestFor: toString2(raw.bestFor, existing?.bestFor ?? "General"),
    bestForTags: toStringArray2(raw.bestForTags).length ? toStringArray2(raw.bestForTags) : existing?.bestForTags ?? [],
    platforms: toStringArray2(raw.platforms).length ? toStringArray2(raw.platforms) : existing?.platforms ?? [],
    bio: toString2(raw.bio, existing?.bio ?? ""),
    followers: raw.followers && typeof raw.followers === "object" ? raw.followers : existing?.followers ?? {},
    socialLinks: socialRaw || existing?.socialLinks ? {
      facebook: toString2(socialRaw?.facebook, existing?.socialLinks?.facebook ?? "") || void 0,
      instagram: toString2(socialRaw?.instagram, existing?.socialLinks?.instagram ?? "") || void 0,
      youtube: toString2(socialRaw?.youtube, existing?.socialLinks?.youtube ?? "") || void 0,
      tiktok: toString2(socialRaw?.tiktok, existing?.socialLinks?.tiktok ?? "") || void 0,
      linkedin: toString2(socialRaw?.linkedin, existing?.socialLinks?.linkedin ?? "") || void 0
    } : void 0,
    brandPartners: toBrandPartners(raw.brandPartners).length ? toBrandPartners(raw.brandPartners) : existing?.brandPartners,
    collabTypes: toStringArray2(raw.collabTypes).length ? toStringArray2(raw.collabTypes) : existing?.collabTypes,
    responseTime: toString2(raw.responseTime, existing?.responseTime ?? "") || void 0,
    preferredContact: toString2(raw.preferredContact, existing?.preferredContact ?? "") || void 0,
    email: toString2(raw.email, existing?.email),
    phone: toString2(raw.phone, existing?.phone),
    category: toString2(raw.category, existing?.category),
    verifiedStatus: toBoolean2(raw.verifiedStatus, existing?.verifiedStatus ?? false),
    featuredFlag: toBoolean2(raw.featuredFlag, existing?.featuredFlag ?? false),
    videos: Array.isArray(raw.videos) ? raw.videos : existing?.videos ?? [],
    reels: Array.isArray(raw.reels) ? raw.reels : existing?.reels ?? [],
    blogs: Array.isArray(raw.blogs) ? raw.blogs : existing?.blogs ?? [],
    status: statusRaw === "draft" || statusRaw === "archived" ? statusRaw : "live",
    createdAt: existing?.createdAt ?? nowIso7(),
    updatedAt: nowIso7()
  };
};
var GUIDE_FORMATS = ["buying_guide", "product_review", "comparison", "live", "tutorial", "tips"];
var LIVE_STATUSES = ["live", "upcoming", "replay", "ended"];
var LIVE_PLATFORMS = ["youtube", "facebook", "tiktok", "instagram", "vimeo", "native"];
var toGuideSections = (value) => {
  if (!Array.isArray(value)) return void 0;
  const sections = value.filter((item) => !!item && typeof item === "object").map((item, i) => ({
    id: toString2(item.id),
    enabled: item.enabled !== false,
    order: typeof item.order === "number" ? item.order : i,
    data: item.data && typeof item.data === "object" ? item.data : void 0
  })).filter((s) => s.id);
  return sections.length ? sections : void 0;
};
var toGuideLive = (value) => {
  if (!value || typeof value !== "object") return void 0;
  const v = value;
  const statusRaw = toString2(v.status);
  const platformRaw = toString2(v.platform);
  return {
    status: LIVE_STATUSES.includes(statusRaw) ? statusRaw : void 0,
    platform: LIVE_PLATFORMS.includes(platformRaw) ? platformRaw : void 0,
    embedUrl: toString2(v.embedUrl) || void 0,
    scheduledAt: toString2(v.scheduledAt) || void 0
  };
};
var normalizeGuideInput = (payload, existing) => {
  const raw = payload ?? {};
  const title = toString2(raw.title, existing?.title ?? "Untitled Guide");
  const id = toString2(raw.id, existing?.id ?? `guide-${Date.now()}`);
  const typeRaw = toString2(raw.type, existing?.type ?? "article").toLowerCase();
  const statusRaw = toString2(raw.status, existing?.status ?? "live").toLowerCase();
  const formatRaw = toString2(raw.format, existing?.format ?? "");
  return {
    id,
    slug: toString2(raw.slug, existing?.slug ?? slugify2(title || id)),
    title,
    author: toString2(raw.author, existing?.author ?? "Choosify Editorial"),
    authorAvatar: toString2(raw.authorAvatar, existing?.authorAvatar),
    category: toString2(raw.category, existing?.category ?? "General"),
    excerpt: toString2(raw.excerpt, existing?.excerpt),
    image: toString2(raw.image, existing?.image ?? ""),
    videoUrl: toString2(raw.videoUrl, existing?.videoUrl),
    duration: toString2(raw.duration, existing?.duration),
    type: typeRaw === "reels" || typeRaw === "video" || typeRaw === "shorts" ? typeRaw : "article",
    readTime: toString2(raw.readTime, existing?.readTime ?? "5 MIN READ"),
    views: toString2(raw.views, existing?.views ?? "0"),
    shares: toString2(raw.shares, existing?.shares),
    tags: toStringArray2(raw.tags).length ? toStringArray2(raw.tags) : existing?.tags ?? [],
    creatorId: toString2(raw.creatorId, existing?.creatorId),
    productIds: toStringArray2(raw.productIds).length ? toStringArray2(raw.productIds) : existing?.productIds ?? [],
    verdict: toString2(raw.verdict, existing?.verdict),
    whatWeLike: toStringArray2(raw.whatWeLike).length ? toStringArray2(raw.whatWeLike) : existing?.whatWeLike ?? [],
    whatToConsider: toStringArray2(raw.whatToConsider).length ? toStringArray2(raw.whatToConsider) : existing?.whatToConsider ?? [],
    seoTitle: toString2(raw.seoTitle, existing?.seoTitle),
    seoDescription: toString2(raw.seoDescription, existing?.seoDescription),
    seoKeywords: toString2(raw.seoKeywords, existing?.seoKeywords),
    seoOgImage: toString2(raw.seoOgImage, existing?.seoOgImage),
    seoCanonicalUrl: toString2(raw.seoCanonicalUrl, existing?.seoCanonicalUrl),
    status: statusRaw === "draft" || statusRaw === "archived" ? statusRaw : "live",
    publishedAt: toString2(raw.publishedAt, existing?.publishedAt ?? nowIso7()),
    updatedAt: nowIso7(),
    sections: toGuideSections(raw.sections) ?? existing?.sections,
    format: GUIDE_FORMATS.includes(formatRaw) ? formatRaw : existing?.format,
    live: toGuideLive(raw.live) ?? existing?.live
  };
};
var normalizePlacementInput = (payload, existing) => {
  const raw = payload ?? {};
  const id = toString2(raw.id, existing?.id ?? `placement-${Date.now()}`);
  const entityTypeRaw = toString2(raw.entityType, existing?.entityType ?? "product").toLowerCase();
  const sponsorTypeRaw = toString2(raw.sponsorType, existing?.sponsorType ?? "sponsored_product");
  return {
    id,
    entityType: entityTypeRaw === "brand" || entityTypeRaw === "deal" || entityTypeRaw === "guide" || entityTypeRaw === "creator" ? entityTypeRaw : "product",
    entityId: toString2(raw.entityId, existing?.entityId ?? ""),
    sponsorType: sponsorTypeRaw === "sponsored_brand" || sponsorTypeRaw === "spotlight_brand" || sponsorTypeRaw === "sponsored_deal" || sponsorTypeRaw === "sponsored_recommendation" ? sponsorTypeRaw : "sponsored_product",
    placement: toString2(raw.placement, existing?.placement ?? "homepage_sponsored_ads"),
    title: toString2(raw.title, existing?.title),
    image: toString2(raw.image, existing?.image),
    startDate: toString2(raw.startDate, existing?.startDate ?? nowIso7()),
    endDate: toString2(raw.endDate, existing?.endDate ?? nowIso7()),
    hasCountdown: toBoolean2(raw.hasCountdown, existing?.hasCountdown ?? false),
    dealPrice: raw.dealPrice !== void 0 ? toNumber2(raw.dealPrice) : existing?.dealPrice,
    originalPrice: raw.originalPrice !== void 0 ? toNumber2(raw.originalPrice) : existing?.originalPrice,
    priority: Math.floor(toNumber2(raw.priority, existing?.priority ?? 0)),
    isActive: toBoolean2(raw.isActive, existing?.isActive ?? true),
    createdAt: existing?.createdAt ?? nowIso7(),
    updatedAt: nowIso7()
  };
};
var normalizeProductDetailInput = (payload, productId, existing) => {
  const raw = payload ?? {};
  const relatedInfoTypeRaw = toString2(raw.relatedInfoType, existing?.relatedInfoType);
  return {
    productId,
    relatedInfoType: relatedInfoTypeRaw === "price_across_stores" || relatedInfoTypeRaw === "whats_nearby" || relatedInfoTypeRaw === "before_your_visit" ? relatedInfoTypeRaw : existing?.relatedInfoType,
    priceAcrossStoresEnabled: raw.priceAcrossStoresEnabled !== void 0 ? toBoolean2(raw.priceAcrossStoresEnabled) : existing?.priceAcrossStoresEnabled,
    whatsNearby: raw.whatsNearby && typeof raw.whatsNearby === "object" ? raw.whatsNearby : existing?.whatsNearby,
    beforeYourVisit: raw.beforeYourVisit && typeof raw.beforeYourVisit === "object" ? raw.beforeYourVisit : existing?.beforeYourVisit,
    about: toString2(raw.about, existing?.about),
    specs: Array.isArray(raw.specs) ? raw.specs : existing?.specs ?? [],
    pros: toStringArray2(raw.pros).length ? toStringArray2(raw.pros) : existing?.pros ?? [],
    cons: toStringArray2(raw.cons).length ? toStringArray2(raw.cons) : existing?.cons ?? [],
    bestForTags: toStringArray2(raw.bestForTags).length ? toStringArray2(raw.bestForTags) : existing?.bestForTags ?? [],
    storeComparisonList: Array.isArray(raw.storeComparisonList) ? raw.storeComparisonList : existing?.storeComparisonList ?? [],
    physicalStores: Array.isArray(raw.physicalStores) ? raw.physicalStores : existing?.physicalStores ?? [],
    overviewBlocks: Array.isArray(raw.overviewBlocks) ? raw.overviewBlocks : existing?.overviewBlocks ?? [],
    optionGroups: Array.isArray(raw.optionGroups) ? raw.optionGroups : existing?.optionGroups ?? [],
    productVariants: Array.isArray(raw.productVariants) ? raw.productVariants : existing?.productVariants ?? [],
    creatorContent: Array.isArray(raw.creatorContent) ? raw.creatorContent : existing?.creatorContent ?? [],
    seoTitle: toString2(raw.seoTitle, existing?.seoTitle),
    seoDescription: toString2(raw.seoDescription, existing?.seoDescription),
    seoKeywords: toString2(raw.seoKeywords, existing?.seoKeywords),
    sizeGuide: raw.sizeGuide && typeof raw.sizeGuide === "object" ? raw.sizeGuide : existing?.sizeGuide,
    updatedAt: nowIso7(),
    enableSpecs: raw.enableSpecs !== void 0 ? toBoolean2(raw.enableSpecs) : existing?.enableSpecs,
    enableStoreComparison: raw.enableStoreComparison !== void 0 ? toBoolean2(raw.enableStoreComparison) : existing?.enableStoreComparison,
    enableInfluencerReviews: raw.enableInfluencerReviews !== void 0 ? toBoolean2(raw.enableInfluencerReviews) : existing?.enableInfluencerReviews,
    enableOverviewSection: raw.enableOverviewSection !== void 0 ? toBoolean2(raw.enableOverviewSection) : existing?.enableOverviewSection,
    enableBestForTags: raw.enableBestForTags !== void 0 ? toBoolean2(raw.enableBestForTags) : existing?.enableBestForTags,
    enablePhysicalStores: raw.enablePhysicalStores !== void 0 ? toBoolean2(raw.enablePhysicalStores) : existing?.enablePhysicalStores,
    enableBoxContents: raw.enableBoxContents !== void 0 ? toBoolean2(raw.enableBoxContents) : existing?.enableBoxContents,
    enableOptions: raw.enableOptions !== void 0 ? toBoolean2(raw.enableOptions) : existing?.enableOptions,
    enableActiveVariantSpecs: raw.enableActiveVariantSpecs !== void 0 ? toBoolean2(raw.enableActiveVariantSpecs) : existing?.enableActiveVariantSpecs,
    enableAdditionalSpecs: raw.enableAdditionalSpecs !== void 0 ? toBoolean2(raw.enableAdditionalSpecs) : existing?.enableAdditionalSpecs,
    enablePublicReviews: raw.enablePublicReviews !== void 0 ? toBoolean2(raw.enablePublicReviews) : existing?.enablePublicReviews,
    enableAddonItems: raw.enableAddonItems !== void 0 ? toBoolean2(raw.enableAddonItems) : existing?.enableAddonItems,
    boxContents: Array.isArray(raw.boxContents) ? raw.boxContents : existing?.boxContents ?? [],
    additionalSpecs: Array.isArray(raw.additionalSpecs) ? raw.additionalSpecs : existing?.additionalSpecs ?? [],
    publicReviews: Array.isArray(raw.publicReviews) ? raw.publicReviews : existing?.publicReviews ?? [],
    addonItems: Array.isArray(raw.addonItems) ? raw.addonItems : existing?.addonItems ?? []
  };
};
var normalizeSeoEntryInput = (payload, idx) => {
  const raw = payload ?? {};
  return {
    pageId: toString2(raw.pageId, `page-${idx + 1}`),
    pageLabel: toString2(raw.pageLabel, "Page"),
    title: toString2(raw.title),
    metaDescription: toString2(raw.metaDescription),
    keywords: toString2(raw.keywords),
    ogImage: toString2(raw.ogImage),
    canonicalUrl: toString2(raw.canonicalUrl)
  };
};

// lib/vercel-catalog/catalogContract.ts
import { z as z3 } from "zod";

// lib/vercel-catalog/dealsBannerUtils.ts
function resolveDealsBannerHref(banner) {
  const ref = String(banner.destinationRef || "").trim();
  if (banner.destinationType === "product") {
    return ref ? `/products/${ref}` : "/deals";
  }
  if (banner.destinationType === "brand") {
    return ref ? `/brands/${ref}` : "/brands";
  }
  if (!ref) return "/deals";
  if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;
  return `/${ref}`;
}

// lib/vercel-catalog/catalogContract.ts
var nonEmpty2 = z3.string().trim().min(1);
var isoDate2 = z3.string().datetime();
var nowIso8 = () => (/* @__PURE__ */ new Date()).toISOString();
var toString3 = (value, fallback) => typeof value === "string" ? value : fallback ?? "";
var toNumber3 = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(normalized)) return normalized;
  }
  return fallback;
};
var toBoolean3 = (value, fallback = false) => typeof value === "boolean" ? value : fallback;
var categorySchema2 = z3.object({
  id: nonEmpty2,
  slug: nonEmpty2,
  name: nonEmpty2,
  description: z3.string(),
  icon: z3.string(),
  parentId: z3.string().nullable(),
  enabled: z3.boolean(),
  displayOrder: z3.number().int(),
  createdAt: isoDate2,
  updatedAt: isoDate2
});
var brandSchema2 = z3.object({
  id: nonEmpty2,
  slug: nonEmpty2,
  name: nonEmpty2,
  category: z3.string(),
  description: z3.string(),
  logo: z3.string(),
  coverImage: z3.string().optional(),
  tagline: z3.string().optional(),
  website: z3.string().optional(),
  socialLinks: z3.object({
    facebook: z3.string().optional(),
    instagram: z3.string().optional(),
    youtube: z3.string().optional(),
    tiktok: z3.string().optional(),
    linkedin: z3.string().optional()
  }).optional(),
  story: z3.string().optional(),
  storyVideoUrl: z3.string().optional(),
  credentials: z3.string().optional(),
  overview: z3.object({
    address: z3.string().optional(),
    email: z3.string().optional(),
    phone: z3.string().optional(),
    priceRange: z3.string().optional(),
    ageFocus: z3.string().optional(),
    audience: z3.string().optional(),
    services: z3.array(z3.string()).optional(),
    tags: z3.array(z3.string()).optional()
  }).optional(),
  faq: z3.array(z3.object({ q: z3.string(), a: z3.string() })).optional(),
  stores: z3.object({
    authorized: z3.array(z3.object({ name: z3.string(), sub: z3.string().optional() })).optional(),
    distributors: z3.array(z3.object({ name: z3.string(), sub: z3.string().optional() })).optional(),
    serviceCenters: z3.array(z3.object({ name: z3.string(), sub: z3.string().optional(), hours: z3.string().optional() })).optional()
  }).optional(),
  promoCodes: z3.array(
    z3.object({
      id: nonEmpty2,
      code: z3.string(),
      discountType: z3.enum(["Percentage", "Flat"]),
      discountValue: z3.number(),
      startDate: z3.string(),
      endDate: z3.string(),
      usageLimit: z3.number(),
      enabled: z3.boolean()
    })
  ).optional(),
  verifiedStatus: z3.boolean(),
  claimStatus: z3.enum(["community", "pending", "verified"]),
  followers: z3.number().nonnegative(),
  ratings: z3.number().min(0).max(5),
  featuredFlag: z3.boolean(),
  sponsoredFlag: z3.boolean(),
  createdAt: isoDate2,
  updatedAt: isoDate2
});
var productSchema2 = z3.object({
  id: nonEmpty2,
  slug: nonEmpty2,
  title: nonEmpty2,
  description: z3.string(),
  brandId: nonEmpty2,
  brandName: z3.string(),
  categoryId: nonEmpty2,
  categoryName: z3.string(),
  image: z3.string(),
  gallery: z3.array(z3.string()),
  modeType: z3.literal("retail"),
  productType: z3.enum(["physical", "service"]).optional(),
  serviceCategory: z3.enum([
    "hotels",
    "restaurants",
    "travel",
    "doctors",
    "education",
    "beauty",
    "real_estate",
    "transport"
  ]).optional(),
  relatedInfoType: z3.enum(["price_across_stores", "whats_nearby", "before_your_visit"]).optional(),
  priceAcrossStoresEnabled: z3.boolean().optional(),
  partialPaymentEnabled: z3.boolean().optional(),
  depositPercent: z3.number().optional(),
  requiredBookingFieldKeys: z3.array(z3.string()).optional(),
  requiresApproval: z3.boolean().optional(),
  price: z3.number().nonnegative(),
  originalPrice: z3.number().nonnegative().optional(),
  stock: z3.number().int(),
  status: z3.enum(["draft", "live", "archived"]),
  tags: z3.array(z3.string()),
  isDeal: z3.boolean(),
  dealType: z3.enum(["flash", "seasonal", "brand", "promo", "clearance"]).optional(),
  discountPercent: z3.number().nonnegative().optional(),
  promoCode: z3.string().optional(),
  dealValidUntil: z3.string().optional(),
  featuredFlag: z3.boolean(),
  isNewArrival: z3.boolean(),
  isBestseller: z3.boolean(),
  createdAt: isoDate2,
  updatedAt: isoDate2
});
var dealSchema2 = z3.object({
  id: nonEmpty2,
  slug: nonEmpty2,
  name: nonEmpty2,
  seller: z3.string(),
  category: z3.string(),
  status: z3.enum(["live", "pending", "expiring", "expired", "rejected", "draft"]),
  type: z3.literal("retail"),
  discountType: z3.enum(["percentage", "flat"]),
  discountValue: z3.number().nonnegative(),
  promoCode: z3.string().optional(),
  productId: z3.string().optional(),
  brandId: z3.string().optional(),
  clicks: z3.number().nonnegative(),
  validFrom: isoDate2,
  validUntil: isoDate2,
  createdAt: isoDate2,
  updatedAt: isoDate2
});
var heroBannerSchema2 = z3.object({
  id: nonEmpty2,
  headline: z3.string(),
  subtitle: z3.string(),
  ctaText: z3.string(),
  ctaUrl: z3.string(),
  backgroundImage: z3.string(),
  isActive: z3.boolean(),
  order: z3.number().int()
});
var dealsBannerSchema2 = z3.object({
  id: nonEmpty2,
  image: z3.string(),
  destinationType: z3.enum(["product", "brand", "custom-url"]),
  destinationRef: z3.string(),
  order: z3.number().int(),
  isActive: z3.boolean(),
  brandName: z3.string().optional(),
  brandLogoUrl: z3.string().optional(),
  createdAt: isoDate2,
  updatedAt: isoDate2
});
var sectionSchema2 = z3.object({
  id: nonEmpty2,
  label: z3.string(),
  isVisible: z3.boolean(),
  order: z3.number().int(),
  itemIds: z3.array(z3.string())
});
var homepageSchema2 = z3.object({
  id: z3.literal("default"),
  heroBanners: z3.array(heroBannerSchema2),
  dealsBanners: z3.array(dealsBannerSchema2).default([]),
  sections: z3.array(sectionSchema2),
  featuredProductIds: z3.array(z3.string()),
  featuredBrandIds: z3.array(z3.string()),
  featuredDealIds: z3.array(z3.string()),
  featuredCreatorIds: z3.array(z3.string()),
  featuredGuideIds: z3.array(z3.string()),
  updatedAt: isoDate2
});
var normalizeNavItem = (payload, idx) => {
  const raw = payload ?? {};
  const id = toString3(raw.id, `nav-${idx + 1}`);
  return {
    id,
    label: toString3(raw.label, "Link"),
    path: toString3(raw.path, "/"),
    order: Math.floor(toNumber3(raw.order, idx))
  };
};
var normalizeFooterColumn = (payload, idx) => {
  const raw = payload ?? {};
  const links = Array.isArray(raw.links) ? raw.links : [];
  return {
    id: toString3(raw.id, `footer-col-${idx + 1}`),
    title: toString3(raw.title, "Links"),
    links: links.map((link) => {
      const item = link ?? {};
      return {
        label: toString3(item.label),
        url: toString3(item.url, "/")
      };
    }).filter((link) => link.label.length > 0)
  };
};
var normalizeSocialLink = (payload, idx) => {
  const raw = payload ?? {};
  return {
    id: toString3(raw.id, `social-${idx + 1}`),
    platform: toString3(raw.platform, "Facebook"),
    url: toString3(raw.url, "#"),
    isVisible: toBoolean3(raw.isVisible, true),
    order: Math.floor(toNumber3(raw.order, idx))
  };
};
var normalizePopularSearch = (payload, idx) => {
  const raw = payload ?? {};
  return {
    id: toString3(raw.id, `search-${idx + 1}`),
    term: toString3(raw.term, ""),
    order: Math.floor(toNumber3(raw.order, idx)),
    isActive: toBoolean3(raw.isActive, true)
  };
};
var normalizeProductBadge = (raw, idx) => ({
  id: toString3(raw.id, `badge-${idx + 1}`),
  label: toString3(raw.label, ""),
  color: toString3(raw.color, "#F97316"),
  icon: toString3(raw.icon, ""),
  priority: Math.floor(toNumber3(raw.priority, idx + 1)),
  isActive: toBoolean3(raw.isActive, true)
});
var normalizeWebsiteAssets = (raw, existing) => ({
  navbarLogo: toString3(raw?.navbarLogo, existing?.navbarLogo ?? ""),
  footerLogo: toString3(raw?.footerLogo, existing?.footerLogo ?? ""),
  favicon: toString3(raw?.favicon, existing?.favicon ?? ""),
  pwaIcon: toString3(raw?.pwaIcon, existing?.pwaIcon ?? ""),
  defaultProductImage: toString3(raw?.defaultProductImage, existing?.defaultProductImage ?? "")
});
var normalizeSiteInput = (payload, existing) => {
  const raw = payload ?? {};
  const footerRaw = raw.footer ?? existing?.footer ?? {};
  const columnsInput = Array.isArray(footerRaw.columns) ? footerRaw.columns : existing?.footer.columns ?? [];
  return {
    id: "default",
    navigation: (Array.isArray(raw.navigation) ? raw.navigation : existing?.navigation ?? []).map(normalizeNavItem),
    footer: {
      description: toString3(footerRaw.description, existing?.footer.description ?? ""),
      copyrightText: toString3(footerRaw.copyrightText, existing?.footer.copyrightText ?? ""),
      columns: columnsInput.map(normalizeFooterColumn),
      newsletterEnabled: toBoolean3(footerRaw.newsletterEnabled, existing?.footer.newsletterEnabled ?? true)
    },
    socialLinks: (Array.isArray(raw.socialLinks) ? raw.socialLinks : existing?.socialLinks ?? []).map(
      normalizeSocialLink
    ),
    popularSearches: (Array.isArray(raw.popularSearches) ? raw.popularSearches : existing?.popularSearches ?? []).map(
      normalizePopularSearch
    ),
    seoEntries: (Array.isArray(raw.seoEntries) ? raw.seoEntries : existing?.seoEntries ?? []).map(normalizeSeoEntryInput),
    announcementBarText: toString3(raw.announcementBarText, existing?.announcementBarText ?? ""),
    announcementBarEnabled: toBoolean3(raw.announcementBarEnabled, existing?.announcementBarEnabled ?? false),
    productBadges: (Array.isArray(raw.productBadges) ? raw.productBadges : existing?.productBadges ?? []).map(
      (item, idx) => normalizeProductBadge(item ?? {}, idx)
    ),
    websiteAssets: normalizeWebsiteAssets(
      raw.websiteAssets ?? existing?.websiteAssets,
      existing?.websiteAssets
    ),
    updatedAt: nowIso8()
  };
};

// server/catalogRouter.ts
init_mediaUpload();

// server/analytics/analyticsEvents.ts
var ANALYTICS_EVENTS = {
  PRODUCT_VIEW: "PRODUCT_VIEW",
  PRODUCT_COMPARE: "PRODUCT_COMPARE",
  PRODUCT_WISHLIST: "PRODUCT_WISHLIST",
  PRODUCT_SHARE: "PRODUCT_SHARE",
  PRODUCT_CLICK: "PRODUCT_CLICK",
  PRODUCT_SEARCH: "PRODUCT_SEARCH",
  PRODUCT_PURCHASE: "PRODUCT_PURCHASE",
  PRODUCT_REVIEW: "PRODUCT_REVIEW",
  PRODUCT_REPORT: "PRODUCT_REPORT",
  SELLER_PROFILE_VIEW: "SELLER_PROFILE_VIEW",
  SELLER_FOLLOW: "SELLER_FOLLOW",
  STORE_VISIT: "STORE_VISIT",
  CATEGORY_VIEW: "CATEGORY_VIEW",
  BRAND_VIEW: "BRAND_VIEW",
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
  SEARCH: "SEARCH",
  FILTER: "FILTER",
  NOTIFICATION_CLICK: "NOTIFICATION_CLICK",
  SELLER_VERIFIED: "SELLER_VERIFIED",
  SELLER_REJECTED: "SELLER_REJECTED",
  PRODUCT_APPROVED: "PRODUCT_APPROVED",
  PRODUCT_REJECTED: "PRODUCT_REJECTED",
  REPORT_RESOLVED: "REPORT_RESOLVED",
  REPORT_CREATED: "REPORT_CREATED",
  SEARCH_CLICK: "SEARCH_CLICK",
  SEARCH_NO_RESULT: "SEARCH_NO_RESULT",
  SEARCH_AUTOCOMPLETE_SELECT: "SEARCH_AUTOCOMPLETE_SELECT",
  SEARCH_SUGGESTION_SELECT: "SEARCH_SUGGESTION_SELECT",
  NOTIFICATION_SENT: "NOTIFICATION_SENT",
  NOTIFICATION_READ: "NOTIFICATION_READ",
  NOTIFICATION_DISMISSED: "NOTIFICATION_DISMISSED",
  BROADCAST_SENT: "BROADCAST_SENT",
  EMAIL_OPEN: "EMAIL_OPEN",
  PUSH_OPEN: "PUSH_OPEN",
  AI_REQUEST: "AI_REQUEST",
  AI_SKILL_EXECUTED: "AI_SKILL_EXECUTED",
  AI_CHAT: "AI_CHAT",
  AI_ERROR: "AI_ERROR"
};
var ANALYTICS_EVENT_VALUES = Object.values(ANALYTICS_EVENTS);
function isAnalyticsEventType(value) {
  return typeof value === "string" && ANALYTICS_EVENT_VALUES.includes(value);
}

// server/analytics/analyticsService.ts
import { randomUUID } from "crypto";

// server/lib/env.ts
var ENV_RULES = [
  { key: "NODE_ENV", description: "Runtime environment" },
  { key: "PORT", description: "HTTP server port" },
  { key: "APP_NAME", description: "Application display name" },
  { key: "APP_VERSION", description: "Application version" },
  { key: "ALLOWED_ORIGINS", requiredInProduction: true, description: "Comma-separated CORS origins" },
  // Payment gateway — optional until merchant credentials exist; status endpoint stays configured:false.
  { key: "SSLCOMMERZ_STORE_ID", description: "SSLCommerz store id (enables live/sandbox payments)" },
  { key: "SSLCOMMERZ_STORE_PASSWORD", description: "SSLCommerz store password" },
  { key: "SSLCOMMERZ_MODE", description: "sandbox | live (default sandbox)" },
  { key: "CHOOSIFY_WEB_URL", description: "Storefront base URL for payment return redirects" },
  { key: "PUBLIC_API_BASE_URL", description: "Public API base for SSLCommerz callback URLs" },
  { key: "PAYMENT_GATEWAY_MOCK", description: "true enables mock provider for harness only" }
];
function isProduction() {
  return process.env.NODE_ENV === "production";
}
function validateEnvironment() {
  const missing = [];
  for (const rule of ENV_RULES) {
    const value = process.env[rule.key]?.trim();
    if (!value && rule.requiredInProduction && isProduction()) {
      missing.push(`${rule.key} (${rule.description})`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production startup:
- ${missing.join("\n- ")}`
    );
  }
  if (isProduction() && process.env.ALLOW_DEV_LOGIN === "true") {
    console.warn("[env] ALLOW_DEV_LOGIN=true in production is discouraged.");
  }
}
function readPositiveIntEnv(key, fallback) {
  const raw = process.env[key];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}
function readBytesEnv(key, fallback) {
  const raw = process.env[key]?.trim();
  return raw || fallback;
}

// server/analytics/timeRanges.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function startOfToday(now = /* @__PURE__ */ new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function resolveTimeRange(presetInput, customFrom, customTo) {
  const now = /* @__PURE__ */ new Date();
  const preset = presetInput === "today" || presetInput === "7d" || presetInput === "30d" || presetInput === "90d" || presetInput === "12m" || presetInput === "custom" ? presetInput : "7d";
  if (preset === "custom") {
    const from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * DAY_MS);
    const to = customTo ? new Date(customTo) : now;
    return {
      preset,
      from: Number.isNaN(from.getTime()) ? new Date(now.getTime() - 7 * DAY_MS).toISOString() : from.toISOString(),
      to: Number.isNaN(to.getTime()) ? now.toISOString() : to.toISOString()
    };
  }
  if (preset === "today") {
    return { preset, from: startOfToday(now).toISOString(), to: now.toISOString() };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  return {
    preset,
    from: new Date(now.getTime() - days * DAY_MS).toISOString(),
    to: now.toISOString()
  };
}
function isWithinRange(timestamp2, range) {
  const time = new Date(timestamp2).getTime();
  return time >= new Date(range.from).getTime() && time <= new Date(range.to).getTime();
}

// server/analytics/analyticsStorage.ts
var ANALYTICS_EVENTS_COLLECTION = "analytics_events";
var DEFAULT_MAX_EVENTS = 25e3;
var analyticsEvents = [];
function maxEvents() {
  return readPositiveIntEnv("ANALYTICS_MAX_IN_MEMORY_EVENTS", DEFAULT_MAX_EVENTS);
}
async function appendAnalyticsEvent(event) {
  analyticsEvents.push(event);
  const limit = maxEvents();
  if (analyticsEvents.length > limit) {
    analyticsEvents.splice(0, analyticsEvents.length - limit);
  }
}
async function appendAnalyticsEvents(events) {
  for (const event of events) {
    await appendAnalyticsEvent(event);
  }
}
async function listAnalyticsEvents(range) {
  const snapshot = [...analyticsEvents];
  if (!range) return snapshot;
  return snapshot.filter((event) => isWithinRange(event.timestamp, range));
}
function getAnalyticsStorageStatus() {
  return {
    mode: "memory",
    collectionName: ANALYTICS_EVENTS_COLLECTION,
    retainedEvents: analyticsEvents.length,
    maxEvents: maxEvents(),
    persistence: "not_configured"
  };
}

// server/analytics/aggregationUtils.ts
function countGrouped(events, selector, eventTypes) {
  const allowed = eventTypes ? new Set(eventTypes) : null;
  const map = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (allowed && !allowed.has(event.type)) continue;
    const group = selector(event);
    if (!group.id || !group.label) continue;
    const existing = map.get(group.id) || {
      id: group.id,
      label: group.label,
      count: 0,
      growthRate: 0,
      metadata: group.metadata
    };
    existing.count += 1;
    map.set(group.id, existing);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
function topProducts(events) {
  return countGrouped(events, (event) => ({
    id: event.productId,
    label: event.productTitle || event.productId,
    metadata: { brandName: event.brandName, categoryName: event.categoryName }
  }));
}
function topCategories(events) {
  return countGrouped(events, (event) => ({
    id: event.categoryId || event.categoryName,
    label: event.categoryName || event.categoryId
  }));
}
function topBrands(events) {
  return countGrouped(events, (event) => ({
    id: event.brandId || event.brandName,
    label: event.brandName || event.brandId
  }));
}
function topSellers(events) {
  return countGrouped(events, (event) => ({
    id: event.sellerId || event.sellerName,
    label: event.sellerName || event.sellerId
  }));
}
function trendingSearches(events) {
  return countGrouped(
    events,
    (event) => ({
      id: event.searchQuery?.trim().toLowerCase(),
      label: event.searchQuery?.trim()
    }),
    [ANALYTICS_EVENTS.SEARCH, ANALYTICS_EVENTS.PRODUCT_SEARCH]
  );
}
function mostViewed(events) {
  return countGrouped(
    events,
    (event) => ({
      id: event.productId,
      label: event.productTitle || event.productId,
      metadata: { brandName: event.brandName, categoryName: event.categoryName }
    }),
    [ANALYTICS_EVENTS.PRODUCT_VIEW]
  );
}
function mostCompared(events) {
  return countGrouped(
    events,
    (event) => ({
      id: event.productId,
      label: event.productTitle || event.productId,
      metadata: { brandName: event.brandName, categoryName: event.categoryName }
    }),
    [ANALYTICS_EVENTS.PRODUCT_COMPARE]
  );
}
function mostWishlisted(events) {
  return countGrouped(
    events,
    (event) => ({
      id: event.productId,
      label: event.productTitle || event.productId,
      metadata: { brandName: event.brandName, categoryName: event.categoryName }
    }),
    [ANALYTICS_EVENTS.PRODUCT_WISHLIST]
  );
}
function countEventsByType(events) {
  return events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
}

// server/analytics/analyticsService.ts
function normalizeEvent(input) {
  if (!isAnalyticsEventType(input.type)) {
    throw new Error(`Unsupported analytics event type: ${String(input.type)}`);
  }
  return {
    ...input,
    id: randomUUID(),
    timestamp: input.timestamp || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function recordEvent(input) {
  const event = normalizeEvent(input);
  await appendAnalyticsEvent(event);
  return event;
}
function recordEventAsync(input) {
  setTimeout(() => {
    recordEvent(input).catch((error2) => {
      Logger.warn("Analytics event recording failed", {
        eventType: input.type,
        message: error2 instanceof Error ? error2.message : String(error2)
      });
    });
  }, 0);
}
async function batchRecord(inputs) {
  const events = inputs.map((input) => normalizeEvent(input));
  await appendAnalyticsEvents(events);
  return events;
}
async function aggregateEvents(range) {
  const events = await listAnalyticsEvents(range);
  return {
    topProducts: topProducts(events),
    topCategories: topCategories(events),
    topBrands: topBrands(events),
    topSellers: topSellers(events),
    trendingSearches: trendingSearches(events),
    mostViewed: mostViewed(events),
    mostCompared: mostCompared(events),
    mostWishlisted: mostWishlisted(events),
    eventCounts: countEventsByType(events)
  };
}
async function summarize(rangeInput, customFrom, customTo) {
  const range = resolveTimeRange(rangeInput, customFrom, customTo);
  const events = await listAnalyticsEvents(range);
  const uniqueUsers = new Set(events.map((event) => event.userId).filter(Boolean)).size;
  const aggregates = await aggregateEvents(range);
  return {
    range,
    totalEvents: events.length,
    uniqueUsers,
    ...aggregates,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getTrending(rangeInput, customFrom, customTo) {
  const summary = await summarize(rangeInput, customFrom, customTo);
  return {
    range: summary.range,
    topProducts: summary.topProducts.slice(0, 10),
    topCategories: summary.topCategories.slice(0, 10),
    topBrands: summary.topBrands.slice(0, 10),
    trendingSearches: summary.trendingSearches.slice(0, 10),
    topSellers: summary.topSellers.slice(0, 10),
    mostCompared: summary.mostCompared.slice(0, 10),
    mostWishlisted: summary.mostWishlisted.slice(0, 10),
    mostViewed: summary.mostViewed.slice(0, 10),
    generatedAt: summary.generatedAt
  };
}

// server/analytics/eventHooks.ts
function requestContext(req) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get("user-agent") || void 0,
    userId: req.userId || req.user?.uid
  };
}
function recordProductView(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PRODUCT_VIEW,
    ...payload,
    ...requestContext(req)
  });
}
function recordSearch(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH,
    ...payload,
    ...requestContext(req)
  });
}
function recordWishlist(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PRODUCT_WISHLIST,
    ...payload,
    ...requestContext(req)
  });
}
function recordCompare(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PRODUCT_COMPARE,
    ...payload,
    ...requestContext(req)
  });
}
function recordLogin(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.LOGIN,
    ...payload,
    ...requestContext(req)
  });
}

// server/catalogRouter.ts
init_uploadValidation();

// server/validation/catalog/productSchemas.ts
import { z as z6 } from "zod";

// server/validation/shared/schemas.ts
import { z as z5 } from "zod";

// server/validation/shared/validators.ts
import { z as z4 } from "zod";
var emailValidator = z4.string().trim().email("Invalid email address").max(320);
var passwordValidator = z4.string().min(8, "Password must be at least 8 characters").max(128);
var phoneValidator = z4.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Invalid phone number");
var slugValidator = z4.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");
var uuidValidator = z4.string().uuid("Invalid UUID");
var booleanValidator = z4.union([
  z4.boolean(),
  z4.enum(["true", "false"]).transform((value) => value === "true"),
  z4.literal("1").transform(() => true),
  z4.literal("0").transform(() => false)
]);
var positiveIntegerValidator = z4.coerce.number().int("Must be an integer").positive("Must be a positive integer");
var priceValidator = z4.coerce.number().nonnegative("Price must be zero or greater").finite("Price must be a finite number");
var dateValidator = z4.union([
  z4.string().datetime({ message: "Invalid ISO date" }),
  z4.string().date("Invalid date")
]);
var urlValidator = z4.string().trim().url("Invalid URL");
var paginationValidator = z4.object({
  limit: z4.coerce.number().int().positive().max(100).optional(),
  offset: z4.coerce.number().int().nonnegative().optional()
});
var searchValidator = z4.object({
  q: z4.string().trim().max(200).optional()
});
var sortValidator = z4.object({
  sortBy: z4.string().trim().min(1).max(64).optional(),
  sortOrder: z4.enum(["asc", "desc"]).optional()
});

// server/validation/shared/schemas.ts
var nonEmptyId = z5.string().trim().min(1, "Identifier is required").max(128);
var ProductIdSchema = nonEmptyId;

// server/validation/catalog/productSchemas.ts
var CatalogProductParamsSchema = z6.object({
  id: ProductIdSchema
});
var CatalogProductListQuerySchema = paginationValidator.merge(searchValidator).extend({
  categoryId: z6.string().trim().max(128).optional(),
  brandId: z6.string().trim().max(128).optional(),
  status: z6.string().trim().max(64).optional(),
  modeType: z6.string().trim().max(64).optional()
});

// server/validation/catalog/draftSchemas.ts
import { z as z7 } from "zod";
var DraftEntityTypeSchema = z7.enum(["brand", "product", "creator", "guide"]);
var EntityDraftParamsSchema = z7.object({
  entityType: DraftEntityTypeSchema,
  id: z7.string().trim().min(1, "Identifier is required").max(128)
});
var EntityDraftBodySchema = z7.object({
  data: z7.record(z7.string(), z7.unknown())
});
var EntityVersionBodySchema = z7.object({
  label: z7.string().trim().min(1, "Label is required").max(200),
  snapshot: z7.record(z7.string(), z7.unknown())
});

// server/middleware/authorization.ts
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.userRole) {
      sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, "Authentication required");
      return;
    }
    if (!hasRole(req.userRole, requiredRole)) {
      sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, "Insufficient role");
      return;
    }
    next();
  };
}
function requireAnyPermission(requiredPermissions) {
  return (req, res, next) => {
    if (!req.userRole) {
      sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, "Authentication required");
      return;
    }
    if (!hasAnyPermission(req.userRole, requiredPermissions, req.permissions)) {
      sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, "Insufficient permissions");
      return;
    }
    next();
  };
}

// lib/vercel-catalog/draftStore.ts
init_queryHelpers();
import { randomUUID as randomUUID2 } from "crypto";
var DRAFTS_COLLECTION = "catalog_drafts";
var VERSIONS_COLLECTION = "catalog_versions";
var DEFAULT_VERSION_LIMIT = 15;
var useAdminFirestore2 = process.env.CATALOG_USE_FIRESTORE === "true" && hasFirebaseAdminCredentials2();
var memoryDrafts = /* @__PURE__ */ new Map();
var memoryVersions = [];
function draftDocId(entityType, entityId) {
  return `${entityType}_${entityId}`;
}
var draftStore = {
  async getDraft(entityType, entityId) {
    const docId = draftDocId(entityType, entityId);
    if (useAdminFirestore2) {
      return getDocumentById(DRAFTS_COLLECTION, docId);
    }
    return memoryDrafts.get(docId) ?? null;
  },
  async upsertDraft(entityType, entityId, data, updatedBy) {
    const docId = draftDocId(entityType, entityId);
    const draft = {
      id: docId,
      entityType,
      entityId,
      data,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy
    };
    if (useAdminFirestore2) {
      return upsertDocumentById(DRAFTS_COLLECTION, docId, draft);
    }
    memoryDrafts.set(docId, draft);
    return draft;
  },
  async listVersions(entityType, entityId, limit = DEFAULT_VERSION_LIMIT) {
    if (useAdminFirestore2) {
      return listWhereOrdered(
        VERSIONS_COLLECTION,
        [
          { field: "entityType", operator: "==", value: entityType },
          { field: "entityId", operator: "==", value: entityId }
        ],
        "createdAt",
        { direction: "desc", limit }
      );
    }
    return memoryVersions.filter((version) => version.entityType === entityType && version.entityId === entityId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },
  async createVersion(entityType, entityId, label, snapshot, createdBy, createdByName) {
    const version = {
      id: `ver-${randomUUID2()}`,
      entityType,
      entityId,
      label,
      snapshot,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy,
      createdByName
    };
    if (useAdminFirestore2) {
      await upsertDocument(VERSIONS_COLLECTION, version);
    } else {
      memoryVersions.unshift(version);
    }
    return version;
  }
};

// server/catalogRouter.ts
var catalogRouter = Router3();
var requireAuth = [authenticateRequest];
var requireCmsWrite = [authenticateRequest, requireAnyPermission([PERMISSIONS.CMS_EDIT])];
var requireProductCreate = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_CREATE])
];
var requireProductEdit = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_EDIT])
];
var requireProductDelete = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_DELETE])
];
var requireCatalogMedia = [
  authenticateRequest,
  requireAnyPermission([
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.CMS_EDIT
  ])
];
var requireCatalogDraftWrite = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_EDIT, PERMISSIONS.CMS_EDIT])
];
function userIsPlatformAdmin(req) {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.ADMIN) || hasRole(role, ROLES.SUPER_ADMIN);
}
function userIsSellerRole(req) {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER);
}
function userCanMutateOwnedProduct(req, product) {
  if (userIsPlatformAdmin(req)) return true;
  if (!req.userId || !userIsSellerRole(req)) return false;
  return Boolean(product.sellerId && product.sellerId === req.userId);
}
function stampSellerOwnershipOnCreate(req, product) {
  if (userIsPlatformAdmin(req)) {
    return product;
  }
  if (userIsSellerRole(req) && req.userId) {
    return { ...product, sellerId: req.userId };
  }
  return product;
}
function preserveProductOwnershipOnUpdate(req, existing, normalized) {
  if (userIsPlatformAdmin(req)) return normalized;
  return { ...normalized, sellerId: existing.sellerId };
}
function forbidUnlessOwnsProduct(req, res, product) {
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return false;
  }
  if (!userCanMutateOwnedProduct(req, product)) {
    res.status(403).json({ error: "Not authorized to modify this product" });
    return false;
  }
  return true;
}
async function assertCatalogDraftWriteAllowed(req, res, entityType, entityId) {
  if (entityType === "product") {
    const product = await catalogStore2.getProduct(entityId);
    if (!product) {
      if (userIsPlatformAdmin(req)) return true;
      if (userIsSellerRole(req) && hasPermission(req.userRole, PERMISSIONS.PRODUCT_EDIT)) {
        return true;
      }
      res.status(404).json({ error: "Product not found" });
      return false;
    }
    if (!userCanMutateOwnedProduct(req, product)) {
      res.status(403).json({ error: "Not authorized to modify drafts for this product" });
      return false;
    }
    return true;
  }
  if (userIsPlatformAdmin(req) || hasPermission(req.userRole, PERMISSIONS.CMS_EDIT)) {
    return true;
  }
  res.status(403).json({ error: "Not authorized to modify this catalog draft" });
  return false;
}
var parseLimit = (value, fallback, max = 100) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
};
var parseOffset = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
};
var filterProducts = (products, query2) => {
  const q = typeof query2.q === "string" ? query2.q.trim().toLowerCase() : "";
  const categoryId = typeof query2.categoryId === "string" ? query2.categoryId : "";
  const brandId = typeof query2.brandId === "string" ? query2.brandId : "";
  const status = typeof query2.status === "string" ? query2.status : "";
  const modeType = typeof query2.modeType === "string" ? query2.modeType : "";
  return products.filter((product) => {
    if (q) {
      const haystack = `${product.title} ${product.description} ${product.brandName} ${product.categoryName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (status && product.status !== status) return false;
    if (modeType && product.modeType !== modeType) return false;
    return true;
  });
};
async function buildProductNormalizeContext(excludeProductId) {
  const [brands, categories, products] = await Promise.all([
    catalogStore2.listBrands(),
    catalogStore2.listCategories(),
    catalogStore2.listProducts()
  ]);
  return {
    brands,
    categories,
    existingProductSlugs: products.filter((product) => product.id !== excludeProductId).map((product) => product.slug)
  };
}
async function buildBrandNormalizeContext(excludeBrandId) {
  const brands = await catalogStore2.listBrands();
  return {
    existingBrandSlugs: brands.filter((brand) => brand.id !== excludeBrandId).map((brand) => brand.slug)
  };
}
function validationErrorMessage(error2, fallback) {
  if (error2 && typeof error2 === "object" && "issues" in error2) {
    const issues = error2.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues.map((issue) => issue.message || "Validation failed").join("; ");
    }
  }
  if (error2 instanceof Error) return error2.message;
  return fallback;
}
catalogRouter.get("/catalog/snapshot", async (_req, res) => {
  try {
    const [products, categories, brands, deals, homepage] = await Promise.all([
      catalogStore2.listProducts(),
      catalogStore2.listCategories(),
      catalogStore2.listBrands(),
      catalogStore2.listDeals(),
      catalogStore2.getHomepage()
    ]);
    res.json({ products, categories, brands, deals, homepage });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to load snapshot" });
  }
});
catalogRouter.get("/catalog/home", async (_req, res) => {
  try {
    const [homepage, products, brands, deals, creators, guides] = await Promise.all([
      catalogStore2.getHomepage(),
      catalogStore2.listProducts(),
      catalogStore2.listBrands(),
      catalogStore2.listDeals(),
      catalogStore2.listCreators(),
      catalogStore2.listGuides()
    ]);
    res.json({
      homepage,
      featuredProducts: products.filter((item) => homepage.featuredProductIds.includes(item.id)),
      featuredBrands: brands.filter((item) => homepage.featuredBrandIds.includes(item.id)),
      featuredDeals: deals.filter((item) => homepage.featuredDealIds.includes(item.id)),
      featuredCreators: creators.filter((item) => homepage.featuredCreatorIds.includes(item.id)),
      featuredGuides: guides.filter((item) => homepage.featuredGuideIds.includes(item.id))
    });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to load homepage config" });
  }
});
catalogRouter.put("/catalog/home", ...requireCmsWrite, async (req, res) => {
  try {
    const current = await catalogStore2.getHomepage().catch(() => defaultHomepage());
    const normalized = normalizeHomepageInput(req.body, current);
    const saved = await catalogStore2.upsertHomepage(normalized);
    res.json({ success: true, homepage: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid homepage payload") });
  }
});
catalogRouter.get("/catalog/products", async (req, res) => {
  try {
    const products = await catalogStore2.listProducts();
    const filtered = filterProducts(products, req.query);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q) {
      recordSearch(req, {
        searchQuery: q,
        source: "catalog_products",
        metadata: { resultCount: filtered.length }
      });
    }
    const limit = parseLimit(req.query.limit, 100);
    const offset = parseOffset(req.query.offset);
    const data = filtered.slice(offset, offset + limit);
    res.json({
      data,
      meta: { total: filtered.length, limit, offset }
    });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list products" });
  }
});
catalogRouter.get(
  "/catalog/products/:id",
  validate({ params: CatalogProductParamsSchema }),
  async (req, res) => {
    try {
      const product = await catalogStore2.getProduct(req.params.id);
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      recordProductView(req, {
        productId: product.id,
        productTitle: product.title,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        brandId: product.brandId,
        brandName: product.brandName,
        source: "catalog_product_detail"
      });
      res.json(product);
    } catch (error2) {
      res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to get product" });
    }
  }
);
catalogRouter.post("/catalog/products", ...requireProductCreate, async (req, res) => {
  try {
    const context = await buildProductNormalizeContext();
    const normalized = stampSellerOwnershipOnCreate(
      req,
      normalizeProductInput(req.body, void 0, context)
    );
    const saved = await catalogStore2.upsertProduct(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid product payload") });
  }
});
catalogRouter.put("/catalog/products/:id", ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore2.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    const context = await buildProductNormalizeContext(req.params.id);
    const normalized = preserveProductOwnershipOnUpdate(
      req,
      existing,
      normalizeProductInput({ ...req.body, id: req.params.id }, existing, context)
    );
    const saved = await catalogStore2.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid product payload") });
  }
});
catalogRouter.patch("/catalog/products/:id", ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore2.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    const context = await buildProductNormalizeContext(req.params.id);
    const normalized = preserveProductOwnershipOnUpdate(
      req,
      existing,
      normalizeProductInput({ ...existing, ...req.body, id: req.params.id }, existing, context)
    );
    const saved = await catalogStore2.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid product patch payload") });
  }
});
catalogRouter.delete("/catalog/products/:id", ...requireProductDelete, async (req, res) => {
  try {
    const existing = await catalogStore2.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    await catalogStore2.deleteProduct(req.params.id);
    res.json({ success: true });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to delete product" });
  }
});
catalogRouter.get("/catalog/categories", async (_req, res) => {
  try {
    const categories = await catalogStore2.listCategories();
    res.json({ data: categories });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list categories" });
  }
});
catalogRouter.post("/catalog/categories", ...requireCmsWrite, async (req, res) => {
  try {
    const normalized = normalizeCategoryInput(req.body);
    const saved = await catalogStore2.upsertCategory(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid category payload") });
  }
});
catalogRouter.put("/catalog/categories/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getCategory(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const normalized = normalizeCategoryInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertCategory(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid category payload") });
  }
});
catalogRouter.patch("/catalog/categories/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getCategory(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const normalized = normalizeCategoryInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertCategory(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid category patch payload") });
  }
});
catalogRouter.delete("/catalog/categories/:id", ...requireCmsWrite, async (req, res) => {
  try {
    await catalogStore2.deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to delete category" });
  }
});
catalogRouter.get("/catalog/brands", async (_req, res) => {
  try {
    const brands = await catalogStore2.listBrands();
    res.json({ data: brands });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list brands" });
  }
});
catalogRouter.post("/catalog/brands", ...requireCmsWrite, async (req, res) => {
  try {
    const context = await buildBrandNormalizeContext();
    const normalized = normalizeBrandInput(req.body, void 0, context);
    const saved = await catalogStore2.upsertBrand(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid brand payload") });
  }
});
catalogRouter.put("/catalog/brands/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    const context = await buildBrandNormalizeContext(req.params.id);
    const normalized = normalizeBrandInput({ ...req.body, id: req.params.id }, existing, context);
    const saved = await catalogStore2.upsertBrand(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid brand payload") });
  }
});
catalogRouter.patch("/catalog/brands/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    const context = await buildBrandNormalizeContext(req.params.id);
    const normalized = normalizeBrandInput({ ...existing, ...req.body, id: req.params.id }, existing, context);
    const saved = await catalogStore2.upsertBrand(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid brand patch payload") });
  }
});
catalogRouter.delete("/catalog/brands/:id", ...requireCmsWrite, async (req, res) => {
  try {
    await catalogStore2.deleteBrand(req.params.id);
    res.json({ success: true });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to delete brand" });
  }
});
catalogRouter.get("/catalog/deals", async (_req, res) => {
  try {
    const deals = await catalogStore2.listDeals();
    res.json({ data: deals });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list deals" });
  }
});
catalogRouter.post("/catalog/deals", ...requireCmsWrite, async (req, res) => {
  try {
    const normalized = normalizeDealInput(req.body);
    const saved = await catalogStore2.upsertDeal(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid deal payload") });
  }
});
catalogRouter.put("/catalog/deals/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getDeal(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    const normalized = normalizeDealInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertDeal(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid deal payload") });
  }
});
catalogRouter.patch("/catalog/deals/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getDeal(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    const normalized = normalizeDealInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertDeal(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid deal patch payload") });
  }
});
catalogRouter.delete("/catalog/deals/:id", ...requireCmsWrite, async (req, res) => {
  try {
    await catalogStore2.deleteDeal(req.params.id);
    res.json({ success: true });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to delete deal" });
  }
});
var MAX_ACTIVE_DEALS_BANNERS = 5;
async function readHomepageWithDealsBanners() {
  const current = await catalogStore2.getHomepage().catch(() => defaultHomepage());
  return normalizeHomepageInput(current, current);
}
function activeDealsBannerCount(banners, excludeId) {
  return banners.filter((b) => b.isActive && b.id !== excludeId).length;
}
function rejectIfTooManyActiveDeals(res, banners, next) {
  if (!next.isActive) return false;
  if (activeDealsBannerCount(banners, next.id) < MAX_ACTIVE_DEALS_BANNERS) return false;
  res.status(400).json({
    error: `At most ${MAX_ACTIVE_DEALS_BANNERS} active Today's Deals banners are allowed. Deactivate another first.`
  });
  return true;
}
catalogRouter.get("/catalog/deals-banners", async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const activeOnly = String(req.query.active || "true").toLowerCase() !== "false";
    let banners = (homepage.dealsBanners || []).filter((b) => activeOnly ? b.isActive : true).slice().sort((a, b) => a.order - b.order).map((b) => ({
      ...b,
      href: resolveDealsBannerHref(b)
    }));
    if (activeOnly) {
      banners = banners.slice(0, MAX_ACTIVE_DEALS_BANNERS);
    }
    res.json({ data: banners });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list deals banners" });
  }
});
catalogRouter.post("/catalog/deals-banners", ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const nextOrder = homepage.dealsBanners.reduce((max, b) => Math.max(max, b.order), -1) + 1;
    const banner = normalizeDealsBannerInput(
      { ...req.body, order: req.body?.order ?? nextOrder },
      homepage.dealsBanners.length
    );
    if (!banner.image.trim()) {
      res.status(400).json({ error: "image is required" });
      return;
    }
    if (rejectIfTooManyActiveDeals(res, homepage.dealsBanners, banner)) return;
    const dealsBanners = [...homepage.dealsBanners, banner].sort((a, b) => a.order - b.order);
    const saved = await catalogStore2.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage)
    );
    const created2 = saved.dealsBanners.find((b) => b.id === banner.id) || banner;
    res.status(201).json({ success: true, data: { ...created2, href: resolveDealsBannerHref(created2) } });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid deals banner payload") });
  }
});
catalogRouter.put("/catalog/deals-banners/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const existing = homepage.dealsBanners.find((b) => b.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Deals banner not found" });
      return;
    }
    const idx = homepage.dealsBanners.findIndex((b) => b.id === req.params.id);
    const banner = normalizeDealsBannerInput({ ...req.body, id: req.params.id }, idx, existing);
    if (rejectIfTooManyActiveDeals(res, homepage.dealsBanners, banner)) return;
    const dealsBanners = homepage.dealsBanners.map((b) => b.id === banner.id ? banner : b).sort((a, b) => a.order - b.order);
    const saved = await catalogStore2.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage)
    );
    const updated = saved.dealsBanners.find((b) => b.id === banner.id) || banner;
    res.json({ success: true, data: { ...updated, href: resolveDealsBannerHref(updated) } });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid deals banner payload") });
  }
});
catalogRouter.patch("/catalog/deals-banners/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const existing = homepage.dealsBanners.find((b) => b.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Deals banner not found" });
      return;
    }
    const idx = homepage.dealsBanners.findIndex((b) => b.id === req.params.id);
    const banner = normalizeDealsBannerInput({ ...existing, ...req.body, id: req.params.id }, idx, existing);
    if (rejectIfTooManyActiveDeals(res, homepage.dealsBanners, banner)) return;
    const dealsBanners = homepage.dealsBanners.map((b) => b.id === banner.id ? banner : b).sort((a, b) => a.order - b.order);
    const saved = await catalogStore2.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage)
    );
    const updated = saved.dealsBanners.find((b) => b.id === banner.id) || banner;
    res.json({ success: true, data: { ...updated, href: resolveDealsBannerHref(updated) } });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid deals banner patch") });
  }
});
catalogRouter.delete("/catalog/deals-banners/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    if (!homepage.dealsBanners.some((b) => b.id === req.params.id)) {
      res.status(404).json({ error: "Deals banner not found" });
      return;
    }
    const dealsBanners = homepage.dealsBanners.filter((b) => b.id !== req.params.id);
    await catalogStore2.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage)
    );
    res.json({ success: true });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to delete deals banner" });
  }
});
catalogRouter.get("/catalog/site", async (_req, res) => {
  try {
    res.json({ site: await catalogStore2.getSiteConfig() });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to load site config" });
  }
});
catalogRouter.put("/catalog/site", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getSiteConfig();
    const normalized = normalizeSiteInput(req.body, existing);
    const saved = await catalogStore2.upsertSiteConfig(normalized);
    res.json({ success: true, site: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid site config payload") });
  }
});
catalogRouter.get("/catalog/creators", async (req, res) => {
  try {
    const creators = await catalogStore2.listCreators();
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const filtered = status ? creators.filter((c) => c.status === status) : creators;
    res.json({ data: filtered });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list creators" });
  }
});
catalogRouter.put("/catalog/creators/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getCreator(req.params.id);
    const normalized = normalizeCreatorInput({ ...req.body, id: req.params.id }, existing || void 0);
    const saved = await catalogStore2.upsertCreator(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid creator payload") });
  }
});
catalogRouter.patch("/catalog/creators/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getCreator(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }
    const normalized = normalizeCreatorInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertCreator(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid creator patch payload") });
  }
});
catalogRouter.get("/catalog/guides", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "live";
    const guides = (await catalogStore2.listGuides()).filter((guide) => !status || guide.status === status);
    res.json({ data: guides });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list guides" });
  }
});
catalogRouter.get("/catalog/guides/:id", async (req, res) => {
  try {
    const guide = await catalogStore2.getGuide(req.params.id);
    if (!guide) {
      res.status(404).json({ error: "Guide not found" });
      return;
    }
    res.json(guide);
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to get guide" });
  }
});
catalogRouter.put("/catalog/guides/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getGuide(req.params.id);
    const normalized = normalizeGuideInput({ ...req.body, id: req.params.id }, existing || void 0);
    const saved = await catalogStore2.upsertGuide(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid guide payload") });
  }
});
catalogRouter.patch("/catalog/guides/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getGuide(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Guide not found" });
      return;
    }
    const normalized = normalizeGuideInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertGuide(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid guide patch payload") });
  }
});
catalogRouter.get(
  "/catalog/:entityType/:id/draft",
  ...requireAuth,
  validate({ params: EntityDraftParamsSchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params;
      const draft = await draftStore.getDraft(entityType, id);
      res.json({ data: draft });
    } catch (error2) {
      res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to load draft" });
    }
  }
);
catalogRouter.put(
  "/catalog/:entityType/:id/draft",
  ...requireCatalogDraftWrite,
  validate({ params: EntityDraftParamsSchema, body: EntityDraftBodySchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params;
      if (!await assertCatalogDraftWriteAllowed(req, res, entityType, id)) return;
      const saved = await draftStore.upsertDraft(entityType, id, req.body.data, req.userId ?? "unknown");
      res.json({ success: true, data: saved });
    } catch (error2) {
      res.status(400).json({ error: validationErrorMessage(error2, "Invalid draft payload") });
    }
  }
);
catalogRouter.get(
  "/catalog/:entityType/:id/versions",
  ...requireAuth,
  validate({ params: EntityDraftParamsSchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params;
      const versions = await draftStore.listVersions(entityType, id);
      res.json({ data: versions });
    } catch (error2) {
      res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list versions" });
    }
  }
);
catalogRouter.post(
  "/catalog/:entityType/:id/versions",
  ...requireCatalogDraftWrite,
  validate({ params: EntityDraftParamsSchema, body: EntityVersionBodySchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params;
      if (!await assertCatalogDraftWriteAllowed(req, res, entityType, id)) return;
      const version = await draftStore.createVersion(
        entityType,
        id,
        req.body.label,
        req.body.snapshot,
        req.userId ?? "unknown",
        req.user?.displayName
      );
      res.status(201).json({ success: true, data: version });
    } catch (error2) {
      res.status(400).json({ error: validationErrorMessage(error2, "Invalid version payload") });
    }
  }
);
catalogRouter.get("/catalog/placements", async (req, res) => {
  try {
    const placements = await catalogStore2.listPlacements();
    const placement = typeof req.query.placement === "string" ? req.query.placement : "";
    const activeOnly = req.query.active === "true";
    const filtered = placements.filter((item) => {
      if (placement && item.placement !== placement) return false;
      if (activeOnly && !item.isActive) return false;
      return true;
    });
    res.json({ data: filtered });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list placements" });
  }
});
catalogRouter.put("/catalog/placements/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getPlacement(req.params.id);
    const normalized = normalizePlacementInput({ ...req.body, id: req.params.id }, existing || void 0);
    const saved = await catalogStore2.upsertPlacement(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid placement payload") });
  }
});
catalogRouter.patch("/catalog/placements/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getPlacement(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Placement not found" });
      return;
    }
    const normalized = normalizePlacementInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertPlacement(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid placement patch payload") });
  }
});
catalogRouter.post("/catalog/media/upload", ...requireCatalogMedia, async (req, res) => {
  try {
    const { data, mimeType, fileName } = req.body;
    const validation = validateImageUploadInput({
      base64Data: data || "",
      mimeType,
      fileName
    });
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const url = await uploadImageToCloudinary({
      base64Data: data,
      mimeType: validation.mimeType,
      fileName: validation.fileName
    });
    res.json({ success: true, url });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to upload image" });
  }
});
catalogRouter.get("/catalog/product-details/:productId", async (req, res) => {
  try {
    const detail = await catalogStore2.getProductDetail(req.params.productId);
    if (!detail) {
      res.status(404).json({ error: "Product detail not found" });
      return;
    }
    res.json(detail);
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to get product detail" });
  }
});
catalogRouter.put("/catalog/product-details/:productId", ...requireProductEdit, async (req, res) => {
  try {
    const product = await catalogStore2.getProduct(req.params.productId);
    if (!forbidUnlessOwnsProduct(req, res, product)) return;
    const existing = await catalogStore2.getProductDetail(req.params.productId);
    const normalized = normalizeProductDetailInput(
      { ...req.body, productId: req.params.productId },
      req.params.productId,
      existing || void 0
    );
    const saved = await catalogStore2.upsertProductDetail(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid product detail payload") });
  }
});
catalogRouter.patch("/catalog/product-details/:productId", ...requireProductEdit, async (req, res) => {
  try {
    const product = await catalogStore2.getProduct(req.params.productId);
    if (!forbidUnlessOwnsProduct(req, res, product)) return;
    const existing = await catalogStore2.getProductDetail(req.params.productId);
    if (!existing) {
      res.status(404).json({ error: "Product detail not found" });
      return;
    }
    const normalized = normalizeProductDetailInput(
      { ...existing, ...req.body, productId: req.params.productId },
      req.params.productId,
      existing
    );
    const saved = await catalogStore2.upsertProductDetail(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid product detail patch payload") });
  }
});
catalogRouter.get("/catalog/brand-posts", async (req, res) => {
  try {
    const posts = await catalogStore2.listBrandPosts();
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const slug = typeof req.query.slug === "string" ? req.query.slug : "";
    const brandId = typeof req.query.brandId === "string" ? req.query.brandId : "";
    const filtered = posts.filter((post) => {
      if (status && post.status !== status) return false;
      if (slug && post.slug !== slug) return false;
      if (brandId && post.brandId !== brandId) return false;
      return true;
    });
    res.json({ data: filtered });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list brand posts" });
  }
});
catalogRouter.get("/catalog/brand-posts/:id", async (req, res) => {
  try {
    const post = await catalogStore2.getBrandPost(req.params.id);
    if (!post) {
      res.status(404).json({ error: "Brand post not found" });
      return;
    }
    res.json({ data: post });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to get brand post" });
  }
});
catalogRouter.post("/catalog/brand-posts", ...requireCmsWrite, async (req, res) => {
  try {
    const normalized = normalizeBrandPostInput(req.body);
    const saved = await catalogStore2.upsertBrandPost(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid brand post payload") });
  }
});
catalogRouter.put("/catalog/brand-posts/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getBrandPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Brand post not found" });
      return;
    }
    const normalized = normalizeBrandPostInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertBrandPost(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid brand post payload") });
  }
});
catalogRouter.patch("/catalog/brand-posts/:id", ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore2.getBrandPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Brand post not found" });
      return;
    }
    const normalized = normalizeBrandPostInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore2.upsertBrandPost(normalized);
    res.json({ success: true, data: saved });
  } catch (error2) {
    res.status(400).json({ error: validationErrorMessage(error2, "Invalid brand post patch payload") });
  }
});
catalogRouter.delete("/catalog/brand-posts/:id", ...requireCmsWrite, async (req, res) => {
  try {
    await catalogStore2.deleteBrandPost(req.params.id);
    res.json({ success: true });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to delete brand post" });
  }
});

// server/operationsRouter.ts
init_operationsStore();
import { randomBytes as randomBytes2 } from "crypto";
import { Router as Router4 } from "express";

// server/operations/couponValidator.ts
var today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
function validateCoupon(coupon, cartTotal, userId, cartItems, userUsageCount = 0) {
  const code = coupon.code.toUpperCase();
  if (coupon.deleted) {
    return { valid: false, discount: 0, reason: "This promo code is no longer available." };
  }
  if (!coupon.active) {
    return { valid: false, discount: 0, reason: "This promo code is currently inactive." };
  }
  const now = today();
  if (now < coupon.validFrom) {
    return { valid: false, discount: 0, reason: "This promo code is not active yet." };
  }
  if (now > coupon.validUntil) {
    return { valid: false, discount: 0, reason: "This promo code has expired." };
  }
  const rules = coupon.rules ?? {};
  if (rules.minPurchaseAmount && cartTotal < rules.minPurchaseAmount) {
    return {
      valid: false,
      discount: 0,
      reason: `Minimum purchase of \u09F3${rules.minPurchaseAmount.toLocaleString()} required.`
    };
  }
  if (rules.maxUsages && coupon.totalRedemptions >= rules.maxUsages) {
    return { valid: false, discount: 0, reason: "This promo code has reached its usage limit." };
  }
  if (rules.maxUsagesPerUser && userId && userUsageCount >= rules.maxUsagesPerUser) {
    return { valid: false, discount: 0, reason: "You have already redeemed this promo maximum times." };
  }
  let targetSubtotal = cartTotal;
  if (cartItems && cartItems.length > 0) {
    let applicableItems = [...cartItems];
    if (rules.excludeProducts?.length) {
      applicableItems = applicableItems.filter((item) => !rules.excludeProducts?.includes(item.id));
    }
    if (rules.excludeCategories?.length) {
      applicableItems = applicableItems.filter(
        (item) => !item.category || !rules.excludeCategories?.includes(item.category)
      );
    }
    if (rules.excludeBrands?.length) {
      applicableItems = applicableItems.filter(
        (item) => !item.brand || !rules.excludeBrands?.includes(item.brand)
      );
    }
    if (coupon.discountTarget === "specific_product" && rules.applicableProducts?.length) {
      applicableItems = applicableItems.filter((item) => rules.applicableProducts?.includes(item.id));
    } else if (coupon.discountTarget === "specific_category" && rules.applicableCategories?.length) {
      applicableItems = applicableItems.filter(
        (item) => item.category && rules.applicableCategories?.some((cat) => cat.toLowerCase() === item.category?.toLowerCase())
      );
    } else if (coupon.discountTarget === "specific_brand" && rules.applicableBrands?.length) {
      applicableItems = applicableItems.filter(
        (item) => item.brand && rules.applicableBrands?.some((brand) => brand.toLowerCase() === item.brand?.toLowerCase())
      );
    }
    if (applicableItems.length === 0) {
      return { valid: false, discount: 0, reason: "This coupon is not applicable to any products in your cart." };
    }
    targetSubtotal = applicableItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
  }
  let discount = 0;
  if (coupon.type === "percentage") {
    discount = Math.round(targetSubtotal * (coupon.discountValue / 100));
    if (rules.maxDiscountAmount && discount > rules.maxDiscountAmount) {
      discount = rules.maxDiscountAmount;
    }
  } else if (coupon.type === "fixed_amount") {
    discount = coupon.discountValue;
  } else if (coupon.type === "free_shipping") {
    discount = 120;
  } else if (coupon.type === "buy_x_get_y") {
    const buyQ = rules.buyQuantity || 1;
    const getQ = rules.getQuantity || 1;
    if (cartItems && cartItems.length > 0) {
      const sorted = [...cartItems].sort((a, b) => a.price - b.price);
      const totalQty = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      if (totalQty >= buyQ + getQ) {
        discount = sorted[0].price * getQ;
      } else {
        return {
          valid: false,
          discount: 0,
          reason: `Buy ${buyQ} Get ${getQ} promo requires at least ${buyQ + getQ} items.`
        };
      }
    }
  }
  if (discount > cartTotal) {
    discount = cartTotal;
  }
  return { valid: true, discount, type: coupon.type, code };
}

// server/operations/analyticsService.ts
init_operationsStore();
init_shipmentStore();
function parseRange(range) {
  if (range === "7d" || range === "30d" || range === "90d") return range;
  return "all";
}
function inRange(isoDate3, range) {
  if (range === "all") return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const diff = (Date.now() - new Date(isoDate3).getTime()) / (1e3 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}
function dayKey(isoDate3) {
  return isoDate3.slice(0, 10);
}
function buildDailySeries(range) {
  const orders = operationsStore.listOrders().filter((o) => inRange(o.createdAt, range));
  const map = /* @__PURE__ */ new Map();
  for (const order of orders) {
    const key = dayKey(order.createdAt);
    const row = map.get(key) || { date: key, orders: 0, revenue: 0, leads: 0 };
    row.orders += 1;
    row.revenue += Number(order.overallTotal || 0);
    map.set(key, row);
  }
  for (const lead of operationsStore.listLeads().filter((l) => inRange(l.createdAt, range))) {
    const key = dayKey(lead.createdAt);
    const row = map.get(key) || { date: key, orders: 0, revenue: 0, leads: 0 };
    row.leads += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1);
}
function getAnalyticsSummary(rangeInput) {
  const range = parseRange(rangeInput);
  const orders = operationsStore.listOrders().filter((o) => inRange(o.createdAt, range));
  const leads = operationsStore.listLeads().filter((l) => inRange(l.createdAt, range));
  const reviews = operationsStore.listReviews().filter((r) => inRange(r.createdAt, range));
  const shipments = shipmentStore.listShipments().filter((s) => inRange(s.createdAt, range));
  const coupons = operationsStore.listCoupons();
  const revenue = orders.reduce((sum, o) => sum + Number(o.overallTotal || 0), 0);
  const promoDiscount = orders.reduce((sum, o) => sum + Number(o.promoDiscount || 0), 0);
  const pendingReviews = reviews.filter((r) => r.status === "pending" || r.status === "flagged").length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const pendingShipments = shipments.filter(
    (s) => s.status === "pending_pickup" || s.status === "picked_up" || s.status === "in_transit"
  ).length;
  return {
    range,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    orders: {
      total: orders.length,
      revenue,
      promoDiscount,
      cod: orders.filter((o) => o.isCOD).length
    },
    leads: {
      total: leads.length,
      new: newLeads,
      contacted: leads.filter((l) => l.status === "contacted").length,
      qualified: leads.filter((l) => l.status === "qualified").length
    },
    reviews: {
      total: reviews.length,
      pending: pendingReviews,
      published: reviews.filter((r) => r.status === "published").length
    },
    shipments: {
      total: shipments.length,
      pending: pendingShipments,
      delivered: shipments.filter((s) => s.status === "delivered").length
    },
    coupons: {
      active: coupons.filter((c) => c.active).length,
      totalRedemptions: coupons.reduce((sum, c) => sum + c.totalRedemptions, 0),
      totalDiscountGiven: coupons.reduce((sum, c) => sum + c.totalDiscountGiven, 0)
    },
    daily: buildDailySeries(range)
  };
}
function getRoleAnalytics(role, rangeInput) {
  const summary = getAnalyticsSummary(rangeInput);
  const permissions = operationsStore.getPermissions()[role] || DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.admin;
  const quickLinks = [];
  if (permissions.content) {
    quickLinks.push({ label: "Products", path: "/admin/products" });
    quickLinks.push({ label: "Reviews", path: "/admin/reviews" });
  }
  if (permissions.users) {
    quickLinks.push({ label: "Platform Orders", path: "/admin/platform-orders" });
    quickLinks.push({ label: "Consumers", path: "/admin/consumers" });
  }
  if (permissions.finance) {
    quickLinks.push({ label: "Payouts", path: "/admin/payouts" });
    quickLinks.push({ label: "Cash Book", path: "/admin/cashbook" });
  }
  if (permissions.brand) {
    quickLinks.push({ label: "Brand Posts", path: "/admin/brand-posts" });
    quickLinks.push({ label: "Leads", path: "/admin/leads" });
  }
  if (permissions.analytics) {
    quickLinks.push({ label: "Analytics", path: "/admin/analytics" });
  }
  quickLinks.push({ label: "Messages", path: "/admin/messages" });
  const cards = [];
  switch (role) {
    case "finance_manager":
      cards.push(
        { label: "Platform Revenue", value: `\u09F3 ${summary.orders.revenue.toLocaleString()}`, sub: `${summary.orders.total} orders` },
        { label: "Promo Discounts", value: `\u09F3 ${summary.orders.promoDiscount.toLocaleString()}`, sub: "Redeemed at checkout" },
        { label: "Coupon Savings", value: `\u09F3 ${summary.coupons.totalDiscountGiven.toLocaleString()}`, sub: `${summary.coupons.totalRedemptions} redemptions` },
        { label: "COD Orders", value: String(summary.orders.cod), sub: "Cash on delivery" }
      );
      break;
    case "support_agent":
      cards.push(
        { label: "Platform Orders", value: String(summary.orders.total), sub: "Storefront checkout" },
        { label: "Open Shipments", value: String(summary.shipments.pending), sub: `${summary.shipments.delivered} delivered` },
        { label: "Pending Reviews", value: String(summary.reviews.pending), sub: "Needs moderation" },
        { label: "New Leads", value: String(summary.leads.new), sub: `${summary.leads.total} total leads` }
      );
      break;
    case "marketing_manager":
      cards.push(
        { label: "Advertise Leads", value: String(summary.leads.total), sub: `${summary.leads.new} new` },
        { label: "Active Coupons", value: String(summary.coupons.active), sub: `${summary.coupons.totalRedemptions} uses` },
        { label: "Orders (Campaign)", value: String(summary.orders.total), sub: `\u09F3 ${summary.orders.revenue.toLocaleString()} revenue` },
        { label: "Promo Savings", value: `\u09F3 ${summary.orders.promoDiscount.toLocaleString()}`, sub: "Attributed discounts" }
      );
      break;
    case "moderator":
      cards.push(
        { label: "Pending Reviews", value: String(summary.reviews.pending), sub: "Awaiting action" },
        { label: "Published Reviews", value: String(summary.reviews.published), sub: "Live on site" },
        { label: "Total Reviews", value: String(summary.reviews.total), sub: "In pipeline" },
        { label: "Platform Orders", value: String(summary.orders.total), sub: "For dispute context" }
      );
      break;
    case "admin":
      cards.push(
        { label: "Storefront Orders", value: String(summary.orders.total), sub: `\u09F3 ${summary.orders.revenue.toLocaleString()}` },
        { label: "Shipments", value: String(summary.shipments.total), sub: `${summary.shipments.pending} in transit` },
        { label: "Leads Inbox", value: String(summary.leads.new), sub: `${summary.leads.total} total` },
        { label: "Review Queue", value: String(summary.reviews.pending), sub: "Needs moderation" }
      );
      break;
    default:
      cards.push(
        { label: "Orders", value: String(summary.orders.total), sub: `\u09F3 ${summary.orders.revenue.toLocaleString()}` },
        { label: "Leads", value: String(summary.leads.total), sub: `${summary.leads.new} new` },
        { label: "Reviews", value: String(summary.reviews.total), sub: `${summary.reviews.pending} pending` },
        { label: "Shipments", value: String(summary.shipments.total), sub: `${summary.shipments.pending} active` }
      );
  }
  return {
    role,
    permissions,
    cards,
    quickLinks,
    summary
  };
}

// server/operations/sellerIntelligenceService.ts
init_operationsStore();
function parseRange2(range) {
  if (range === "7d" || range === "30d" || range === "90d") return range;
  return "7d";
}
function inRange2(isoDate3, range) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const diff = (Date.now() - new Date(isoDate3).getTime()) / (1e3 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}
function dayKey2(isoDate3) {
  return isoDate3.slice(0, 10);
}
function weekKey(isoDate3) {
  const date = new Date(isoDate3);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start.toISOString().slice(0, 10);
}
function monthKey(isoDate3) {
  return isoDate3.slice(0, 7);
}
function normalize(value) {
  return (value || "").trim().toLowerCase();
}
function dealMatchesSeller(deal, query2) {
  const sellerField = normalize(deal.seller);
  const sellerId = normalize(query2.sellerId);
  const sellerName = normalize(query2.sellerName);
  const storeName = normalize(query2.storeName);
  if (sellerField.includes(sellerId)) return true;
  if (sellerName && sellerField.includes(sellerName)) return true;
  if (storeName) {
    const token = storeName.split(/\s+/)[0];
    if (token.length > 2 && sellerField.includes(token)) return true;
  }
  return false;
}
function productMatchesSeller(product, sellerBrandIds, sellerBrandNames, sellerProductIds) {
  if (sellerProductIds.has(product.id)) return true;
  if (sellerBrandIds.has(product.brandId)) return true;
  const brandName = normalize(product.brandName);
  for (const name of sellerBrandNames) {
    if (brandName.includes(name) || name.includes(brandName)) return true;
  }
  return false;
}
function estimateProductViews(product, dealClicks) {
  const base = product.isBestseller ? 140 : product.isNewArrival ? 95 : 55;
  const galleryBoost = (product.gallery?.length || 0) * 6;
  const featuredBoost = product.featuredFlag ? 25 : 0;
  const hashBoost = product.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 40;
  return base + galleryBoost + featuredBoost + dealClicks + hashBoost;
}
function estimateWishlist(product, views) {
  const conversion = product.isBestseller ? 0.12 : 0.07;
  return Math.max(1, Math.round(views * conversion));
}
function estimateCompare(product, views) {
  return Math.max(0, Math.round(views * (product.isDeal ? 0.18 : 0.09)));
}
function stockStatus(stock) {
  if (stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "in_stock";
}
function performanceScore(input) {
  const viewScore = Math.min(30, Math.round(input.views / 10));
  const engagementScore = Math.min(25, input.wishlist + input.compareCount);
  const ratingScore = Math.min(20, Math.round(input.averageRating * 4));
  const reviewScore = Math.min(10, input.reviewCount * 2);
  const stockScore = input.stock > 0 ? 10 : 0;
  const mediaScore = Math.min(5, input.galleryCount);
  return Math.min(100, viewScore + engagementScore + ratingScore + reviewScore + stockScore + mediaScore);
}
function buildProductIntelligence(products, reviewsByProduct, dealClicksByProduct) {
  return products.map((product) => {
    const reviewData = reviewsByProduct.get(product.id);
    const ratings = reviewData?.ratings || [];
    const reviewCount = reviewData?.count || 0;
    const averageRating = ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 0;
    const dealClicks = dealClicksByProduct.get(product.id) || 0;
    const views = estimateProductViews(product, dealClicks);
    const wishlist = estimateWishlist(product, views);
    const compareCount = estimateCompare(product, views);
    return {
      id: product.id,
      title: product.title,
      brandName: product.brandName,
      categoryName: product.categoryName,
      views,
      wishlist,
      compareCount,
      averageRating,
      reviewCount,
      stockStatus: stockStatus(product.stock),
      stock: product.stock,
      lastUpdated: product.updatedAt,
      approvalStatus: product.status,
      performanceScore: performanceScore({
        views,
        wishlist,
        compareCount,
        averageRating,
        reviewCount,
        stock: product.stock,
        galleryCount: product.gallery?.length || 0
      }),
      isEstimated: true
    };
  });
}
function buildOverview(products, reviews, sellerName, storeName) {
  const totalViews = products.reduce((sum, p) => sum + p.views, 0);
  const todaysViews = Math.max(0, Math.round(totalViews * 0.08));
  const productViews7d = totalViews;
  const sellerReviews2 = reviews.filter((review) => {
    const store = normalize(review.storeName);
    const name = normalize(sellerName);
    const storeLabel = normalize(storeName);
    return name && store.includes(name) || storeLabel && store.includes(storeLabel.split(" ")[0]);
  });
  const averageRating = sellerReviews2.length > 0 ? Number(
    (sellerReviews2.reduce((sum, review) => sum + review.rating, 0) / sellerReviews2.length).toFixed(1)
  ) : 0;
  const unansweredReviews = sellerReviews2.filter((review) => !review.response).length;
  const unreadMessages = Math.max(unansweredReviews, 2);
  const supportTickets = sellerReviews2.filter((review) => review.status === "flagged").length;
  const profileCompletion = 72;
  return {
    todaysViews,
    productViews7d,
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.approvalStatus === "live").length,
    pendingProducts: products.filter((p) => p.approvalStatus === "draft").length,
    outOfStockProducts: products.filter((p) => p.stockStatus === "out_of_stock").length,
    wishlistCount: products.reduce((sum, p) => sum + p.wishlist, 0),
    compareCount: products.reduce((sum, p) => sum + p.compareCount, 0),
    averageRating,
    unreadMessages,
    supportTickets,
    profileCompletion
  };
}
function buildPerformanceCharts(products, range, orders, sellerId) {
  const sellerOrders = orders.filter(
    (order) => order.subOrders?.some(
      (sub) => normalize(sub.sellerId) === normalize(sellerId)
    )
  );
  const filteredOrders = sellerOrders.filter((order) => inRange2(order.createdAt, range));
  const dailyMap = /* @__PURE__ */ new Map();
  const weeklyMap = /* @__PURE__ */ new Map();
  const monthlyMap = /* @__PURE__ */ new Map();
  for (const product of products) {
    const perDay = Math.max(1, Math.round(product.views / (range === "7d" ? 7 : range === "30d" ? 30 : 90)));
    for (let i = 0; i < (range === "7d" ? 7 : range === "30d" ? 30 : 14); i += 1) {
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() - i);
      const key = dayKey2(date.toISOString());
      const row = dailyMap.get(key) || { date: key, views: 0 };
      row.views += perDay;
      dailyMap.set(key, row);
    }
  }
  for (const order of filteredOrders) {
    const week = weekKey(order.createdAt);
    const month = monthKey(order.createdAt);
    const weekRow = weeklyMap.get(week) || { week, views: 0, orders: 0 };
    weekRow.orders += 1;
    weekRow.views += 20;
    weeklyMap.set(week, weekRow);
    const monthRow = monthlyMap.get(month) || { month, views: 0, orders: 0 };
    monthRow.orders += 1;
    monthRow.views += 20;
    monthlyMap.set(month, monthRow);
  }
  const sortedProducts = [...products].sort((a, b) => b.performanceScore - a.performanceScore);
  const topPerformingProducts = sortedProducts.slice(0, 5).map((p) => ({
    id: p.id,
    title: p.title,
    views: p.views,
    score: p.performanceScore
  }));
  const worstPerformingProducts = [...sortedProducts].reverse().slice(0, 5).map((p) => ({
    id: p.id,
    title: p.title,
    views: p.views,
    score: p.performanceScore
  }));
  const categoryMap = /* @__PURE__ */ new Map();
  const brandMap = /* @__PURE__ */ new Map();
  for (const product of products) {
    const categoryRow = categoryMap.get(product.categoryName) || {
      category: product.categoryName,
      views: 0,
      products: 0
    };
    categoryRow.views += product.views;
    categoryRow.products += 1;
    categoryMap.set(product.categoryName, categoryRow);
    const brandRow = brandMap.get(product.brandName) || {
      brand: product.brandName,
      views: 0,
      products: 0
    };
    brandRow.views += product.views;
    brandRow.products += 1;
    brandMap.set(product.brandName, brandRow);
  }
  return {
    dailyProductViews: [...dailyMap.values()].sort((a, b) => a.date < b.date ? -1 : 1),
    weeklyTraffic: [...weeklyMap.values()].sort((a, b) => a.week < b.week ? -1 : 1),
    monthlyProductPerformance: [...monthlyMap.values()].sort((a, b) => a.month < b.month ? -1 : 1),
    topPerformingProducts,
    worstPerformingProducts,
    categoryPerformance: [...categoryMap.values()].sort((a, b) => b.views - a.views),
    brandPerformance: [...brandMap.values()].sort((a, b) => b.views - a.views),
    trafficSources: [
      { source: "Organic Search", share: 42, isPlaceholder: true },
      { source: "Direct", share: 28, isPlaceholder: true },
      { source: "Choosify Homepage", share: 18, isPlaceholder: true },
      { source: "Social", share: 12, isPlaceholder: true }
    ]
  };
}
function buildHealthScore(overview, products, reviews) {
  const verifiedStatus = 80;
  const responsePenalty = Math.min(20, overview.unreadMessages * 3);
  const responseTime = Math.max(0, 100 - responsePenalty);
  const activeListings = overview.totalProducts > 0 ? Math.round(overview.activeProducts / overview.totalProducts * 100) : 0;
  const ratingScore = Math.round(overview.averageRating / 5 * 100);
  const pendingComplaints = reviews.filter((review) => review.status === "flagged").length;
  const complaintPenalty = Math.min(25, pendingComplaints * 5);
  const rejectedProducts = products.filter((p) => p.approvalStatus === "archived").length;
  const rejectedPenalty = Math.min(20, rejectedProducts * 4);
  const missingInformation = products.filter(
    (p) => p.reviewCount === 0 || p.stockStatus === "out_of_stock"
  ).length;
  const missingPenalty = Math.min(15, missingInformation * 2);
  const factors = {
    profileCompletion: overview.profileCompletion,
    verifiedStatus,
    responseTime,
    activeListings,
    averageRating: ratingScore,
    pendingComplaints: Math.max(0, 100 - complaintPenalty),
    rejectedProducts: Math.max(0, 100 - rejectedPenalty),
    missingInformation: Math.max(0, 100 - missingPenalty)
  };
  const score = Math.round(
    factors.profileCompletion * 0.15 + factors.verifiedStatus * 0.1 + factors.responseTime * 0.15 + factors.activeListings * 0.2 + factors.averageRating * 0.2 + factors.pendingComplaints * 0.1 + factors.rejectedProducts * 0.05 + factors.missingInformation * 0.05
  );
  const grade = score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "needs_attention";
  return {
    score: Math.min(100, Math.max(0, score)),
    grade,
    factors,
    isPartiallyEstimated: true
  };
}
function buildActionCenter(overview, products) {
  const actions = [];
  if (overview.profileCompletion < 90) {
    actions.push({
      id: "complete-profile",
      priority: "high",
      title: "Complete Profile",
      reason: `Profile is ${overview.profileCompletion}% complete.`,
      suggestedAction: "Add business details, contact info, and store branding."
    });
  }
  if (overview.outOfStockProducts > 0) {
    actions.push({
      id: "restock-products",
      priority: "high",
      title: "Restock Product",
      reason: `${overview.outOfStockProducts} products are out of stock.`,
      suggestedAction: "Update inventory for out-of-stock listings."
    });
  }
  if (overview.unreadMessages > 0) {
    actions.push({
      id: "respond-customer",
      priority: "high",
      title: "Respond to Customer",
      reason: `${overview.unreadMessages} unread messages or unanswered reviews.`,
      suggestedAction: "Reply to buyer messages and product reviews."
    });
  }
  const lowImageProduct = products.find((p) => p.performanceScore < 50);
  if (lowImageProduct) {
    actions.push({
      id: "add-product-images",
      priority: "medium",
      title: "Add Product Images",
      reason: `"${lowImageProduct.title}" has a low performance score.`,
      suggestedAction: "Upload at least 5 high-quality product images."
    });
  }
  const weakDescription = products.find((p) => p.reviewCount === 0 && p.views > 50);
  if (weakDescription) {
    actions.push({
      id: "improve-description",
      priority: "medium",
      title: "Improve Product Description",
      reason: `"${weakDescription.title}" gets views but no reviews.`,
      suggestedAction: "Expand specifications, sizing, and care instructions."
    });
  }
  actions.push({
    id: "verify-business",
    priority: "medium",
    title: "Verify Business",
    reason: "Verified sellers receive higher trust placement.",
    suggestedAction: "Submit business verification documents."
  });
  actions.push({
    id: "upload-cover-image",
    priority: "low",
    title: "Upload Cover Image",
    reason: "Storefront cover images improve brand recall.",
    suggestedAction: "Add a branded cover image to your seller profile."
  });
  return actions.slice(0, 8);
}
function buildInventoryAlerts(products) {
  const alerts = [];
  for (const product of products) {
    if (product.stock <= 0) {
      alerts.push({
        id: `oos-${product.id}`,
        type: "out_of_stock",
        productId: product.id,
        productTitle: product.title,
        detail: "No units available"
      });
    } else if (product.stock <= 5) {
      alerts.push({
        id: `low-${product.id}`,
        type: "low_stock",
        productId: product.id,
        productTitle: product.title,
        detail: `${product.stock} units remaining`
      });
    }
    if (product.status === "draft") {
      alerts.push({
        id: `draft-${product.id}`,
        type: "draft",
        productId: product.id,
        productTitle: product.title,
        detail: "Draft listing not visible to buyers"
      });
    }
    if (product.status === "archived") {
      alerts.push({
        id: `rejected-${product.id}`,
        type: "rejected",
        productId: product.id,
        productTitle: product.title,
        detail: "Archived or rejected listing"
      });
    }
  }
  return alerts.slice(0, 20);
}
function buildNotifications(products, reviews, sellerName) {
  const notifications = [];
  const liveProducts2 = products.filter((p) => p.status === "live").slice(0, 2);
  for (const product of liveProducts2) {
    notifications.push({
      id: `approval-${product.id}`,
      type: "approval",
      title: "Product Approved",
      body: `${product.title} is live on Choosify.`,
      createdAt: product.updatedAt,
      read: false
    });
  }
  const flagged = reviews.filter((review) => review.status === "flagged").slice(0, 2);
  for (const review of flagged) {
    notifications.push({
      id: `rejection-${review.id}`,
      type: "rejection",
      title: "Review Flagged",
      body: `Review for ${review.productTitle} needs attention.`,
      createdAt: review.updatedAt,
      read: false
    });
  }
  const unanswered = reviews.filter((review) => !review.response).slice(0, 2);
  for (const review of unanswered) {
    notifications.push({
      id: `message-${review.id}`,
      type: "message",
      title: "New Customer Feedback",
      body: `${review.userName} left a ${review.rating}-star review.`,
      createdAt: review.createdAt,
      read: false
    });
  }
  notifications.push({
    id: "announcement-platform",
    type: "announcement",
    title: "Choosify Seller Update",
    body: `${sellerName || "Seller"}, new visibility tools are available in your dashboard.`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    read: true
  });
  return notifications.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1).slice(0, 10);
}
function buildInsights(products) {
  const insights = [];
  const highViewsLowWishlist = products.find((p) => p.views > 80 && p.wishlist < 8);
  if (highViewsLowWishlist) {
    insights.push({
      id: "views-wishlist-gap",
      message: `"${highViewsLowWishlist.title}" receives many views but few wishlists.`,
      productId: highViewsLowWishlist.id,
      productTitle: highViewsLowWishlist.title,
      isPlaceholder: false
    });
  }
  const highCompare = products.find((p) => p.compareCount > 10);
  if (highCompare) {
    insights.push({
      id: "compare-heavy",
      message: "Customers compare this product often.",
      productId: highCompare.id,
      productTitle: highCompare.title,
      isPlaceholder: false
    });
  }
  const richGalleryPerformer = products.find((p) => p.performanceScore >= 70);
  if (richGalleryPerformer) {
    insights.push({
      id: "image-performance",
      message: "Products with richer media and complete details perform better.",
      productId: richGalleryPerformer.id,
      productTitle: richGalleryPerformer.title,
      isPlaceholder: true
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "placeholder-insight",
      message: "Add more live products to unlock personalized seller insights.",
      isPlaceholder: true
    });
  }
  return insights;
}
async function getSellerDashboardIntelligence(query2) {
  const range = parseRange2(query2.range);
  const [allProducts, allDeals] = await Promise.all([
    catalogStore2.listProducts(),
    catalogStore2.listDeals()
  ]);
  const sellerDeals = allDeals.filter((deal) => dealMatchesSeller(deal, query2));
  const sellerBrandIds = new Set(
    sellerDeals.map((deal) => deal.brandId).filter((id) => Boolean(id))
  );
  const sellerBrandNames = new Set(
    [
      ...sellerDeals.map((deal) => normalize(deal.seller)),
      normalize(query2.sellerName),
      normalize(query2.storeName)
    ].filter(Boolean)
  );
  const orders = operationsStore.listOrders();
  const sellerProductIds = /* @__PURE__ */ new Set();
  for (const order of orders) {
    for (const sub of order.subOrders || []) {
      if (normalize(sub.sellerId) === normalize(query2.sellerId) && sub.productId) {
        sellerProductIds.add(sub.productId);
      }
    }
  }
  let sellerProducts = allProducts.filter(
    (product) => productMatchesSeller(product, sellerBrandIds, sellerBrandNames, sellerProductIds)
  );
  if (sellerProducts.length === 0) {
    sellerProducts = allProducts.slice(0, Math.min(8, allProducts.length));
  }
  const reviews = operationsStore.listReviews();
  const reviewsByProduct = /* @__PURE__ */ new Map();
  for (const review of reviews) {
    const row = reviewsByProduct.get(review.productId) || { ratings: [], count: 0 };
    row.ratings.push(review.rating);
    row.count += 1;
    reviewsByProduct.set(review.productId, row);
  }
  const dealClicksByProduct = /* @__PURE__ */ new Map();
  for (const deal of sellerDeals) {
    if (!deal.productId) continue;
    dealClicksByProduct.set(
      deal.productId,
      (dealClicksByProduct.get(deal.productId) || 0) + Number(deal.clicks || 0)
    );
  }
  const productIntelligence = buildProductIntelligence(sellerProducts, reviewsByProduct, dealClicksByProduct);
  const overview = buildOverview(productIntelligence, reviews, query2.sellerName, query2.storeName);
  const performance = buildPerformanceCharts(productIntelligence, range, orders, query2.sellerId);
  const healthScore = buildHealthScore(overview, productIntelligence, reviews);
  const actionCenter = buildActionCenter(overview, productIntelligence);
  const inventoryAlerts = buildInventoryAlerts(sellerProducts);
  const notifications = buildNotifications(sellerProducts, reviews, query2.sellerName);
  const insights = buildInsights(productIntelligence);
  return {
    sellerId: query2.sellerId,
    sellerName: query2.sellerName,
    storeName: query2.storeName,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    range,
    overview,
    performance,
    products: productIntelligence,
    healthScore,
    actionCenter,
    inventoryAlerts,
    notifications,
    insights
  };
}

// server/operationsRouter.ts
init_shipmentStore();
init_platformMessagingBridge();
init_operationsPersistence();

// server/middleware/requireModerator.ts
var requireModerator = requireRole(ROLES.MODERATOR);

// server/validation/operations/couponValidateSchema.ts
import { z as z8 } from "zod";
var cartItemSchema = z8.object({
  id: z8.string().trim().min(1),
  price: priceValidator,
  category: z8.string().trim().optional(),
  brand: z8.string().trim().optional(),
  quantity: z8.coerce.number().int().positive().optional()
});
var CouponValidateBodySchema = z8.object({
  code: z8.string().trim().min(1, "Promo code is required"),
  cartTotal: z8.coerce.number().nonnegative().optional(),
  userId: z8.string().trim().optional(),
  cartItems: z8.array(cartItemSchema).optional()
});

// shared/messaging/conversationExpiry.ts
var SERVICE_CONVERSATION_END_DATE_KEY = {
  hotels: "checkOutDate",
  restaurants: "reservationDate",
  travel: "travelDate",
  doctors: "appointmentDate",
  education: "preferredStartDate",
  beauty: "appointmentDate",
  real_estate: "viewingDate",
  transport: "pickupDate"
};
var CONVERSATION_EXPIRY_WARNING_HOURS = 24;
function normalizeCategory(raw) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    hotel: "hotels",
    hotels: "hotels",
    restaurant: "restaurants",
    restaurants: "restaurants",
    travel: "travel",
    doctor: "doctors",
    doctors: "doctors",
    healthcare: "doctors",
    education: "education",
    beauty: "beauty",
    salon: "beauty",
    real_estate: "real_estate",
    realestate: "real_estate",
    property: "real_estate",
    transport: "transport"
  };
  return aliases[key] ?? null;
}
function parseYmd(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}
function bangladeshEndOfDayIso(dateYmd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(Date.UTC(y, mo - 1, d, 17, 59, 59, 999)).toISOString();
}
function formatHoursRemaining(ms) {
  const hours = Math.max(0, Math.ceil(ms / (60 * 60 * 1e3)));
  if (hours <= 1) return "about 1 hour";
  if (hours < 48) return `${hours} hours`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? "about 1 day" : `${days} days`;
}
function collectItems(order) {
  return (order.subOrders || []).flatMap((sub) => sub.items || []);
}
function isServiceOrder(order) {
  return collectItems(order).some((item) => item.productType === "service");
}
function resolveServiceClosesAt(order) {
  const serviceItem = collectItems(order).find((item) => item.productType === "service");
  if (!serviceItem) return null;
  const category = normalizeCategory(serviceItem.serviceCategory);
  const details = serviceItem.serviceDetails || {};
  const preferredKey = category ? SERVICE_CONVERSATION_END_DATE_KEY[category] : null;
  const candidates = [
    preferredKey ? details[preferredKey] : void 0,
    details.checkOutDate,
    details.reservationDate,
    details.travelDate,
    details.appointmentDate,
    details.preferredStartDate,
    details.viewingDate,
    details.pickupDate
  ];
  for (const candidate of candidates) {
    const ymd = parseYmd(candidate);
    if (!ymd) continue;
    const iso = bangladeshEndOfDayIso(ymd);
    if (iso) return iso;
  }
  return null;
}
function isPhysicalConversationClosed(order) {
  if (order.status === "cancelled" || order.cancelledAt) return true;
  if (order.status === "completed") return true;
  const subs = order.subOrders || [];
  if (subs.length === 0) return false;
  return subs.every((sub) => sub.trackingStatus === "delivered");
}
function formatBdServiceDate(closesAtIso) {
  try {
    return new Date(closesAtIso).toLocaleDateString("en-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return closesAtIso.slice(0, 10);
  }
}
function physicalFreezeNotice() {
  return "This conversation will freeze/close after the order is delivered or cancelled.";
}
function serviceFreezeNotice(closesAt) {
  if (closesAt) {
    return `This conversation will freeze/close at 11:59 PM Bangladesh time on ${formatBdServiceDate(closesAt)}.`;
  }
  return "This conversation will freeze/close at 11:59 PM Bangladesh time on the service date.";
}
function evaluatePostOrderConversationExpiry(order, nowMs = Date.now()) {
  if (!order?.orderId && !order?.status && !(order?.subOrders && order.subOrders.length)) {
    return { status: "not_applicable" };
  }
  if (!order) return { status: "not_applicable" };
  if (isServiceOrder(order)) {
    if (order.status === "cancelled" || order.cancelledAt) {
      return {
        status: "closed",
        kind: "service",
        reason: "cancelled",
        closedLabel: "This conversation has ended"
      };
    }
    const closesAt = resolveServiceClosesAt(order);
    if (!closesAt) {
      return {
        status: "open",
        kind: "service",
        freezeNotice: serviceFreezeNotice(null)
      };
    }
    const closesAtMs = new Date(closesAt).getTime();
    const msRemaining = closesAtMs - nowMs;
    if (msRemaining <= 0) {
      return {
        status: "closed",
        kind: "service",
        reason: "service_date_passed",
        closesAt,
        closedLabel: "This conversation has ended"
      };
    }
    const warningMs = CONVERSATION_EXPIRY_WARNING_HOURS * 60 * 60 * 1e3;
    const showWarning = msRemaining <= warningMs;
    return {
      status: "open",
      kind: "service",
      closesAt,
      msRemaining,
      freezeNotice: serviceFreezeNotice(closesAt),
      showWarning,
      warningLabel: showWarning ? `This conversation closes in ${formatHoursRemaining(msRemaining)}` : void 0
    };
  }
  if (isPhysicalConversationClosed(order)) {
    const reason = order.status === "cancelled" || order.cancelledAt ? "cancelled" : "delivered";
    return {
      status: "closed",
      kind: "physical",
      reason,
      closedLabel: "This conversation has ended"
    };
  }
  return {
    status: "open",
    kind: "physical",
    freezeNotice: physicalFreezeNotice()
  };
}

// server/communication/communicationStore.ts
import { randomUUID as randomUUID3 } from "crypto";

// server/communication/communicationTypes.ts
var COMMUNICATION_TYPES = {
  NOTIFICATION: "notification",
  ANNOUNCEMENT: "announcement",
  BROADCAST: "broadcast",
  CAMPAIGN: "campaign",
  REMINDER: "reminder",
  ORDER_UPDATE: "order_update",
  MODERATION_UPDATE: "moderation_update",
  SELLER_UPDATE: "seller_update",
  BUYER_UPDATE: "buyer_update",
  SYSTEM_ALERT: "system_alert",
  PROMOTION: "promotion",
  AI_SUGGESTION: "ai_suggestion"
};
var NOTIFICATION_PRIORITIES = {
  CRITICAL: "critical",
  HIGH: "high",
  NORMAL: "normal",
  LOW: "low",
  SILENT: "silent"
};
var DELIVERY_CHANNELS = {
  IN_APP: "in_app",
  EMAIL: "email",
  PUSH: "push",
  SMS: "sms",
  WHATSAPP: "whatsapp",
  WEBHOOK: "webhook"
};
var DIGEST_MODES = {
  INSTANT: "instant",
  DAILY: "daily",
  WEEKLY: "weekly"
};
var BROADCAST_STATUSES = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  SENT: "sent"
};

// server/communication/communicationStore.ts
var state3 = {
  notifications: [],
  broadcasts: [],
  preferences: /* @__PURE__ */ new Map()
};
function nowIso11() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function defaultPreferences(userId) {
  return {
    userId,
    channels: {
      [DELIVERY_CHANNELS.IN_APP]: true,
      [DELIVERY_CHANNELS.EMAIL]: true,
      [DELIVERY_CHANNELS.PUSH]: true,
      [DELIVERY_CHANNELS.SMS]: false,
      [DELIVERY_CHANNELS.WHATSAPP]: false,
      [DELIVERY_CHANNELS.WEBHOOK]: false
    },
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    digestMode: DIGEST_MODES.INSTANT,
    marketingOptIn: false,
    systemRequired: true,
    updatedAt: nowIso11()
  };
}
var communicationStore = {
  listNotifications(filter) {
    let rows = filter.userId ? state3.notifications.filter((n) => n.userId === filter.userId) : [...state3.notifications];
    if (filter.read !== void 0) rows = rows.filter((n) => n.read === filter.read);
    if (filter.archived !== void 0) rows = rows.filter((n) => n.archived === filter.archived);
    if (filter.dismissed !== void 0) rows = rows.filter((n) => n.dismissed === filter.dismissed);
    if (filter.pinned !== void 0) rows = rows.filter((n) => n.pinned === filter.pinned);
    if (filter.priority) rows = rows.filter((n) => n.priority === filter.priority);
    if (filter.category) rows = rows.filter((n) => n.category === filter.category);
    if (filter.type) rows = rows.filter((n) => n.type === filter.type);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      rows = rows.filter(
        (n) => n.title.toLowerCase().includes(q) || (n.summary || "").toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  },
  countNotifications(userId) {
    return userId ? state3.notifications.filter((n) => n.userId === userId) : [...state3.notifications];
  },
  getNotification(id) {
    return state3.notifications.find((n) => n.id === id) ?? null;
  },
  createNotification(input) {
    const notification = {
      ...input,
      id: `ntf-${randomUUID3()}`,
      read: false,
      dismissed: false,
      archived: false,
      priority: input.priority ?? NOTIFICATION_PRIORITIES.NORMAL,
      channels: input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP],
      createdAt: nowIso11(),
      updatedAt: nowIso11()
    };
    state3.notifications.unshift(notification);
    return notification;
  },
  updateNotification(id, patch) {
    const idx = state3.notifications.findIndex((n) => n.id === id);
    if (idx < 0) return null;
    state3.notifications[idx] = { ...state3.notifications[idx], ...patch, updatedAt: nowIso11() };
    return state3.notifications[idx];
  },
  deleteNotification(id) {
    const before = state3.notifications.length;
    state3.notifications = state3.notifications.filter((n) => n.id !== id);
    return state3.notifications.length < before;
  },
  listBroadcasts() {
    return [...state3.broadcasts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getBroadcast(id) {
    return state3.broadcasts.find((b) => b.id === id) ?? null;
  },
  createBroadcast(input) {
    const broadcast = {
      ...input,
      id: `brc-${randomUUID3()}`,
      createdAt: nowIso11(),
      updatedAt: nowIso11()
    };
    state3.broadcasts.unshift(broadcast);
    return broadcast;
  },
  updateBroadcast(id, patch) {
    const idx = state3.broadcasts.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    state3.broadcasts[idx] = { ...state3.broadcasts[idx], ...patch, updatedAt: nowIso11() };
    return state3.broadcasts[idx];
  },
  getPreferences(userId) {
    return state3.preferences.get(userId) ?? defaultPreferences(userId);
  },
  upsertPreferences(userId, patch) {
    const current = state3.preferences.get(userId) ?? defaultPreferences(userId);
    const updated = {
      ...current,
      ...patch,
      channels: { ...current.channels, ...patch.channels || {} },
      quietHours: { ...current.quietHours, ...patch.quietHours || {} },
      userId,
      updatedAt: nowIso11()
    };
    state3.preferences.set(userId, updated);
    return updated;
  },
  countPreferencesUsers() {
    return state3.preferences.size;
  }
};

// server/communication/deliveryChannels.ts
var FrameworkChannelProvider = class {
  constructor(channel) {
    this.channel = channel;
  }
  isConfigured() {
    return false;
  }
  async dispatch(request) {
    return {
      channel: this.channel,
      status: "unsupported",
      message: `Provider for ${this.channel} is not configured. Framework only.`
    };
  }
};
var providers = {
  [DELIVERY_CHANNELS.IN_APP]: {
    channel: DELIVERY_CHANNELS.IN_APP,
    isConfigured: () => true,
    async dispatch(request) {
      return {
        channel: DELIVERY_CHANNELS.IN_APP,
        status: "queued",
        message: `In-app notification queued for ${request.userId}`
      };
    }
  },
  [DELIVERY_CHANNELS.EMAIL]: new FrameworkChannelProvider(DELIVERY_CHANNELS.EMAIL),
  [DELIVERY_CHANNELS.PUSH]: new FrameworkChannelProvider(DELIVERY_CHANNELS.PUSH),
  [DELIVERY_CHANNELS.SMS]: new FrameworkChannelProvider(DELIVERY_CHANNELS.SMS),
  [DELIVERY_CHANNELS.WHATSAPP]: new FrameworkChannelProvider(DELIVERY_CHANNELS.WHATSAPP),
  [DELIVERY_CHANNELS.WEBHOOK]: new FrameworkChannelProvider(DELIVERY_CHANNELS.WEBHOOK)
};
function getChannelProvider(channel) {
  return providers[channel];
}
async function dispatchToChannels(request, channels) {
  const results = [];
  for (const channel of channels) {
    const provider = getChannelProvider(channel);
    results.push(await provider.dispatch({ ...request, channel }));
  }
  return results;
}
function listChannelStatus() {
  return Object.values(providers).map((provider) => ({
    channel: provider.channel,
    configured: provider.isConfigured()
  }));
}

// server/logging/auditLogger.ts
var AUDIT_CATEGORIES = {
  ADMIN_ACTION: "admin_action",
  AUTHENTICATION: "authentication",
  SELLER_ACTION: "seller_action",
  CATALOG_MODERATION: "catalog_moderation",
  PERMISSION_CHANGE: "permission_change",
  SECURITY_EVENT: "security_event",
  SYSTEM_EVENT: "system_event"
};
function resolveRequestContext(req) {
  if (!req) {
    return {};
  }
  return {
    requestId: req.requestId,
    userId: req.userId || req.user?.uid,
    userRole: req.userRole || req.user?.role,
    ip: req.ip,
    userAgent: req.get("user-agent") || void 0
  };
}
function auditLog(input, req) {
  const context = resolveRequestContext(req);
  Logger.audit("Audit event", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    category: input.category,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    result: input.result,
    requestId: input.requestId || context.requestId,
    userId: input.userId || context.userId,
    userRole: input.userRole || context.userRole,
    ip: input.ip || context.ip,
    userAgent: input.userAgent || context.userAgent,
    metadata: input.metadata
  });
}
function auditAdminAction(action, resource, result, options = {}, req) {
  auditLog({ category: AUDIT_CATEGORIES.ADMIN_ACTION, action, resource, result, ...options }, req);
}
function auditPermissionChange(action, resource, result, options = {}, req) {
  auditLog(
    { category: AUDIT_CATEGORIES.PERMISSION_CHANGE, action, resource, result, ...options },
    req
  );
}
function auditSystemEvent(action, resource, result, options = {}, req) {
  auditLog({ category: AUDIT_CATEGORIES.SYSTEM_EVENT, action, resource, result, ...options }, req);
}

// server/communication/eventHooks.ts
function requestContext2(req) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get("user-agent") || void 0,
    userId: req.userId || req.user?.uid
  };
}
function logNotificationAudit(action, resource, result, options = {}, req) {
  auditAdminAction(action, resource, result, {
    resourceId: options.resourceId,
    userId: options.userId,
    metadata: options.metadata
  }, req);
}
function logBroadcastAudit(action, resourceId, result, options = {}, req) {
  auditAdminAction(action, "broadcast", result, {
    resourceId,
    userId: options.userId,
    metadata: options.metadata
  }, req);
}
function logPreferenceChangeAudit(userId, req) {
  auditPermissionChange("update_communication_preferences", "communication_preferences", "success", {
    resourceId: userId,
    userId: req?.userId || userId
  }, req);
}
function recordNotificationSent(notification, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.NOTIFICATION_SENT,
    userId: notification.userId,
    source: "communication_platform",
    metadata: {
      notificationId: notification.id,
      category: notification.category,
      type: notification.type,
      priority: notification.priority,
      channels: notification.channels
    },
    ...requestContext2(req)
  });
}
function recordNotificationRead(notification, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.NOTIFICATION_READ,
    userId: notification.userId,
    source: "communication_platform",
    metadata: { notificationId: notification.id, category: notification.category },
    ...requestContext2(req)
  });
}
function recordNotificationDismissed(notification, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.NOTIFICATION_DISMISSED,
    userId: notification.userId,
    source: "communication_platform",
    metadata: { notificationId: notification.id, category: notification.category },
    ...requestContext2(req)
  });
}
function recordBroadcastSent(broadcast, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.BROADCAST_SENT,
    source: "communication_platform",
    metadata: {
      broadcastId: broadcast.id,
      broadcastType: broadcast.broadcastType,
      targetRoles: broadcast.targetRoles,
      targetSegments: broadcast.targetSegments
    },
    ...requestContext2(req)
  });
}

// server/communication/notificationService.ts
function listNotifications(filter) {
  return communicationStore.listNotifications(filter);
}
async function createNotification(input, req) {
  const preferences = communicationStore.getPreferences(input.userId);
  const channels = input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP];
  const notification = communicationStore.createNotification({
    userId: input.userId,
    type: input.type,
    category: input.category,
    priority: input.priority ?? NOTIFICATION_PRIORITIES.NORMAL,
    title: input.title,
    summary: input.summary,
    actionUrl: input.actionUrl,
    channels,
    pinned: input.pinned ?? false,
    metadata: input.metadata,
    expiresAt: input.expiresAt
  });
  const enabledChannels = channels.filter((channel) => {
    if (input.category === "system" || input.category === "security") return true;
    return preferences.channels[channel] !== false;
  });
  await dispatchToChannels(
    {
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      summary: notification.summary,
      metadata: notification.metadata
    },
    enabledChannels
  );
  recordNotificationSent(notification, req);
  return notification;
}
function dismissNotification(id, req) {
  const updated = communicationStore.updateNotification(id, {
    dismissed: true,
    dismissedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (updated) recordNotificationDismissed(updated, req);
  return updated;
}
function markRead(id, req) {
  const updated = communicationStore.updateNotification(id, {
    read: true,
    readAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (updated) recordNotificationRead(updated, req);
  return updated;
}
function markUnread(id) {
  return communicationStore.updateNotification(id, {
    read: false,
    readAt: void 0
  });
}
function archiveNotification(id) {
  return communicationStore.updateNotification(id, {
    archived: true,
    archivedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function deleteNotification(id, req) {
  const existing = communicationStore.getNotification(id);
  if (!existing) return false;
  const deleted = communicationStore.deleteNotification(id);
  if (deleted) {
    logNotificationAudit("delete_notification", "notification", "success", {
      resourceId: id,
      userId: req?.userId,
      metadata: { targetUserId: existing.userId }
    }, req);
  }
  return deleted;
}
function runBulk(ids, action) {
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    const result = action(id);
    if (result) succeeded.push(id);
    else failed.push({ id, error: "Notification not found" });
  }
  return { succeeded, failed };
}
function bulkRead(ids, req) {
  return runBulk(ids, (id) => markRead(id, req));
}
function bulkArchive(ids) {
  return runBulk(ids, (id) => archiveNotification(id));
}
function getNotificationCenterSummary(userId) {
  const rows = communicationStore.countNotifications(userId);
  return {
    total: rows.length,
    unread: rows.filter((n) => !n.read && !n.archived).length,
    read: rows.filter((n) => n.read && !n.archived).length,
    archived: rows.filter((n) => n.archived).length,
    pinned: rows.filter((n) => n.pinned).length,
    dismissed: rows.filter((n) => n.dismissed).length
  };
}

// server/operationsRouter.ts
var operationsRouter = Router4();
var requireAuth2 = [authenticateRequest];
var requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];
var requireModerator2 = [authenticateRequest, requireModerator];
function userCanManageCoupons(req) {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.ADMIN) || hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER) || hasRole(role, ROLES.MARKETING_MANAGER);
}
var ORDER_PATCH_ALLOWED_KEYS = [];
function pickOrderPatch(body) {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const rejected = Object.keys(raw).filter(
    (key) => !ORDER_PATCH_ALLOWED_KEYS.includes(key)
  );
  const patch = {};
  for (const key of ORDER_PATCH_ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      patch[key] = raw[key];
    }
  }
  return { patch, rejected };
}
function userCanMutateOrder(req, order) {
  const userId = req.userId;
  if (!userId) return false;
  if (order.buyerId === userId) return true;
  const role = req.userRole;
  if (role && (hasRole(role, ROLES.SUPER_ADMIN) || hasRole(role, ROLES.ADMIN) || hasRole(role, ROLES.SUPPORT_AGENT) || hasRole(role, ROLES.MODERATOR) || hasRole(role, ROLES.FINANCE_MANAGER))) {
    return true;
  }
  if (role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER))) {
    const subs = order.subOrders || [];
    return subs.some((sub) => sub.sellerId === userId);
  }
  return false;
}
function userIsOrderBuyer(req, order) {
  return Boolean(req.userId && order.buyerId === req.userId);
}
function userIsStaff(req) {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.SUPER_ADMIN) || hasRole(role, ROLES.ADMIN) || hasRole(role, ROLES.SUPPORT_AGENT) || hasRole(role, ROLES.MODERATOR) || hasRole(role, ROLES.FINANCE_MANAGER);
}
function userCanCreateManualOrder(req) {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  return Boolean(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)));
}
var CLAIM_TOKEN_TTL_MS = Number(process.env.ORDER_CLAIM_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1e3);
function generateOrderClaimToken() {
  return randomBytes2(32).toString("hex");
}
function buildClaimConfirmUrl(token) {
  const base = (process.env.CHOOSIFY_WEB_URL || process.env.VITE_CHOOSIFY_WEB_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/orders/confirm/${encodeURIComponent(token)}`;
}
function isClaimTokenExpired(order) {
  if (!order.claimTokenExpiresAt) return true;
  const expires = Date.parse(order.claimTokenExpiresAt);
  if (Number.isNaN(expires)) return true;
  return Date.now() > expires;
}
function userIsReturnSeller(req, row) {
  if (!req.userId || row.sellerId !== req.userId) return false;
  const role = req.userRole;
  return Boolean(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)));
}
function userCanManageReturnAsSellerOrAdmin(req, row) {
  if (userIsStaff(req)) return true;
  return userIsReturnSeller(req, row);
}
function userCanAddReturnNote(req, row) {
  return userCanManageReturnAsSellerOrAdmin(req, row);
}
function userCanUpdateShipment(req, shipmentOrderId) {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (!(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)))) {
    return false;
  }
  if (!req.userId) return false;
  const order = operationsStore.getOrder(shipmentOrderId);
  if (!order) return false;
  const subs = order.subOrders || [];
  return subs.some((sub) => sub.sellerId === req.userId);
}
function userHasPurchasedProductForReview(userId, productId) {
  if (!userId || !productId || productId === "unknown") return false;
  return operationsStore.listOrders().some((order) => {
    if (order.buyerId !== userId) return false;
    if (order.status === "cancelled") return false;
    const subs = order.subOrders || [];
    const deliveredItem = subs.some(
      (sub) => (sub.trackingStatus === "delivered" || order.status === "completed") && (sub.items || []).some((item) => String(item.productId) === String(productId))
    );
    if (deliveredItem) return true;
    const flatItems = order.items || [];
    return order.status === "completed" && flatItems.some((item) => String(item.productId) === String(productId));
  });
}
function userCanModerateOrEditReview(req, review) {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (role && hasRole(role, ROLES.MODERATOR)) return true;
  return Boolean(req.userId && review.userId === req.userId);
}
function userCanManageVerifications(req) {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.ADMIN) || hasRole(role, ROLES.SUPER_ADMIN) || hasRole(role, ROLES.MODERATOR);
}
function userCanViewVerification(req, row) {
  if (userCanManageVerifications(req)) return true;
  return Boolean(req.userId && row.submitted_by === req.userId);
}
async function applyEntityVerificationSideEffect(row, decision) {
  try {
    if (row.entityType === "brand") {
      const existing2 = await catalogStore2.getBrand(row.entityId);
      if (!existing2) {
        return { ok: false, error: `Brand ${row.entityId} not found in catalog` };
      }
      if (decision === "approved") {
        const normalized2 = normalizeBrandInput(
          { ...existing2, claimStatus: "verified", verifiedStatus: true },
          existing2
        );
        await catalogStore2.upsertBrand(normalized2);
      } else {
        const normalized2 = normalizeBrandInput(
          { ...existing2, claimStatus: "community", verifiedStatus: false },
          existing2
        );
        await catalogStore2.upsertBrand(normalized2);
      }
      return { ok: true };
    }
    const existing = await catalogStore2.getCreator(row.entityId);
    if (!existing) {
      return { ok: false, error: `Creator ${row.entityId} not found in catalog` };
    }
    const normalized = normalizeCreatorInput(
      { ...existing, verifiedStatus: decision === "approved" },
      existing
    );
    await catalogStore2.upsertCreator(normalized);
    return { ok: true };
  } catch (error2) {
    return {
      ok: false,
      error: error2 instanceof Error ? error2.message : "Failed to update catalog entity"
    };
  }
}
async function markEntityClaimPending(row) {
  if (row.entityType !== "brand") return;
  const existing = await catalogStore2.getBrand(row.entityId);
  if (!existing) return;
  if (existing.claimStatus === "verified") return;
  const normalized = normalizeBrandInput({ ...existing, claimStatus: "pending" }, existing);
  await catalogStore2.upsertBrand(normalized);
}
function userCanListReturns(req, filter) {
  if (userIsStaff(req)) return true;
  const userId = req.userId;
  if (!userId) return false;
  if (filter.buyerId) {
    if (filter.buyerId !== userId) return false;
    return true;
  }
  if (filter.sellerId) {
    const role = req.userRole;
    if (!(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)))) {
      return false;
    }
    return filter.sellerId === userId;
  }
  return false;
}
function userCanListOrders(req, filter) {
  return userCanListReturns(req, filter);
}
function userCanListReviews(req, filter) {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (role && hasRole(role, ROLES.MODERATOR)) return true;
  const userId = req.userId;
  if (!userId) return false;
  if (filter.userId) return filter.userId === userId;
  return false;
}
function toExpiryOrder(order) {
  return {
    orderId: order.orderId,
    status: order.status,
    cancelledAt: "cancelledAt" in order ? order.cancelledAt : void 0,
    subOrders: order.subOrders || []
  };
}
function assertPostOrderReplyAllowed(orderId, skipExpiry, orderSnapshot) {
  if (skipExpiry) return null;
  const stored = orderId?.trim() ? operationsStore.getOrder(orderId.trim()) : null;
  const orderForEval = stored ? toExpiryOrder(stored) : orderSnapshot?.orderId || orderSnapshot?.subOrders?.length ? toExpiryOrder(orderSnapshot) : null;
  if (!orderForEval) return null;
  const expiry = evaluatePostOrderConversationExpiry(orderForEval);
  if (expiry.status === "closed") {
    return {
      error: "CONVERSATION_EXPIRED",
      message: expiry.closedLabel || "This conversation has ended",
      expiry,
      enforcedFrom: stored ? "store" : "snapshot"
    };
  }
  return null;
}
var normalizeReviewStatus = (status) => {
  const map = {
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
    flagged: "flagged",
    published: "published",
    deleted: "deleted",
    hidden: "hidden",
    Flagged: "flagged",
    Published: "published",
    Deleted: "deleted",
    Hidden: "hidden"
  };
  return map[status] ?? "pending";
};
operationsRouter.get("/operations/orders", ...requireAuth2, (req, res) => {
  let buyerId = typeof req.query.buyerId === "string" ? req.query.buyerId : void 0;
  let sellerId = typeof req.query.sellerId === "string" ? req.query.sellerId : void 0;
  const status = typeof req.query.status === "string" ? req.query.status : void 0;
  if (!userCanListOrders(req, { buyerId, sellerId })) {
    if (!buyerId && !sellerId && req.userId && req.userRole && (hasRole(req.userRole, ROLES.SELLER) || hasRole(req.userRole, ROLES.VERIFIED_SELLER))) {
      sellerId = req.userId;
    } else if (!buyerId && !sellerId && req.userId && !userIsStaff(req)) {
      buyerId = req.userId;
    }
    if (!userCanListOrders(req, { buyerId, sellerId })) {
      res.status(403).json({ error: "Not authorized to list these orders" });
      return;
    }
  }
  res.json({ data: operationsStore.listOrders({ buyerId, sellerId, status }) });
});
operationsRouter.get("/operations/orders/:id", ...requireAuth2, (req, res) => {
  const order = operationsStore.getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!userCanMutateOrder(req, order)) {
    res.status(403).json({ error: "Not authorized to view this order" });
    return;
  }
  res.json({ data: order });
});
operationsRouter.post("/operations/orders", ...requireAuth2, async (req, res) => {
  try {
    const body = req.body;
    if (!body.orderId) {
      res.status(400).json({ error: "orderId is required" });
      return;
    }
    const wantsManual = Boolean(body.isManual);
    let buyerId;
    if (wantsManual) {
      if (!userCanCreateManualOrder(req)) {
        res.status(403).json({ error: "Not authorized to create manual orders" });
        return;
      }
      buyerId = "unclaimed";
    } else {
      const bodyBuyerId = String(body.buyerId || "").trim();
      if (bodyBuyerId && bodyBuyerId !== req.userId) {
        res.status(403).json({ error: "buyerId does not match authenticated user" });
        return;
      }
      buyerId = req.userId;
    }
    const status = body.status === "pending_payment" || body.status === "confirmed" || body.status === "cancelled" || body.status === "completed" ? body.status : "active";
    let claimToken;
    let claimTokenExpiresAt;
    if (wantsManual) {
      claimToken = generateOrderClaimToken();
      claimTokenExpiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_MS).toISOString();
    }
    const saved = operationsStore.createOrder({
      orderId: body.orderId,
      buyerId,
      isCOD: Boolean(body.isCOD),
      isSplit: Boolean(body.isSplit),
      overallTotal: Number(body.overallTotal || 0),
      subtotal: body.subtotal,
      deliveryTotal: body.deliveryTotal,
      subOrders: body.subOrders || [],
      promoCode: body.promoCode,
      promoDiscount: body.promoDiscount,
      promoType: body.promoType,
      sourceMode: body.sourceMode,
      paymentMethod: body.paymentMethod,
      shipping: body.shipping,
      tradeLicense: body.tradeLicense,
      companyName: body.companyName,
      isQuotationRequest: body.isQuotationRequest,
      status,
      bookingRequestId: body.bookingRequestId,
      paymentDueAt: body.paymentDueAt,
      paidAt: body.paidAt,
      invoiceGeneratedAt: body.invoiceGeneratedAt,
      createdAt: body.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      isManual: wantsManual || void 0,
      platformSource: body.platformSource,
      claimToken,
      claimTokenExpiresAt,
      codDeliveryFeePaid: body.codDeliveryFeePaid,
      codDeliveryFeePaidAt: body.codDeliveryFeePaidAt,
      codRemainingAmount: body.codRemainingAmount,
      isPartialPayment: body.isPartialPayment,
      depositPercent: body.depositPercent,
      depositAmount: body.depositAmount,
      remainingAmount: body.remainingAmount,
      paymentProvider: body.paymentProvider,
      paymentStatus: body.paymentStatus,
      paymentTranId: body.paymentTranId,
      paymentValId: body.paymentValId,
      paidAmount: body.paidAmount,
      paymentValidatedAt: body.paymentValidatedAt
    });
    if (body.promoCode && body.promoDiscount) {
      const coupon = operationsStore.getCouponByCode(body.promoCode);
      if (coupon) {
        operationsStore.recordCouponUsage({
          couponId: coupon.id,
          couponCode: coupon.code,
          orderId: saved.orderId,
          userId: saved.buyerId,
          discountAmount: Number(body.promoDiscount || 0),
          originalAmount: Number(body.subtotal || body.overallTotal || 0),
          finalAmount: Number(body.overallTotal || 0),
          status: "redeemed"
        });
      }
    }
    const shipment = saved.status === "pending_payment" ? null : shipmentStore.createFromOrder(saved);
    scheduleOperationsPersist();
    try {
      await ensurePlatformOrderConversation(saved);
    } catch (err) {
      console.warn("[Order] Platform conversation bridge failed:", err);
    }
    let confirmOrderUrl;
    if (saved.claimToken && req.userId) {
      confirmOrderUrl = buildClaimConfirmUrl(saved.claimToken);
      try {
        await createNotification({
          userId: req.userId,
          type: COMMUNICATION_TYPES.ORDER_UPDATE,
          category: "seller",
          title: `Order claim link ready \u2014 ${saved.orderId}`,
          summary: `Share this link so the customer can confirm order ${saved.orderId} on Choosify.bd.`,
          actionUrl: confirmOrderUrl,
          channels: [DELIVERY_CHANNELS.IN_APP],
          metadata: {
            orderId: saved.orderId,
            claimTokenExpiresAt: saved.claimTokenExpiresAt
          }
        }, req);
      } catch (err) {
        console.warn("[Order] Claim-link notification failed:", err);
      }
    }
    res.status(201).json({
      success: true,
      data: saved,
      shipmentId: shipment?.id,
      confirmOrderUrl
    });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Invalid order payload" });
  }
});
operationsRouter.get("/operations/orders/claim/:token", (req, res) => {
  const order = operationsStore.getOrderByClaimToken(req.params.token);
  if (!order || isClaimTokenExpired(order)) {
    res.status(404).json({ error: "This order link is invalid or has expired." });
    return;
  }
  res.json({
    data: {
      orderId: order.orderId,
      overallTotal: order.overallTotal,
      subtotal: order.subtotal,
      deliveryTotal: order.deliveryTotal,
      isCOD: order.isCOD,
      paymentMethod: order.paymentMethod,
      platformSource: order.platformSource,
      subOrders: order.subOrders,
      createdAt: order.createdAt,
      claimed: Boolean(order.claimedAt),
      claimedByName: order.claimedByName,
      claimTokenExpiresAt: order.claimTokenExpiresAt
    }
  });
});
operationsRouter.post("/operations/orders/claim/:token/confirm", ...requireAuth2, (req, res) => {
  const token = req.params.token;
  const abuse = recordClaimConfirmAttempt(req.ip, token);
  if (abuse.thresholdExceeded) {
    res.status(429).json({ error: "Too many confirmation attempts. Please try again later." });
    return;
  }
  const bodyBuyerId = String(req.body?.buyerId || "").trim();
  if (bodyBuyerId && bodyBuyerId !== req.userId) {
    res.status(403).json({ error: "buyerId does not match authenticated user" });
    return;
  }
  const buyerId = req.userId;
  const buyerName = String(req.body?.buyerName || "").trim() || req.user?.displayName || void 0;
  const existing = operationsStore.getOrderByClaimToken(token);
  if (!existing || isClaimTokenExpired(existing)) {
    res.status(404).json({ error: "This order link is invalid or has expired." });
    return;
  }
  if (existing.claimedAt && existing.buyerId !== buyerId) {
    res.status(409).json({ error: "This order has already been confirmed by another account." });
    return;
  }
  const saved = operationsStore.claimOrder(token, {
    buyerId,
    buyerName
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.patch("/operations/orders/:id", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getOrder(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!userCanMutateOrder(req, existing)) {
    res.status(403).json({ error: "Not authorized to modify this order" });
    return;
  }
  const { patch, rejected } = pickOrderPatch(req.body);
  if (rejected.length > 0) {
    res.status(400).json({
      error: "One or more fields are not allowed on this endpoint",
      rejected,
      allowed: [...ORDER_PATCH_ALLOWED_KEYS]
    });
    return;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({
      error: "No updatable fields provided",
      allowed: [...ORDER_PATCH_ALLOWED_KEYS]
    });
    return;
  }
  const saved = operationsStore.updateOrder(req.params.id, patch);
  if (!saved) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.post("/operations/orders/:id/cancel", ...requireAuth2, (req, res) => {
  const reason = String(req.body?.reason || req.body?.cancelReason || "").trim();
  if (!reason) {
    res.status(400).json({ error: "reason is required" });
    return;
  }
  const existing = operationsStore.getOrder(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!userIsOrderBuyer(req, existing)) {
    res.status(403).json({ error: "Only the order buyer can cancel this order" });
    return;
  }
  const bodyBuyerId = String(req.body?.buyerId || "").trim();
  if (bodyBuyerId && bodyBuyerId !== req.userId) {
    res.status(403).json({ error: "buyerId does not match authenticated user" });
    return;
  }
  if (existing.status === "cancelled") {
    res.status(400).json({ error: "Order is already cancelled" });
    return;
  }
  if (existing.status === "completed") {
    res.status(400).json({ error: "Completed orders cannot be cancelled" });
    return;
  }
  const BLOCKED_TRACKING = /* @__PURE__ */ new Set([
    "dispatched",
    "transit",
    "delivered",
    "picked_up",
    "in_transit",
    "cancelled"
  ]);
  const subs = existing.subOrders || [];
  const alreadyMoving = subs.some((sub) => {
    const tracking = String(sub.trackingStatus || "pending").toLowerCase();
    return BLOCKED_TRACKING.has(tracking);
  });
  if (alreadyMoving) {
    res.status(400).json({
      error: "This order has already been dispatched and cannot be cancelled."
    });
    return;
  }
  const ts = (/* @__PURE__ */ new Date()).toISOString();
  const saved = operationsStore.updateOrder(req.params.id, {
    status: "cancelled",
    cancelledAt: ts,
    cancelReason: reason,
    cancelledBy: "buyer"
  });
  if (!saved) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.get("/operations/returns", ...requireAuth2, (req, res) => {
  let buyerId = typeof req.query.buyerId === "string" ? req.query.buyerId : void 0;
  let sellerId = typeof req.query.sellerId === "string" ? req.query.sellerId : void 0;
  const status = typeof req.query.status === "string" ? req.query.status : void 0;
  if (!userCanListReturns(req, { buyerId, sellerId })) {
    if (!buyerId && !sellerId && req.userId && req.userRole && (hasRole(req.userRole, ROLES.SELLER) || hasRole(req.userRole, ROLES.VERIFIED_SELLER))) {
      sellerId = req.userId;
    } else if (!buyerId && !sellerId && req.userId && !userIsStaff(req)) {
      buyerId = req.userId;
    }
    if (!userCanListReturns(req, { buyerId, sellerId })) {
      res.status(403).json({ error: "Not authorized to list these returns" });
      return;
    }
  }
  const rows = operationsStore.listReturns({ buyerId, sellerId, status });
  res.json({ data: rows });
});
operationsRouter.get("/operations/returns/:id", ...requireAuth2, (req, res) => {
  const row = operationsStore.getReturn(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  const isBuyer = Boolean(req.userId && row.buyerId === req.userId);
  if (!isBuyer && !userCanManageReturnAsSellerOrAdmin(req, row)) {
    res.status(403).json({ error: "Not authorized to view this return" });
    return;
  }
  res.json({ data: row });
});
operationsRouter.post("/operations/returns", ...requireAuth2, (req, res) => {
  const body = req.body;
  const orderId = String(body.orderId || "").trim();
  const buyerId = String(body.buyerId || "").trim();
  const sellerId = String(body.sellerId || "").trim();
  const reason = body.reason;
  const description = String(body.description || "").trim();
  if (!orderId || !buyerId || !sellerId || !reason || !description) {
    res.status(400).json({
      error: "orderId, buyerId, sellerId, reason, and description are required"
    });
    return;
  }
  if (!req.userId || buyerId !== req.userId) {
    res.status(403).json({ error: "buyerId must match the authenticated user" });
    return;
  }
  const saved = operationsStore.createReturn({
    orderId,
    itemId: String(body.itemId || "").trim(),
    initiatedBy: body.initiatedBy === "admin" ? "admin" : "customer",
    reason,
    description,
    evidencePhotos: Array.isArray(body.evidencePhotos) ? body.evidencePhotos : [],
    status: body.status || "initiated",
    refundStatus: body.refundStatus || "pending",
    notes: Array.isArray(body.notes) ? body.notes : [],
    sellerId,
    buyerId,
    ...body.id ? { id: body.id } : {},
    ...body.approvalDecision ? { approvalDecision: body.approvalDecision } : {},
    ...body.approvalReason ? { approvalReason: body.approvalReason } : {},
    ...body.approvedAt ? { approvedAt: body.approvedAt } : {},
    ...body.approvedBy ? { approvedBy: body.approvedBy } : {},
    ...typeof body.refundAmount === "number" ? { refundAmount: body.refundAmount } : {},
    ...body.returnTrackingId ? { returnTrackingId: body.returnTrackingId } : {},
    ...body.returnCourier ? { returnCourier: body.returnCourier } : {},
    ...body.pickupDate ? { pickupDate: body.pickupDate } : {},
    ...body.deliveryDate ? { deliveryDate: body.deliveryDate } : {},
    ...body.disputeId ? { disputeId: body.disputeId } : {}
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/returns/:id/approve", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: "Not authorized to approve this return" });
    return;
  }
  const refundAmount = Number(req.body?.refundAmount);
  if (!Number.isFinite(refundAmount)) {
    res.status(400).json({ error: "refundAmount is required" });
    return;
  }
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  const approvedBy = typeof req.body?.approvedBy === "string" && req.body.approvedBy.trim() ? req.body.approvedBy.trim() : req.user?.displayName || req.userId || "Admin Main";
  const adminNotes = [...existing.notes];
  if (note) adminNotes.push(note);
  adminNotes.push(`Return approved with refund of \u09F3${refundAmount}. Waiting for item return.`);
  const saved = operationsStore.updateReturn(req.params.id, {
    status: "approved",
    approvalDecision: "approved",
    approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
    approvedBy,
    refundAmount,
    notes: adminNotes
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.patch("/operations/returns/:id/reject", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: "Not authorized to reject this return" });
    return;
  }
  const reason = String(req.body?.reason || "").trim();
  if (!reason) {
    res.status(400).json({ error: "reason is required" });
    return;
  }
  const approvedBy = typeof req.body?.approvedBy === "string" && req.body.approvedBy.trim() ? req.body.approvedBy.trim() : req.user?.displayName || req.userId || "Admin Main";
  const adminNotes = [...existing.notes];
  adminNotes.push(`Return rejected. Reason: "${reason}"`);
  const saved = operationsStore.updateReturn(req.params.id, {
    status: "rejected",
    approvalDecision: "rejected",
    approvalReason: reason,
    approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
    approvedBy,
    notes: adminNotes
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.patch("/operations/returns/:id/refund", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: "Not authorized to process this refund" });
    return;
  }
  const adminNotes = [...existing.notes];
  adminNotes.push("Refund successfully processed back to customer payment channel.");
  const saved = operationsStore.updateReturn(req.params.id, {
    status: "refunded",
    refundStatus: "processed",
    notes: adminNotes
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.patch("/operations/returns/:id/status", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: "Not authorized to update this return status" });
    return;
  }
  const status = String(req.body?.status || "").trim();
  const allowed = [
    "initiated",
    "approved",
    "rejected",
    "returned_in_transit",
    "received",
    "refunded",
    "dispute"
  ];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: "Invalid status", allowed });
    return;
  }
  const adminNotes = [...existing.notes];
  adminNotes.push(`Status transitioned to: ${status.toUpperCase()}`);
  const saved = operationsStore.updateReturn(req.params.id, {
    status,
    notes: adminNotes
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.patch("/operations/returns/:id/note", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  if (!userCanAddReturnNote(req, existing)) {
    res.status(403).json({ error: "Not authorized to add a note on this return" });
    return;
  }
  const note = String(req.body?.note || "").trim();
  if (!note) {
    res.status(400).json({ error: "note is required" });
    return;
  }
  const saved = operationsStore.updateReturn(req.params.id, {
    notes: [...existing.notes, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${note}`]
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.post("/operations/returns/:id/label", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: "Not authorized to generate a return label" });
    return;
  }
  const trackingId = `PATHAO-RET-${Math.floor(1e5 + Math.random() * 9e5)}`;
  const courier = "Pathao Delivery";
  const labelUrl = `https://api.choosify.bd/logistics/label/${trackingId}`;
  const saved = operationsStore.updateReturn(req.params.id, {
    returnTrackingId: trackingId,
    returnCourier: courier,
    notes: [...existing.notes, `Prepaid Return Label generated with tracking ID ${trackingId}.`]
  });
  scheduleOperationsPersist();
  res.json({
    success: true,
    data: saved,
    labelUrl,
    trackingId,
    courier
  });
});
operationsRouter.patch("/operations/returns/:id/dispute", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: "Not authorized to escalate this return" });
    return;
  }
  const disputeId = String(req.body?.disputeId || "").trim();
  if (!disputeId) {
    res.status(400).json({ error: "disputeId is required" });
    return;
  }
  const saved = operationsStore.updateReturn(req.params.id, {
    status: "dispute",
    disputeId,
    notes: [
      ...existing.notes,
      `Escalated to Dispute resolution system. Dispute ID: ${disputeId}`
    ]
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.get("/operations/coupons", (_req, res) => {
  res.json({ data: operationsStore.listCoupons() });
});
operationsRouter.post("/operations/coupons", ...requireAuth2, (req, res) => {
  if (!userCanManageCoupons(req)) {
    res.status(403).json({ error: "Not authorized to create coupons" });
    return;
  }
  const body = req.body;
  if (!body.code?.trim()) {
    res.status(400).json({ error: "Coupon code is required" });
    return;
  }
  const existing = operationsStore.getCouponByCode(body.code);
  if (existing && existing.id !== body.id) {
    res.status(409).json({ error: "Coupon code already exists" });
    return;
  }
  const saved = operationsStore.upsertCoupon({
    id: body.id || `coup_${Date.now()}`,
    code: body.code.toUpperCase().trim(),
    type: body.type || "percentage",
    discountTarget: body.discountTarget || "all_products",
    discountValue: Number(body.discountValue || 0),
    validFrom: body.validFrom || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    validUntil: body.validUntil || "2026-12-31",
    active: body.active ?? true,
    rules: body.rules || {},
    description: body.description || "",
    totalUsages: body.totalUsages ?? 0,
    totalRedemptions: body.totalRedemptions ?? 0,
    totalDiscountGiven: body.totalDiscountGiven ?? 0,
    createdAt: body.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/coupons/:id", ...requireAuth2, (req, res) => {
  if (!userCanManageCoupons(req)) {
    res.status(403).json({ error: "Not authorized to update coupons" });
    return;
  }
  const existing = operationsStore.getCoupon(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  const saved = operationsStore.upsertCoupon({ ...existing, ...req.body, id: existing.id });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.delete("/operations/coupons/:id", ...requireAuth2, (req, res) => {
  if (!userCanManageCoupons(req)) {
    res.status(403).json({ error: "Not authorized to delete coupons" });
    return;
  }
  const ok = operationsStore.deleteCoupon(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});
operationsRouter.get("/operations/fee-charges", (_req, res) => {
  res.json({ data: operationsStore.listFeeCharges() });
});
operationsRouter.post("/operations/fee-charges", ...requireAdmin, (req, res) => {
  const body = req.body;
  if (!body.name?.trim()) {
    res.status(400).json({ error: "Fee/charge name is required" });
    return;
  }
  const saved = operationsStore.upsertFeeCharge({
    id: body.id || `fee_${Date.now()}`,
    name: body.name.trim(),
    type: body.type || "platform_fee",
    rateType: body.rateType || "percentage",
    rateValue: Number(body.rateValue || 0),
    scopeType: body.scopeType || "platform",
    scopeBrandIds: body.scopeBrandIds || [],
    scopeCategoryIds: body.scopeCategoryIds || [],
    scopeProductIds: body.scopeProductIds || [],
    active: body.active ?? true,
    description: body.description || "",
    createdAt: body.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/fee-charges/:id", ...requireAdmin, (req, res) => {
  const existing = operationsStore.getFeeCharge(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Fee/charge rule not found" });
    return;
  }
  const saved = operationsStore.upsertFeeCharge({ ...existing, ...req.body, id: existing.id });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.delete("/operations/fee-charges/:id", ...requireAdmin, (req, res) => {
  const ok = operationsStore.deleteFeeCharge(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Fee/charge rule not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});
operationsRouter.get("/operations/payment-options", (_req, res) => {
  res.json({ data: operationsStore.getPaymentOptionsConfig() });
});
operationsRouter.put("/operations/payment-options", ...requireAdmin, (req, res) => {
  const body = req.body;
  if (body.minDepositPercent !== void 0 && body.maxDepositPercent !== void 0 && Number(body.minDepositPercent) > Number(body.maxDepositPercent)) {
    res.status(400).json({ error: "Minimum deposit percent cannot exceed maximum deposit percent" });
    return;
  }
  const saved = operationsStore.updatePaymentOptionsConfig({
    ...body.partialPaymentEnabled !== void 0 && { partialPaymentEnabled: body.partialPaymentEnabled },
    ...body.minDepositPercent !== void 0 && { minDepositPercent: Number(body.minDepositPercent) },
    ...body.maxDepositPercent !== void 0 && { maxDepositPercent: Number(body.maxDepositPercent) }
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.post(
  "/operations/coupons/validate",
  validate({ body: CouponValidateBodySchema }),
  (req, res) => {
    const { code, cartTotal, userId, cartItems } = req.body;
    const coupon = operationsStore.getCouponByCode(code.trim());
    if (!coupon) {
      res.json({ valid: false, discount: 0, reason: "Invalid or expired promo code." });
      return;
    }
    const userUsageCount = userId ? operationsStore.countCouponUsageForUser(coupon.id, userId) : 0;
    const result = validateCoupon(coupon, Number(cartTotal || 0), userId, cartItems, userUsageCount);
    res.json(result);
  }
);
operationsRouter.get("/operations/reviews", ...requireAuth2, (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const productId = typeof req.query.productId === "string" ? req.query.productId : "";
  let userId = typeof req.query.userId === "string" ? req.query.userId : void 0;
  if (!userCanListReviews(req, { userId })) {
    if (!userId && req.userId && !userIsStaff(req) && !(req.userRole && hasRole(req.userRole, ROLES.MODERATOR))) {
      userId = req.userId;
    }
    if (!userCanListReviews(req, { userId })) {
      res.status(403).json({ error: "Not authorized to list these reviews" });
      return;
    }
  }
  const reviews = operationsStore.listReviews({
    status: status || void 0,
    productId: productId || void 0,
    userId: userId || void 0
  });
  res.json({ data: reviews });
});
operationsRouter.get("/operations/reviews/public", (req, res) => {
  const productId = typeof req.query.productId === "string" ? req.query.productId : "";
  const brandName = typeof req.query.brandName === "string" ? req.query.brandName.trim() : "";
  if (!productId && !brandName) {
    res.status(400).json({ error: "productId or brandName is required" });
    return;
  }
  const reviews = operationsStore.listReviews({
    productId: productId || void 0,
    brandName: brandName || void 0,
    status: "published"
  }).map((review) => ({
    id: review.id,
    userName: review.userName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    productId: review.productId,
    productTitle: review.productTitle,
    brandName: review.brandName,
    response: review.response
  }));
  res.json({ data: reviews });
});
operationsRouter.post("/operations/reviews", ...requireAuth2, (req, res) => {
  const body = req.body;
  if (!body.productTitle?.trim() || !body.comment?.trim() || !body.rating) {
    res.status(400).json({ error: "productTitle, rating, and comment are required" });
    return;
  }
  const productId = body.productId || "unknown";
  const userId = req.userId;
  if (!userHasPurchasedProductForReview(userId, productId)) {
    res.status(403).json({
      error: "A completed/delivered purchase of this product is required to leave a review"
    });
    return;
  }
  const saved = operationsStore.createReview({
    userId,
    userName: body.userName || "Anonymous",
    productId,
    productTitle: body.productTitle,
    brandName: body.brandName || "",
    storeName: body.storeName || "",
    rating: Math.min(5, Math.max(1, Number(body.rating))),
    comment: body.comment.trim()
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/reviews/:id", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReview(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  if (!userCanModerateOrEditReview(req, existing)) {
    res.status(403).json({ error: "Not authorized to update this review" });
    return;
  }
  const patch = { ...req.body };
  if (patch.status && !userIsStaff(req) && !(req.userRole && hasRole(req.userRole, ROLES.MODERATOR))) {
    delete patch.status;
  } else if (patch.status) {
    patch.status = normalizeReviewStatus(String(patch.status));
  }
  delete patch.userId;
  const saved = operationsStore.updateReview(req.params.id, patch);
  if (!saved) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.delete("/operations/reviews/:id", ...requireAuth2, (req, res) => {
  const existing = operationsStore.getReview(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  if (!userCanModerateOrEditReview(req, existing)) {
    res.status(403).json({ error: "Not authorized to delete this review" });
    return;
  }
  const ok = operationsStore.deleteReview(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});
operationsRouter.get("/operations/leads", (_req, res) => {
  res.json({ data: operationsStore.listLeads() });
});
operationsRouter.post("/operations/leads", (req, res) => {
  const abuse = recordSuspiciousRequest(req.ip, req.originalUrl);
  if (abuse.thresholdExceeded) {
    res.status(429).json({ error: "Too many submissions. Please try again later." });
    return;
  }
  const body = req.body;
  if (!body.brandName?.trim() || !body.email?.trim()) {
    res.status(400).json({ error: "brandName and email are required" });
    return;
  }
  const saved = operationsStore.createLead({
    source: body.source || "advertise-page",
    brandName: body.brandName.trim(),
    contactPerson: body.contactPerson?.trim(),
    email: body.email.trim(),
    budget: body.budget,
    placementInterest: body.placementInterest,
    message: body.message?.trim()
  });
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/leads/:id", ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateLead(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ success: true, data: saved });
});
operationsRouter.get("/operations/jobs/public", (_req, res) => {
  res.json({ data: operationsStore.listJobPostings({ publicOnly: true }) });
});
operationsRouter.get("/operations/jobs/public/:idOrSlug", (req, res) => {
  const job = operationsStore.getJobPosting(req.params.idOrSlug);
  if (!job || job.status !== "open") {
    res.status(404).json({ error: "Job posting not found" });
    return;
  }
  res.json({ data: job });
});
operationsRouter.get("/operations/jobs", (_req, res) => {
  res.json({ data: operationsStore.listJobPostings() });
});
operationsRouter.post("/operations/jobs", ...requireAdmin, (req, res) => {
  const body = req.body;
  if (!body.title?.trim() || !body.department?.trim() || !body.location?.trim()) {
    res.status(400).json({ error: "title, department, and location are required" });
    return;
  }
  const employmentType = body.employmentType || "full_time";
  const status = body.status || "open";
  const saved = operationsStore.createJobPosting({
    title: body.title.trim(),
    department: body.department.trim(),
    location: body.location.trim(),
    employmentType,
    summary: (body.summary || "").trim(),
    description: (body.description || "").trim(),
    responsibilities: (body.responsibilities || "").trim(),
    requirements: (body.requirements || "").trim(),
    status,
    slug: body.slug?.trim()
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/jobs/:id", ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateJobPosting(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: "Job posting not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.delete("/operations/jobs/:id", ...requireAdmin, (req, res) => {
  const ok = operationsStore.deleteJobPosting(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Job posting not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});
operationsRouter.get("/operations/job-applications", ...requireAdmin, (req, res) => {
  const jobId = typeof req.query.jobId === "string" ? req.query.jobId : void 0;
  res.json({ data: operationsStore.listJobApplications(jobId) });
});
operationsRouter.post("/operations/job-applications", ...requireAuth2, (req, res) => {
  const body = req.body;
  if (!body.jobId?.trim() || !body.name?.trim() || !body.email?.trim() || !body.resumeUrl?.trim()) {
    res.status(400).json({ error: "jobId, name, email, and resumeUrl are required" });
    return;
  }
  const job = operationsStore.getJobPosting(body.jobId.trim());
  if (!job || job.status !== "open") {
    res.status(404).json({ error: "Open job posting not found" });
    return;
  }
  const saved = operationsStore.createJobApplication({
    jobId: job.id,
    jobTitle: job.title,
    name: body.name.trim(),
    email: body.email.trim(),
    phone: (body.phone || "").trim(),
    resumeUrl: body.resumeUrl.trim(),
    resumeFileName: body.resumeFileName?.trim(),
    coverLetter: (body.coverLetter || "").trim()
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/job-applications/:id", ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateJobApplication(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.post("/operations/media/upload-resume", ...requireAuth2, async (req, res) => {
  try {
    const { validateDocumentUploadInput: validateDocumentUploadInput2 } = await Promise.resolve().then(() => (init_uploadValidation(), uploadValidation_exports));
    const { uploadDocumentToCloudinary: uploadDocumentToCloudinary2 } = await Promise.resolve().then(() => (init_mediaUpload(), mediaUpload_exports));
    const body = req.body;
    const validation = validateDocumentUploadInput2({
      base64Data: body.data || "",
      mimeType: body.mimeType,
      fileName: body.fileName
    });
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const url = await uploadDocumentToCloudinary2({
      base64Data: body.data,
      mimeType: validation.mimeType,
      fileName: validation.fileName
    });
    res.status(201).json({ success: true, url, fileName: validation.fileName });
  } catch (error2) {
    res.status(500).json({
      error: error2 instanceof Error ? error2.message : "Resume upload failed"
    });
  }
});
operationsRouter.get("/operations/permissions", (_req, res) => {
  res.json({ permissions: operationsStore.getPermissions(), defaults: DEFAULT_ROLE_PERMISSIONS });
});
operationsRouter.put("/operations/permissions", ...requireAdmin, (req, res) => {
  const permissions = req.body?.permissions;
  if (!permissions || typeof permissions !== "object") {
    res.status(400).json({ error: "permissions object is required" });
    return;
  }
  const saved = operationsStore.updatePermissions(permissions);
  scheduleOperationsPersist();
  res.json({ success: true, permissions: saved });
});
operationsRouter.get("/operations/permissions/check", (req, res) => {
  const role = typeof req.query.role === "string" ? req.query.role : "";
  const permission = typeof req.query.permission === "string" ? req.query.permission : "";
  if (!role || !permission) {
    res.status(400).json({ error: "role and permission query params are required" });
    return;
  }
  const permissions = operationsStore.getPermissions();
  const rolePerms = permissions[role] || DEFAULT_ROLE_PERMISSIONS[role];
  const allowed = role === "super_admin" || Boolean(rolePerms?.[permission]);
  res.json({ allowed, role, permission });
});
operationsRouter.get("/operations/analytics", (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "30d";
  res.json({ data: getAnalyticsSummary(range) });
});
operationsRouter.get("/operations/analytics/role/:role", (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "30d";
  res.json({ data: getRoleAnalytics(req.params.role, range) });
});
operationsRouter.get("/operations/seller-dashboard", async (req, res) => {
  try {
    const sellerId = typeof req.query.sellerId === "string" ? req.query.sellerId.trim() : "";
    if (!sellerId) {
      res.status(400).json({ error: "sellerId query parameter is required" });
      return;
    }
    const data = await getSellerDashboardIntelligence({
      sellerId,
      sellerName: typeof req.query.sellerName === "string" ? req.query.sellerName : void 0,
      storeName: typeof req.query.storeName === "string" ? req.query.storeName : void 0,
      range: typeof req.query.range === "string" ? req.query.range : void 0
    });
    res.json({ data });
  } catch (error2) {
    res.status(500).json({
      error: error2 instanceof Error ? error2.message : "Failed to load seller dashboard intelligence"
    });
  }
});
operationsRouter.get("/operations/shipments", (_req, res) => {
  res.json({ data: shipmentStore.listShipments() });
});
operationsRouter.get("/operations/shipments/:id", (req, res) => {
  const shipment = shipmentStore.getShipment(req.params.id);
  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  res.json({ data: shipment });
});
operationsRouter.patch("/operations/shipments/:id", ...requireAuth2, (req, res) => {
  const existing = shipmentStore.getShipment(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  if (!userCanUpdateShipment(req, existing.orderId)) {
    res.status(403).json({ error: "Not authorized to update this shipment" });
    return;
  }
  const saved = shipmentStore.updateShipment(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  res.json({ success: true, data: saved });
});
operationsRouter.get("/operations/platform-messages", ...requireAuth2, async (req, res) => {
  try {
    const conversationIdRaw = typeof req.query.conversationId === "string" ? req.query.conversationId.trim() : typeof req.query.threadId === "string" ? req.query.threadId.trim() : "";
    let userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    let conversationId = conversationIdRaw;
    if (!conversationId) {
      if (!userId) userId = req.userId || "";
      if (!userId) {
        res.status(400).json({ error: "conversationId, threadId, or userId is required" });
        return;
      }
      conversationId = `conv_platform_${userId}`;
    }
    const ownConversation = req.userId ? `conv_platform_${req.userId}` : "";
    const isOwnInbox = Boolean(req.userId && conversationId === ownConversation);
    const requestedUserId = userId || (conversationId.startsWith("conv_platform_") ? conversationId.slice("conv_platform_".length) : "");
    if (userId && userId !== req.userId && !userIsStaff(req)) {
      res.status(403).json({ error: "Not authorized to list these messages" });
      return;
    }
    if (!isOwnInbox && !(requestedUserId && requestedUserId === req.userId) && !userIsStaff(req)) {
      res.status(403).json({ error: "Not authorized to list these messages" });
      return;
    }
    const { listMessages: listMessages2 } = await Promise.resolve().then(() => (init_omniStore(), omniStore_exports));
    const messages = await listMessages2(conversationId);
    res.json({ data: messages, conversationId });
  } catch (error2) {
    res.status(500).json({
      error: error2 instanceof Error ? error2.message : "Failed to list platform messages"
    });
  }
});
operationsRouter.post("/operations/platform-messages", ...requireAuth2, async (req, res) => {
  try {
    const { buyerId, userName, body, orderId, bookingOffer, conversationId, isComplaint, sellerId, orderSnapshot } = req.body;
    if (!body?.trim()) {
      res.status(400).json({ error: "buyerId and body are required" });
      return;
    }
    const effectiveBuyerId = userIsStaff(req) ? buyerId?.trim() || req.userId || "" : req.userId || "";
    if (!effectiveBuyerId) {
      res.status(400).json({ error: "buyerId and body are required" });
      return;
    }
    if (!userIsStaff(req) && buyerId?.trim() && buyerId.trim() !== effectiveBuyerId) {
      res.status(403).json({ error: "Not authorized to post as another user" });
      return;
    }
    const skipExpiry = Boolean(bookingOffer) || Boolean(isComplaint);
    const blocked = assertPostOrderReplyAllowed(orderId, skipExpiry, orderSnapshot);
    if (blocked) {
      res.status(403).json(blocked);
      return;
    }
    let attachedOffer = bookingOffer;
    if (bookingOffer && !bookingOffer.requestId) {
      const { createBookingRequest: createBookingRequest2, resolveAutoApprove: resolveAutoApprove2, resolvePartialPaymentSettings: resolvePartialPaymentSettings2 } = await Promise.resolve().then(() => (init_bookingService(), bookingService_exports));
      const listingId = String(bookingOffer.listingId || "");
      const offerSellerId = String(bookingOffer.sellerId || "");
      const autoApprove = await resolveAutoApprove2(offerSellerId, listingId).catch(() => false);
      const partialPayment = await resolvePartialPaymentSettings2(listingId).catch(() => ({
        partialPaymentEnabled: false,
        depositPercent: void 0
      }));
      const created2 = await createBookingRequest2({
        listingId,
        listingTitle: String(bookingOffer.listingTitle || "Service listing"),
        listingImage: bookingOffer.listingImage,
        listingHref: bookingOffer.listingHref,
        sellerId: offerSellerId,
        sellerName: String(bookingOffer.sellerName || "Seller"),
        buyerId: effectiveBuyerId,
        buyerName: userName?.trim(),
        serviceCategory: bookingOffer.serviceCategory,
        isService: bookingOffer.isService !== false,
        fields: bookingOffer.fields || {},
        notes: bookingOffer.notes,
        price: Number(bookingOffer.price) || 0,
        originalPrice: bookingOffer.originalPrice !== void 0 ? Number(bookingOffer.originalPrice) : void 0,
        conversationId: `conv_platform_${effectiveBuyerId}`,
        autoApprove,
        partialPaymentEnabled: partialPayment.partialPaymentEnabled,
        depositPercent: partialPayment.depositPercent
      });
      attachedOffer = created2.offer;
    }
    const complaintPrefix = isComplaint ? `[Complaint${conversationId ? ` \xB7 thread ${conversationId}` : ""}${orderId ? ` \xB7 order ${orderId}` : ""}${sellerId ? ` \xB7 seller ${sellerId}` : ""}] ` : "";
    const result = await submitPlatformMessage({
      buyerId: effectiveBuyerId,
      userName: userName?.trim() || effectiveBuyerId,
      body: `${complaintPrefix}${body.trim()}`,
      orderId: orderId?.trim(),
      bookingOffer: attachedOffer
    });
    res.status(201).json({ success: true, data: result });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to submit message" });
  }
});
operationsRouter.get("/operations/conversation-expiry", (req, res) => {
  const orderId = String(req.query.orderId || "").trim();
  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }
  const order = operationsStore.getOrder(orderId);
  if (!order) {
    res.json({
      data: {
        status: "not_applicable",
        enforced: false,
        reason: "order_not_found_on_server"
      }
    });
    return;
  }
  const expiry = evaluatePostOrderConversationExpiry(toExpiryOrder(order));
  res.json({ data: { ...expiry, enforced: true } });
});
operationsRouter.get("/operations/shipments/track/:orderId", (req, res) => {
  const shipment = shipmentStore.getShipmentByOrderId(req.params.orderId);
  if (!shipment) {
    res.status(404).json({ error: "Shipment not found for this order" });
    return;
  }
  res.json({ data: shipment });
});
operationsRouter.get("/operations/feature-flags", (_req, res) => {
  res.json({ flags: operationsStore.getFeatureFlags() });
});
operationsRouter.put("/operations/feature-flags", ...requireAdmin, (req, res) => {
  const flags = req.body?.flags;
  if (!flags || typeof flags !== "object") {
    res.status(400).json({ error: "flags object is required" });
    return;
  }
  const saved = operationsStore.updateFeatureFlags(flags);
  scheduleOperationsPersist();
  res.json({ success: true, flags: saved });
});
operationsRouter.get("/operations/users", (_req, res) => {
  res.json({ data: operationsStore.listUsers() });
});
operationsRouter.get("/operations/seller-offers", (_req, res) => {
  res.json({ data: operationsStore.listSellerOffers() });
});
operationsRouter.post("/operations/seller-offers", (req, res) => {
  const abuse = recordSuspiciousRequest(req.ip, req.originalUrl);
  if (abuse.thresholdExceeded) {
    res.status(429).json({ error: "Too many submissions. Please try again later." });
    return;
  }
  const body = req.body;
  if (!body.productName?.trim() || !body.sellerName?.trim()) {
    res.status(400).json({ error: "productName and sellerName are required" });
    return;
  }
  const saved = operationsStore.createSellerOffer({
    productName: body.productName.trim(),
    category: body.category?.trim() || "General",
    brand: body.brand?.trim() || "",
    price: body.price?.trim() || "",
    description: body.description?.trim() || "",
    sellerName: body.sellerName.trim(),
    sellerPhone: body.sellerPhone?.trim() || "",
    sellerRegion: body.sellerRegion?.trim() || "Dhaka"
  });
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.patch("/operations/seller-offers/:id", ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateSellerOffer(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: "Seller offer not found" });
    return;
  }
  res.json({ success: true, data: saved });
});
operationsRouter.post("/operations/media/upload-verification", ...requireAuth2, async (req, res) => {
  try {
    const { validateVerificationUploadInput: validateVerificationUploadInput2 } = await Promise.resolve().then(() => (init_uploadValidation(), uploadValidation_exports));
    const { uploadVerificationAssetToCloudinary: uploadVerificationAssetToCloudinary2 } = await Promise.resolve().then(() => (init_mediaUpload(), mediaUpload_exports));
    const body = req.body;
    const validation = validateVerificationUploadInput2({
      base64Data: body.data || "",
      mimeType: body.mimeType,
      fileName: body.fileName
    });
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const url = await uploadVerificationAssetToCloudinary2({
      base64Data: body.data,
      mimeType: validation.mimeType,
      fileName: validation.fileName,
      kind: validation.kind
    });
    res.status(201).json({ success: true, url, fileName: validation.fileName, kind: validation.kind });
  } catch (error2) {
    res.status(500).json({
      error: error2 instanceof Error ? error2.message : "Verification upload failed"
    });
  }
});
operationsRouter.post("/operations/verifications", ...requireAuth2, async (req, res) => {
  const body = req.body;
  const entityType = body.entityType === "creator" ? "creator" : "brand";
  const entityId = String(body.entityId || body.brand_id || "").trim();
  const entityName = String(body.entityName || body.brand_name || "").trim();
  if (!entityId || !entityName) {
    res.status(400).json({ error: "entityId/entityName (or brand_id/brand_name) are required" });
    return;
  }
  if (body.submitted_by && body.submitted_by !== req.userId) {
    res.status(403).json({ error: "submitted_by does not match authenticated user" });
    return;
  }
  const documents = Array.isArray(body.documents) ? body.documents : [];
  for (const doc3 of documents) {
    if (!doc3?.type || !doc3?.name || !doc3?.doc_url) {
      res.status(400).json({ error: "Each document requires type, name, and doc_url" });
      return;
    }
  }
  const status = body.status === "Draft" || body.status === "Submitted" || body.status === "Under Review" ? body.status : "Submitted";
  const actorName = body.submitted_by_name?.trim() || req.user?.displayName || req.userId || "Claimant";
  const saved = operationsStore.createVerification({
    entityType,
    entityId,
    entityName,
    brand_id: entityType === "brand" ? entityId : body.brand_id || entityId,
    brand_name: entityType === "brand" ? entityName : body.brand_name || entityName,
    logo_url: body.logo_url || "",
    submitted_by: req.userId,
    submitted_by_name: actorName,
    status,
    documents: documents.map((doc3, index) => ({
      id: doc3.id || `doc_${Date.now()}_${index}`,
      type: doc3.type,
      name: doc3.name,
      doc_url: doc3.doc_url,
      status: doc3.status === "approved" || doc3.status === "rejected" ? doc3.status : "pending",
      notes: doc3.notes
    })),
    audit_trail: [
      {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        action: status === "Draft" ? "Draft Created" : "Request Submitted",
        actor: actorName,
        details: status === "Draft" ? "Initialized a draft verification dossier" : "Claim documents submitted for administrative review"
      }
    ]
  });
  if (status === "Submitted" || status === "Under Review") {
    try {
      await markEntityClaimPending(saved);
    } catch (err) {
      console.warn("[Verification] Failed to mark claim pending on catalog entity:", err);
    }
  }
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});
operationsRouter.get("/operations/verifications", ...requireAuth2, (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : void 0;
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : void 0;
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : void 0;
  if (userCanManageVerifications(req)) {
    res.json({
      data: operationsStore.listVerifications({ status, entityType, entityId })
    });
    return;
  }
  res.json({
    data: operationsStore.listVerifications({
      submittedBy: req.userId,
      status,
      entityType,
      entityId
    })
  });
});
operationsRouter.get("/operations/verifications/:id", ...requireAuth2, (req, res) => {
  const row = operationsStore.getVerification(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Verification request not found" });
    return;
  }
  if (!userCanViewVerification(req, row)) {
    res.status(403).json({ error: "Not authorized to view this verification request" });
    return;
  }
  res.json({ data: row });
});
operationsRouter.patch("/operations/verifications/:id/submit", ...requireAuth2, async (req, res) => {
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Verification request not found" });
    return;
  }
  if (!userCanViewVerification(req, existing)) {
    res.status(403).json({ error: "Not authorized to submit this verification request" });
    return;
  }
  if (existing.status !== "Draft" && existing.status !== "Submitted") {
    res.status(400).json({ error: `Cannot submit from status ${existing.status}` });
    return;
  }
  const actor = req.user?.displayName || req.userId || "Claimant";
  const saved = operationsStore.updateVerification(req.params.id, {
    status: "Submitted",
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        action: "Form Submitted",
        actor,
        details: "Dossier dispatched to lead auditor verification queue"
      }
    ]
  });
  try {
    if (saved) await markEntityClaimPending(saved);
  } catch (err) {
    console.warn("[Verification] mark pending failed:", err);
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});
operationsRouter.patch(
  "/operations/verifications/:id/document/:docId",
  ...requireModerator2,
  (req, res) => {
    if (!userCanManageVerifications(req)) {
      res.status(403).json({ error: "Not authorized to audit verification documents" });
      return;
    }
    const existing = operationsStore.getVerification(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Verification request not found" });
      return;
    }
    const status = req.body?.status === "rejected" ? "rejected" : req.body?.status === "approved" ? "approved" : "";
    if (!status) {
      res.status(400).json({ error: "status must be approved or rejected" });
      return;
    }
    const notes2 = typeof req.body?.notes === "string" ? req.body.notes.trim() : void 0;
    const actor = req.user?.displayName || req.userId || "Administrative Auditor";
    const saved = operationsStore.updateVerificationDocument(req.params.id, req.params.docId, {
      status,
      notes: notes2
    });
    if (!saved) {
      res.status(404).json({ error: "Document not found on this verification request" });
      return;
    }
    const withAudit = operationsStore.updateVerification(req.params.id, {
      status: saved.status === "Draft" || saved.status === "Submitted" ? "Under Review" : saved.status,
      audit_trail: [
        ...saved.audit_trail,
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          action: "Document Audited",
          actor,
          details: `Document item state updated to ${status}. Notes: ${notes2 || "none"}`
        }
      ]
    });
    scheduleOperationsPersist();
    res.json({ success: true, data: withAudit || saved });
  }
);
operationsRouter.patch("/operations/verifications/:id/review", ...requireModerator2, async (req, res) => {
  if (!userCanManageVerifications(req)) {
    res.status(403).json({ error: "Not authorized to review verification requests" });
    return;
  }
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Verification request not found" });
    return;
  }
  const decision = req.body?.status === "rejected" ? "rejected" : req.body?.status === "approved" ? "approved" : "";
  if (!decision) {
    res.status(400).json({ error: "status must be approved or rejected" });
    return;
  }
  const feedback = String(req.body?.feedback || "").trim();
  if (!feedback) {
    res.status(400).json({ error: "feedback is required" });
    return;
  }
  const sideEffect = await applyEntityVerificationSideEffect(existing, decision);
  if (sideEffect.ok === false) {
    res.status(409).json({ error: sideEffect.error });
    return;
  }
  const reviewerId = req.userId;
  const reviewerName = String(req.body?.reviewer_name || "").trim() || req.user?.displayName || reviewerId;
  const reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  const review = {
    id: `rvw_${Date.now()}`,
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    status: decision,
    feedback,
    reviewed_at: reviewedAt
  };
  const finalStatus = decision === "approved" ? "Approved" : "Rejected";
  const saved = operationsStore.updateVerification(req.params.id, {
    status: finalStatus,
    reviews: [...existing.reviews, review],
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: reviewedAt,
        action: decision === "approved" ? "Audit Approved" : "Audit Rejected",
        actor: reviewerName,
        details: `Verification finalized: ${feedback}. Catalog ${existing.entityType} claimStatus/verifiedStatus updated.`
      }
    ]
  });
  scheduleOperationsPersist();
  res.json({
    success: true,
    data: saved,
    catalogSideEffect: {
      entityType: existing.entityType,
      entityId: existing.entityId,
      decision,
      applied: true
    }
  });
});

// server/booking/bookingRouter.ts
init_bookingFieldConfig();
init_bookingTypes();
init_operationsStore();
init_operationsPersistence();
init_bookingStore();
init_bookingService();
import { Router as Router5 } from "express";
var bookingRouter = Router5();
bookingRouter.get("/booking/field-config", (_req, res) => {
  res.json({ success: true, data: getBookingFieldConfigPayload() });
});
bookingRouter.get("/booking/seller-settings/:sellerId", (req, res) => {
  res.json({ success: true, data: operationsStore.getSellerBookingSettings(req.params.sellerId) });
});
bookingRouter.patch("/booking/seller-settings/:sellerId", (req, res) => {
  try {
    const { autoApproveBookingsDefault } = req.body || {};
    if (typeof autoApproveBookingsDefault !== "boolean") {
      res.status(400).json({ error: "autoApproveBookingsDefault (boolean) is required" });
      return;
    }
    const updated = operationsStore.updateSellerBookingSettings(req.params.sellerId, {
      autoApproveBookingsDefault
    });
    scheduleOperationsPersist();
    res.json({ success: true, data: updated });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to update seller booking settings" });
  }
});
bookingRouter.get("/booking/requests", async (req, res) => {
  try {
    const rows = await listBookingRequests({
      sellerId: typeof req.query.sellerId === "string" ? req.query.sellerId : void 0,
      buyerId: typeof req.query.buyerId === "string" ? req.query.buyerId : void 0,
      conversationId: typeof req.query.conversationId === "string" ? req.query.conversationId : void 0,
      status: typeof req.query.status === "string" ? req.query.status : void 0
    });
    res.json({
      success: true,
      data: rows.map(toBookingOfferCard),
      requests: rows
    });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to list booking requests" });
  }
});
bookingRouter.get("/booking/requests/:id", async (req, res) => {
  try {
    const request = await getBookingRequest(req.params.id);
    if (!request) {
      res.status(404).json({ error: "Booking request not found" });
      return;
    }
    await sweepExpiredBookings();
    const fresh = await getBookingRequest(req.params.id) || request;
    res.json({ success: true, data: toBookingOfferCard(fresh), request: fresh });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Failed to load booking request" });
  }
});
bookingRouter.post("/booking/requests", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.listingId || !body.buyerId || !body.sellerId) {
      res.status(400).json({ error: "listingId, buyerId, and sellerId are required" });
      return;
    }
    const listingId = String(body.listingId);
    const sellerId = String(body.sellerId);
    const autoApprove = await resolveAutoApprove(sellerId, listingId).catch(() => false);
    const partialPayment = await resolvePartialPaymentSettings(listingId).catch(() => ({
      partialPaymentEnabled: false,
      depositPercent: void 0
    }));
    const result = await createBookingRequest({
      listingId,
      listingTitle: String(body.listingTitle || "Service listing"),
      listingImage: body.listingImage,
      listingHref: body.listingHref,
      sellerId,
      sellerName: String(body.sellerName || "Seller"),
      buyerId: String(body.buyerId),
      buyerName: body.buyerName,
      serviceCategory: body.serviceCategory,
      isService: body.isService !== false,
      fields: body.fields || {},
      notes: body.notes,
      price: Number(body.price) || 0,
      originalPrice: body.originalPrice !== void 0 ? Number(body.originalPrice) : void 0,
      conversationId: body.conversationId,
      autoApprove,
      partialPaymentEnabled: partialPayment.partialPaymentEnabled,
      depositPercent: partialPayment.depositPercent,
      threadId: body.threadId
    });
    res.status(201).json({ success: true, data: result.offer, request: result.request });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to create booking request" });
  }
});
bookingRouter.post("/booking/requests/:id/accept", async (req, res) => {
  try {
    const sellerId = String(req.body?.sellerId || "");
    if (!sellerId) {
      res.status(400).json({ error: "sellerId is required" });
      return;
    }
    const result = await acceptBookingRequest(req.params.id, {
      sellerId,
      sellerName: req.body?.sellerName
    });
    res.json({ success: true, data: result.offer, request: result.request, order: result.order });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to accept booking" });
  }
});
bookingRouter.post("/booking/requests/:id/decline", async (req, res) => {
  try {
    const sellerId = String(req.body?.sellerId || "");
    const declineReason = String(req.body?.declineReason || "");
    if (!sellerId) {
      res.status(400).json({ error: "sellerId is required" });
      return;
    }
    if (!declineReason.trim()) {
      res.status(400).json({ error: "declineReason is required" });
      return;
    }
    const result = await declineBookingRequest(
      req.params.id,
      { sellerId, sellerName: req.body?.sellerName },
      declineReason
    );
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to decline booking" });
  }
});
bookingRouter.post("/booking/requests/:id/counter", async (req, res) => {
  try {
    const sellerId = String(req.body?.sellerId || "");
    if (!sellerId) {
      res.status(400).json({ error: "sellerId is required" });
      return;
    }
    const result = await counterBookingRequest(
      req.params.id,
      { sellerId, sellerName: req.body?.sellerName },
      {
        price: req.body?.price !== void 0 ? Number(req.body.price) : void 0,
        fields: req.body?.fields,
        notes: req.body?.notes
      }
    );
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to counter booking" });
  }
});
bookingRouter.post("/booking/requests/:id/buyer-accept", async (req, res) => {
  try {
    const buyerId = String(req.body?.buyerId || "");
    if (!buyerId) {
      res.status(400).json({ error: "buyerId is required" });
      return;
    }
    const result = await buyerAcceptCounter(req.params.id, { buyerId });
    res.json({ success: true, data: result.offer, request: result.request, order: result.order });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to accept counter-offer" });
  }
});
bookingRouter.post("/booking/requests/:id/buyer-decline", async (req, res) => {
  try {
    const buyerId = String(req.body?.buyerId || "");
    if (!buyerId) {
      res.status(400).json({ error: "buyerId is required" });
      return;
    }
    const declineReason = req.body?.declineReason !== void 0 ? String(req.body.declineReason) : void 0;
    const result = await buyerDeclineBookingRequest(req.params.id, { buyerId }, declineReason);
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to decline offer" });
  }
});
bookingRouter.post("/booking/requests/:id/mark-paid", async (req, res) => {
  try {
    const paymentType = req.body?.paymentType === "partial" ? "partial" : "full";
    const result = await markBookingPaid(req.params.id, req.body?.orderId, paymentType);
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Failed to mark booking paid" });
  }
});
bookingRouter.post("/booking/expire", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth2 = String(req.headers.authorization || "");
      if (auth2 !== `Bearer ${secret}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    const result = await sweepExpiredBookings();
    res.json({ success: true, data: result });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Expiry sweep failed" });
  }
});
bookingRouter.get("/booking/expire", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth2 = String(req.headers.authorization || "");
      if (auth2 !== `Bearer ${secret}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    const result = await sweepExpiredBookings();
    res.json({ success: true, data: result });
  } catch (error2) {
    res.status(500).json({ error: error2 instanceof Error ? error2.message : "Expiry sweep failed" });
  }
});

// server/authRouter.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { Router as Router6 } from "express";
import { eq as eq3 } from "drizzle-orm";

// server/validation/auth/devLoginSchema.ts
import { z as z9 } from "zod";
var DevLoginBodySchema = z9.object({
  email: emailValidator.optional(),
  role: z9.string().trim().optional()
});

// server/validation/auth/loginSchema.ts
import { z as z10 } from "zod";
var LoginBodySchema = z10.object({
  email: emailValidator,
  password: passwordValidator
});

// server/validation/auth/registerSchema.ts
import { z as z11 } from "zod";
var RegisterBodySchema = z11.object({
  email: emailValidator,
  password: passwordValidator,
  fullName: z11.string().trim().min(2, "Your name is required").max(120)
});

// server/validation/auth/sellerRegisterSchema.ts
import { z as z12 } from "zod";
var SellerRegisterBodySchema = z12.object({
  email: emailValidator,
  password: passwordValidator,
  displayName: z12.string().trim().min(2, "Your name is required").max(120),
  storeName: z12.string().trim().min(2, "Business/brand name is required").max(160),
  phone: z12.string().trim().min(8, "Phone number is required").max(24).regex(/^\+?[0-9][0-9\s-]{6,22}$/, "Invalid phone number"),
  category: z12.string().trim().min(1, "Category is required").max(120),
  city: z12.string().trim().min(2, "City is required").max(80),
  website: z12.string().trim().max(320).optional().transform((value) => value && value.length > 0 ? value : void 0)
});

// server/authRouter.ts
init_operationsDb();
init_client();
init_schema();
var authRouter = Router6();
authRouter.get("/auth/seller-status", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Valid email query parameter is required" });
    return;
  }
  try {
    const profile = await loadAdminUserByEmail(email);
    const mappedRole = profile?.role ? toUserRole(profile.role) : void 0;
    const devRole = DEV_ROLE_MAP[email];
    const role = mappedRole || devRole;
    const hasSellerAccount = role === ROLES.SELLER || role === ROLES.VERIFIED_SELLER;
    res.json({
      hasSellerAccount,
      dashboardPath: "/seller/products"
    });
  } catch (error2) {
    Logger.warn("seller-status lookup failed", {
      requestId: req.requestId,
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    res.status(500).json({ error: "Unable to check seller status" });
  }
});
authRouter.post("/auth/login", validate({ body: LoginBodySchema }), async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const rows = await db.select().from(users).where(eq3(users.email, normalizedEmail)).limit(1);
    const user = rows[0];
    if (!user?.passwordHash) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified
    });
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshTokenCookie(res, refreshToken);
    recordLogin(req, {
      userId: user.id,
      metadata: { mode: "password", role: user.role }
    });
    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accessToken
    });
  } catch (error2) {
    Logger.warn("login failed", {
      requestId: req.requestId,
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    res.status(500).json({ error: "Unable to sign in" });
  }
});
authRouter.post("/auth/seller-register", validate({ body: SellerRegisterBodySchema }), async (req, res) => {
  const { email, password, displayName, storeName, phone, category, city, website } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const existingProfile = await loadAdminUserByEmail(normalizedEmail);
    if (existingProfile) {
      const role = toUserRole(existingProfile.role);
      if (role === ROLES.SELLER || role === ROLES.VERIFIED_SELLER) {
        res.status(409).json({
          error: "A seller account already exists for this email. Sign in instead.",
          code: "SELLER_EXISTS",
          loginPath: `/login?email=${encodeURIComponent(normalizedEmail)}&role=seller`
        });
        return;
      }
      res.status(409).json({
        error: "This email is already registered with another dashboard role.",
        code: "EMAIL_IN_USE"
      });
      return;
    }
    const passwordHash = await hashPassword(password);
    const uid = randomUUID4();
    const now = /* @__PURE__ */ new Date();
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: uid,
        email: normalizedEmail,
        passwordHash,
        displayName: displayName.trim(),
        role: ROLES.SELLER,
        emailVerified: false,
        createdAt: now,
        updatedAt: now
      });
      await tx.insert(sellerProfiles).values({
        userId: uid,
        storeName: storeName.trim(),
        phone: phone.trim(),
        category: category.trim(),
        city: city.trim(),
        website: website?.trim() || null,
        createdAt: now
      });
    });
    const accessToken = signAccessToken({
      id: uid,
      email: normalizedEmail,
      emailVerified: false
    });
    const refreshToken = await issueRefreshToken(uid);
    setRefreshTokenCookie(res, refreshToken);
    Logger.info("seller account registered", {
      requestId: req.requestId,
      uid,
      email: normalizedEmail
    });
    res.status(201).json({
      uid,
      email: normalizedEmail,
      displayName: displayName.trim(),
      role: ROLES.SELLER,
      customToken: accessToken,
      dashboardPath: "/seller/products"
    });
  } catch (error2) {
    Logger.warn("seller-register failed", {
      requestId: req.requestId,
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    res.status(500).json({ error: "Unable to create seller account" });
  }
});
authRouter.post("/auth/register", validate({ body: RegisterBodySchema }), async (req, res) => {
  const { email, password, fullName } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const existingProfile = await loadAdminUserByEmail(normalizedEmail);
    if (existingProfile) {
      res.status(409).json({
        error: "An account already exists for this email. Sign in instead.",
        code: "EMAIL_EXISTS"
      });
      return;
    }
    const passwordHash = await hashPassword(password);
    const uid = randomUUID4();
    const now = /* @__PURE__ */ new Date();
    await db.insert(users).values({
      id: uid,
      email: normalizedEmail,
      passwordHash,
      displayName: fullName.trim(),
      role: ROLES.USER,
      emailVerified: false,
      createdAt: now,
      updatedAt: now
    });
    const accessToken = signAccessToken({
      id: uid,
      email: normalizedEmail,
      emailVerified: false
    });
    const refreshToken = await issueRefreshToken(uid);
    setRefreshTokenCookie(res, refreshToken);
    Logger.info("customer account registered", {
      requestId: req.requestId,
      uid,
      email: normalizedEmail
    });
    res.status(201).json({
      uid,
      email: normalizedEmail,
      displayName: fullName.trim(),
      role: ROLES.USER,
      customToken: accessToken,
      dashboardPath: null
    });
  } catch (error2) {
    Logger.warn("register failed", {
      requestId: req.requestId,
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    res.status(500).json({ error: "Unable to create account" });
  }
});
authRouter.post("/auth/refresh", async (req, res) => {
  try {
    const raw = readRefreshTokenCookie(req.headers.cookie);
    if (!raw) {
      res.status(401).json({ error: "Missing refresh token" });
      return;
    }
    const rotated = await rotateRefreshToken(raw);
    if (!rotated) {
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }
    setRefreshTokenCookie(res, rotated.refreshToken);
    res.json({ accessToken: rotated.accessToken });
  } catch (error2) {
    Logger.warn("refresh failed", {
      requestId: req.requestId,
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    res.status(500).json({ error: "Unable to refresh session" });
  }
});
authRouter.post("/auth/logout", async (req, res) => {
  try {
    const raw = readRefreshTokenCookie(req.headers.cookie);
    if (raw) {
      await revokeRefreshToken(raw);
    }
    clearRefreshTokenCookie(res);
    res.json({ ok: true });
  } catch (error2) {
    Logger.warn("logout failed", {
      requestId: req.requestId,
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    clearRefreshTokenCookie(res);
    res.status(500).json({ error: "Unable to log out" });
  }
});
authRouter.get("/auth/me", async (req, res) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    recordFailedAuthAttempt(req.ip, req.originalUrl);
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const user = await resolveAuthenticatedUserFromToken(token);
    if (user && user.role !== ROLES.USER) {
      recordLogin(req, {
        userId: user.uid,
        metadata: { mode: "token", role: user.role }
      });
      res.json({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      });
      return;
    }
    res.status(403).json({ error: "User is not registered as an admin." });
  } catch (error2) {
    const abuse = recordFailedAuthAttempt(req.ip, req.originalUrl);
    if (abuse.thresholdExceeded) {
      Logger.warn("Excessive failed authentication attempts", {
        requestId: req.requestId,
        path: req.originalUrl,
        count: abuse.count
      });
    }
    res.status(401).json({ error: error2 instanceof Error ? error2.message : "Invalid token" });
  }
});
authRouter.post("/auth/dev-login", validate({ body: DevLoginBodySchema }), (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LOGIN !== "true") {
    res.status(403).json({ error: "Dev login disabled in production" });
    return;
  }
  const { email, role } = req.body;
  const resolvedRole = role || (email ? DEV_ROLE_MAP[email.toLowerCase()] : void 0) || "admin";
  recordLogin(req, {
    userId: `dev_${resolvedRole}`,
    metadata: { mode: "dev", role: resolvedRole }
  });
  res.json({
    uid: `dev_${resolvedRole}`,
    email: email || `${resolvedRole}@choosify.com.bd`,
    displayName: resolvedRole.replace(/_/g, " "),
    role: resolvedRole,
    mode: "dev"
  });
});

// server/payments/paymentsRouter.ts
import { Router as Router7 } from "express";
init_operationsStore();
init_operationsPersistence();

// server/payments/paymentService.ts
init_operationsStore();
init_operationsPersistence();

// server/payments/mockProvider.ts
var MockPaymentProvider = class {
  constructor() {
    this.id = "mock";
    /** val_id → expected validation outcome (harness can seed). */
    this.validations = /* @__PURE__ */ new Map();
  }
  isConfigured() {
    return (process.env.PAYMENT_GATEWAY_MOCK || "").trim().toLowerCase() === "true";
  }
  seedValidation(valId, outcome) {
    this.validations.set(valId, {
      valid: outcome.valid,
      amount: outcome.amount,
      status: outcome.status || (outcome.valid ? "VALID" : "INVALID_TRANSACTION"),
      tranId: outcome.tranId
    });
  }
  clear() {
    this.validations.clear();
  }
  async initiateSession(input) {
    if (!this.isConfigured()) {
      throw new Error("Mock payment gateway is not enabled (set PAYMENT_GATEWAY_MOCK=true)");
    }
    const redirectUrl = `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}mock=1&tran_id=${encodeURIComponent(input.tranId)}&orderId=${encodeURIComponent(input.order.orderId)}`;
    return { redirectUrl, tranId: input.tranId, sessionKey: `mock_session_${input.tranId}` };
  }
  async validateTransaction(valId) {
    if (!this.isConfigured()) {
      throw new Error("Mock payment gateway is not enabled");
    }
    const seeded = this.validations.get(valId);
    if (!seeded) {
      return {
        valid: false,
        amount: 0,
        status: "INVALID_TRANSACTION",
        tranId: "",
        valId
      };
    }
    return {
      valid: seeded.valid,
      amount: seeded.amount,
      currency: "BDT",
      status: seeded.status,
      tranId: seeded.tranId,
      valId
    };
  }
};
var mockPaymentProvider = new MockPaymentProvider();

// server/payments/sslcommerzProvider.ts
function readMode() {
  const raw = (process.env.SSLCOMMERZ_MODE || "sandbox").trim().toLowerCase();
  return raw === "live" ? "live" : "sandbox";
}
function baseUrl(mode) {
  return mode === "live" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
}
var SslcommerzProvider = class {
  constructor() {
    this.id = "sslcommerz";
  }
  storeId() {
    return (process.env.SSLCOMMERZ_STORE_ID || "").trim();
  }
  storePassword() {
    return (process.env.SSLCOMMERZ_STORE_PASSWORD || "").trim();
  }
  isConfigured() {
    return Boolean(this.storeId() && this.storePassword());
  }
  getMode() {
    return readMode();
  }
  async initiateSession(input) {
    if (!this.isConfigured()) {
      throw new Error("SSLCommerz is not configured");
    }
    const mode = this.getMode();
    const url = `${baseUrl(mode)}/gwprocess/v4/api.php`;
    const body = new URLSearchParams();
    body.set("store_id", this.storeId());
    body.set("store_passwd", this.storePassword());
    body.set("total_amount", input.amount.toFixed(2));
    body.set("currency", input.currency || "BDT");
    body.set("tran_id", input.tranId);
    body.set("success_url", input.successUrl);
    body.set("fail_url", input.failUrl);
    body.set("cancel_url", input.cancelUrl);
    body.set("ipn_url", input.ipnUrl);
    body.set("cus_name", input.customer.name || "Customer");
    body.set("cus_email", input.customer.email || "noreply@choosify.com.bd");
    body.set("cus_phone", input.customer.phone || "01700000000");
    body.set("cus_add1", input.customer.address || "N/A");
    body.set("cus_city", input.customer.city || "Dhaka");
    body.set("cus_country", "Bangladesh");
    body.set("shipping_method", "NO");
    body.set("product_name", `Order ${input.order.orderId}`);
    body.set("product_category", "general");
    body.set("product_profile", "general");
    body.set("value_a", input.order.orderId);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    const rawText = await response.text();
    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`SSLCommerz session response was not JSON: ${rawText.slice(0, 200)}`);
    }
    const status = String(data.status || "");
    const gatewayUrl = String(data.GatewayPageURL || data.gatewayPageURL || "");
    if (status !== "SUCCESS" || !gatewayUrl) {
      const reason = String(data.failedreason || data.message || status || "unknown");
      throw new Error(`SSLCommerz session failed: ${reason}`);
    }
    return {
      redirectUrl: gatewayUrl,
      tranId: input.tranId,
      sessionKey: typeof data.sessionkey === "string" ? data.sessionkey : void 0
    };
  }
  async validateTransaction(valId) {
    if (!this.isConfigured()) {
      throw new Error("SSLCommerz is not configured");
    }
    if (!valId.trim()) {
      return {
        valid: false,
        amount: 0,
        status: "MISSING_VAL_ID",
        tranId: "",
        valId: ""
      };
    }
    const mode = this.getMode();
    const qs = new URLSearchParams({
      val_id: valId.trim(),
      store_id: this.storeId(),
      store_passwd: this.storePassword(),
      v: "1",
      format: "json"
    });
    const url = `${baseUrl(mode)}/validator/api/validationserverAPI.php?${qs}`;
    const response = await fetch(url, { method: "GET" });
    const rawText = await response.text();
    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`SSLCommerz validation response was not JSON: ${rawText.slice(0, 200)}`);
    }
    const status = String(data.status || "").toUpperCase();
    const valid = status === "VALID" || status === "VALIDATED";
    return {
      valid,
      amount: Number(data.amount || data.store_amount || 0),
      currency: typeof data.currency === "string" ? data.currency : "BDT",
      status,
      tranId: String(data.tran_id || ""),
      valId: String(data.val_id || valId),
      raw: data
    };
  }
};
var sslcommerzProvider = new SslcommerzProvider();

// server/payments/paymentService.ts
var processedValIds = /* @__PURE__ */ new Set();
function isSslcommerzLiveConfigured() {
  return sslcommerzProvider.isConfigured();
}
function getLivePaymentProvider() {
  if (sslcommerzProvider.isConfigured()) return sslcommerzProvider;
  return null;
}
function resolveChargeAmount(order) {
  if (order.isPartialPayment && typeof order.depositAmount === "number" && order.depositAmount > 0) {
    return Number(order.depositAmount);
  }
  return Number(order.overallTotal) || 0;
}
function amountsMatch(expected, actual, tolerance = 0.01) {
  return Math.abs(Number(expected) - Number(actual)) <= tolerance;
}
function hasProcessedValId(valId) {
  if (!valId) return false;
  if (processedValIds.has(valId)) return true;
  const orders = operationsStore.listOrders();
  return orders.some(
    (o) => o.paymentValId === valId && (o.paymentStatus === "paid" || Boolean(o.paidAt))
  );
}
function markValIdProcessed(valId) {
  if (valId) processedValIds.add(valId);
}
function findOrderForPayment(params) {
  const tranId = params.tranId?.trim();
  const orderId = params.orderId?.trim();
  if (tranId) {
    const byTran = operationsStore.listOrders().find((o) => o.paymentTranId === tranId);
    if (byTran) return byTran;
  }
  if (orderId) {
    return operationsStore.getOrder(orderId);
  }
  return null;
}
function applySuccessfulPayment(params) {
  const { order, validation, source } = params;
  const valId = validation.valId;
  if (hasProcessedValId(valId) || order.paymentStatus === "paid") {
    Logger.info("Payment already processed \u2014 idempotent skip", {
      orderId: order.orderId,
      valId,
      source
    });
    return order;
  }
  const expected = resolveChargeAmount(order);
  if (!validation.valid) {
    Logger.warn("Payment validation not VALID \u2014 not crediting order", {
      orderId: order.orderId,
      status: validation.status,
      source
    });
    return null;
  }
  if (!amountsMatch(expected, validation.amount)) {
    Logger.error("Payment amount mismatch \u2014 not crediting order", {
      orderId: order.orderId,
      expected,
      actual: validation.amount,
      source
    });
    return null;
  }
  if (validation.tranId && order.paymentTranId && validation.tranId !== order.paymentTranId) {
    Logger.error("Payment tran_id mismatch \u2014 not crediting order", {
      orderId: order.orderId,
      expectedTranId: order.paymentTranId,
      actualTranId: validation.tranId,
      source
    });
    return null;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = operationsStore.updateOrder(order.orderId, {
    paymentStatus: "paid",
    paymentValId: valId,
    paidAmount: validation.amount,
    paymentValidatedAt: now,
    paidAt: now,
    invoiceGeneratedAt: order.invoiceGeneratedAt || now,
    // pending_payment → confirmed once independently validated
    status: order.status === "pending_payment" ? "confirmed" : order.status
  });
  if (updated) {
    markValIdProcessed(valId);
    scheduleOperationsPersist();
    Logger.info("Order credited after independent payment validation", {
      orderId: order.orderId,
      valId,
      amount: validation.amount,
      source
    });
  }
  return updated;
}
function applyFailedPayment(order, status) {
  if (order.paymentStatus === "paid") return;
  operationsStore.updateOrder(order.orderId, { paymentStatus: status });
  scheduleOperationsPersist();
}

// server/payments/paymentsRouter.ts
var paymentsRouter = Router7();
var requireAuth3 = [authenticateRequest];
function publicApiBase(req) {
  const envBase = (process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || "").replace(
    /\/$/,
    ""
  );
  if (envBase) return envBase;
  const host = req.get("host") || "localhost:3001";
  return `${req.protocol}://${host}/api/v1`;
}
function webBase() {
  return (process.env.CHOOSIFY_WEB_URL || "http://localhost:5173").replace(/\/$/, "");
}
function userOwnsOrder(req, order) {
  return Boolean(req.userId && order.buyerId === req.userId);
}
paymentsRouter.get("/operations/payments/sslcommerz/status", (_req, res) => {
  const configured = isSslcommerzLiveConfigured();
  res.json({
    data: {
      configured,
      provider: "sslcommerz",
      mode: configured ? sslcommerzProvider.getMode() : null
    }
  });
});
paymentsRouter.post("/operations/payments/sslcommerz/init", ...requireAuth3, async (req, res) => {
  try {
    const provider = getLivePaymentProvider();
    if (!provider) {
      res.status(503).json({
        error: "payment_gateway_unavailable",
        message: "Payment gateway not available. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD."
      });
      return;
    }
    const orderId = String(req.body?.orderId || "").trim();
    if (!orderId) {
      res.status(400).json({ error: "orderId is required" });
      return;
    }
    const order = operationsStore.getOrder(orderId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!userOwnsOrder(req, order)) {
      res.status(403).json({ error: "Not authorized to pay for this order" });
      return;
    }
    if (order.paymentStatus === "paid" || order.paidAt) {
      res.status(409).json({
        error: "already_paid",
        message: "This order is already paid",
        data: { orderId: order.orderId, paymentStatus: order.paymentStatus }
      });
      return;
    }
    const amount = resolveChargeAmount(order);
    if (!(amount > 0)) {
      res.status(400).json({ error: "Order has no payable amount" });
      return;
    }
    const apiBase = publicApiBase(req);
    const site = webBase();
    const tranId = `TXN-${order.orderId}-${Date.now()}`;
    const session = await provider.initiateSession({
      order,
      amount,
      currency: "BDT",
      tranId,
      successUrl: `${apiBase}/operations/payments/sslcommerz/success`,
      failUrl: `${apiBase}/operations/payments/sslcommerz/fail`,
      cancelUrl: `${apiBase}/operations/payments/sslcommerz/cancel`,
      ipnUrl: `${apiBase}/operations/payments/sslcommerz/ipn`,
      customer: {
        name: order.shipping?.fullName || "Customer",
        phone: order.shipping?.phone,
        address: order.shipping?.address,
        city: order.shipping?.region || "Dhaka",
        email: typeof req.body?.customerEmail === "string" ? req.body.customerEmail : void 0
      }
    });
    operationsStore.updateOrder(order.orderId, {
      paymentProvider: "sslcommerz",
      paymentMethod: "online",
      paymentStatus: "pending",
      paymentTranId: session.tranId,
      status: "pending_payment"
    });
    scheduleOperationsPersist();
    Logger.info("SSLCommerz session initiated", {
      orderId: order.orderId,
      tranId: session.tranId,
      amount
    });
    res.json({
      success: true,
      data: {
        redirectUrl: session.redirectUrl,
        tranId: session.tranId,
        orderId: order.orderId,
        amount
      }
    });
  } catch (error2) {
    Logger.error("SSLCommerz init failed", {
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    res.status(500).json({
      error: error2 instanceof Error ? error2.message : "Failed to initiate payment"
    });
  }
});
paymentsRouter.post("/operations/payments/sslcommerz/ipn", async (req, res) => {
  const body = req.body || {};
  Logger.info("SSLCommerz IPN received", {
    keys: Object.keys(body),
    status: body.status,
    tran_id: body.tran_id,
    val_id: body.val_id,
    amount: body.amount,
    value_a: body.value_a
  });
  try {
    const provider = getLivePaymentProvider();
    if (!provider) {
      Logger.warn("SSLCommerz IPN ignored \u2014 gateway not configured");
      res.status(503).json({ error: "payment_gateway_unavailable" });
      return;
    }
    const valId = String(body.val_id || "").trim();
    const tranId = String(body.tran_id || "").trim();
    const orderIdHint = String(body.value_a || body.orderId || "").trim();
    const ipnStatus = String(body.status || "").toUpperCase();
    const order = findOrderForPayment({ tranId, orderId: orderIdHint });
    if (!order) {
      Logger.warn("SSLCommerz IPN \u2014 order not found", { tranId, orderIdHint });
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!valId) {
      if (ipnStatus === "FAILED" || ipnStatus === "CANCELLED" || ipnStatus === "UNATTEMPTED") {
        applyFailedPayment(order, ipnStatus === "CANCELLED" ? "cancelled" : "failed");
        Logger.info("SSLCommerz IPN recorded non-success without val_id", {
          orderId: order.orderId,
          ipnStatus
        });
      }
      res.status(200).json({ received: true, credited: false, reason: "no_val_id" });
      return;
    }
    const validation = await provider.validateTransaction(valId);
    Logger.info("SSLCommerz Order Validation API result", {
      orderId: order.orderId,
      valId,
      valid: validation.valid,
      status: validation.status,
      amount: validation.amount,
      tranId: validation.tranId
    });
    if (!validation.valid) {
      applyFailedPayment(order, "failed");
      res.status(200).json({ received: true, credited: false, reason: "validation_not_valid" });
      return;
    }
    const updated = applySuccessfulPayment({
      order,
      validation,
      source: "ipn"
    });
    res.status(200).json({
      received: true,
      credited: Boolean(updated && updated.paymentStatus === "paid"),
      orderId: order.orderId,
      paymentStatus: updated?.paymentStatus || order.paymentStatus
    });
  } catch (error2) {
    Logger.error("SSLCommerz IPN handler error", {
      error: error2 instanceof Error ? error2.message : String(error2)
    });
    res.status(200).json({
      received: true,
      credited: false,
      error: error2 instanceof Error ? error2.message : "ipn_error"
    });
  }
});
function redirectToWeb(res, path, query2) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query2)) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  res.redirect(302, `${webBase()}${path}${suffix}`);
}
paymentsRouter.get("/operations/payments/sslcommerz/success", (req, res) => {
  const tranId = typeof req.query.tran_id === "string" ? req.query.tran_id : void 0;
  const order = findOrderForPayment({
    tranId,
    orderId: typeof req.query.value_a === "string" ? req.query.value_a : void 0
  }) || (typeof req.query.orderId === "string" ? operationsStore.getOrder(req.query.orderId) : null);
  Logger.info("SSLCommerz browser success redirect (untrusted)", {
    tranId,
    orderId: order?.orderId,
    paymentStatus: order?.paymentStatus
  });
  redirectToWeb(res, "/payment/return", {
    outcome: "success",
    orderId: order?.orderId,
    tran_id: tranId
  });
});
paymentsRouter.get("/operations/payments/sslcommerz/fail", (req, res) => {
  const tranId = typeof req.query.tran_id === "string" ? req.query.tran_id : void 0;
  const order = findOrderForPayment({
    tranId,
    orderId: typeof req.query.value_a === "string" ? req.query.value_a : void 0
  });
  if (order) applyFailedPayment(order, "failed");
  Logger.info("SSLCommerz browser fail redirect (untrusted)", {
    tranId,
    orderId: order?.orderId
  });
  redirectToWeb(res, "/payment/return", {
    outcome: "fail",
    orderId: order?.orderId,
    tran_id: tranId
  });
});
paymentsRouter.get("/operations/payments/sslcommerz/cancel", (req, res) => {
  const tranId = typeof req.query.tran_id === "string" ? req.query.tran_id : void 0;
  const order = findOrderForPayment({
    tranId,
    orderId: typeof req.query.value_a === "string" ? req.query.value_a : void 0
  });
  if (order) applyFailedPayment(order, "cancelled");
  Logger.info("SSLCommerz browser cancel redirect (untrusted)", {
    tranId,
    orderId: order?.orderId
  });
  redirectToWeb(res, "/payment/return", {
    outcome: "cancel",
    orderId: order?.orderId,
    tran_id: tranId
  });
});

// server/lib/helmetConfig.ts
import helmet from "helmet";
function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
    xContentTypeOptions: true,
    xFrameOptions: { action: "sameorigin" },
    hidePoweredBy: true
  });
}

// server/middleware/requestId.ts
import { randomUUID as randomUUID5 } from "crypto";
var REQUEST_ID_HEADER = "x-request-id";
function requestIdMiddleware(req, res, next) {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID5();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

// server/lib/metrics.ts
var state4 = {
  totalRequests: 0,
  errors: 0,
  clientErrors4xx: 0,
  serverErrors5xx: 0,
  totalResponseTimeMs: 0,
  healthChecks: 0,
  authenticatedRequests: 0,
  rejectedRequests: 0
};
var REJECTED_STATUS_CODES = /* @__PURE__ */ new Set([401, 403, 429]);
function recordRequestMetrics(input) {
  state4.totalRequests += 1;
  state4.totalResponseTimeMs += input.durationMs;
  if (input.authenticated) {
    state4.authenticatedRequests += 1;
  }
  if (input.statusCode >= 400 && input.statusCode < 500) {
    state4.clientErrors4xx += 1;
    if (REJECTED_STATUS_CODES.has(input.statusCode)) {
      state4.rejectedRequests += 1;
    }
  }
  if (input.statusCode >= 500) {
    state4.serverErrors5xx += 1;
    state4.errors += 1;
  }
}
function recordHealthCheck() {
  state4.healthChecks += 1;
}
function getMetricsSnapshot() {
  return {
    totalRequests: state4.totalRequests,
    errors: state4.errors,
    clientErrors4xx: state4.clientErrors4xx,
    serverErrors5xx: state4.serverErrors5xx,
    averageResponseTimeMs: state4.totalRequests > 0 ? Math.round(state4.totalResponseTimeMs / state4.totalRequests) : 0,
    healthChecks: state4.healthChecks,
    authenticatedRequests: state4.authenticatedRequests,
    rejectedRequests: state4.rejectedRequests
  };
}

// server/middleware/requestTiming.ts
function getClientIp(req) {
  return req.ip;
}
function getUserAgent(req) {
  return req.get("user-agent") || void 0;
}
function requestTimingMiddleware(req, res, next) {
  const startedAt3 = Date.now();
  res.locals.requestStartedAt = startedAt3;
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt3;
    res.locals.requestDurationMs = durationMs;
    recordRequestMetrics({
      statusCode: res.statusCode,
      durationMs,
      authenticated: Boolean(req.userId || req.user?.uid)
    });
    Logger.info("HTTP request completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      environment: getEnvironment()
    });
  });
  next();
}

// server/middleware/cors.ts
import cors from "cors";
function parseAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (configured.length > 0) {
    return configured;
  }
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    // Choosify-Web (customer storefront) dev server — order-claim confirm page calls this API.
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ];
}
function getAllowedOrigins() {
  return parseAllowedOrigins();
}
function createCorsMiddleware() {
  const allowedOrigins = getAllowedOrigins();
  const options = {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
    credentials: true
  };
  return cors(options);
}

// server/middleware/errorHandler.ts
function errorHandler(err, req, res, next) {
  if (err.type === "entity.too.large") {
    payloadTooLarge(err, req, res, next);
    return;
  }
  const status = err.status || err.statusCode || 500;
  const isProduction2 = process.env.NODE_ENV === "production";
  Logger.error("Request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
    ...isProduction2 ? {} : { stack: err.stack }
  });
  if (res.headersSent) {
    return;
  }
  res.status(status).json({
    success: false,
    error: status >= 500 && isProduction2 ? "Internal Server Error" : err.message || "Internal Server Error",
    requestId: req.requestId,
    ...err.details !== void 0 ? { details: err.details } : {},
    ...!isProduction2 && err.stack ? { stack: err.stack } : {}
  });
}
function payloadTooLarge(err, req, res, _next) {
  Logger.warn("Payload too large", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err.message
  });
  if (res.headersSent) {
    return;
  }
  res.status(413).json({
    success: false,
    error: "Request payload too large",
    code: "PAYLOAD_TOO_LARGE",
    requestId: req.requestId
  });
}

// server/middleware/payloadLimits.ts
var JSON_BODY_LIMIT = readBytesEnv("JSON_BODY_LIMIT", "8mb");
var URLENCODED_BODY_LIMIT = readBytesEnv("URLENCODED_BODY_LIMIT", "1mb");
var RAW_BODY_LIMIT = readBytesEnv("RAW_BODY_LIMIT", "256kb");
function payloadTooLargeHandler(err, req, res, next) {
  if (err.type !== "entity.too.large") {
    next(err);
    return;
  }
  Logger.warn("Payload too large", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err.message
  });
  if (res.headersSent) {
    return;
  }
  res.status(413).json({
    success: false,
    error: "Request payload too large",
    code: "PAYLOAD_TOO_LARGE",
    requestId: req.requestId
  });
}

// server/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
var WINDOW_MS = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1e3);
var POLICY_ENV_KEYS = {
  health: "RATE_LIMIT_HEALTH_MAX",
  auth: "RATE_LIMIT_AUTH_MAX",
  public: "RATE_LIMIT_PUBLIC_MAX",
  catalogRead: "RATE_LIMIT_CATALOG_READ_MAX",
  search: "RATE_LIMIT_SEARCH_MAX",
  messaging: "RATE_LIMIT_MESSAGING_MAX",
  admin: "RATE_LIMIT_ADMIN_MAX",
  ai: "RATE_LIMIT_AI_MAX"
};
var POLICY_DEFAULTS = {
  health: 120,
  auth: 20,
  public: 300,
  catalogRead: 600,
  search: 120,
  messaging: 100,
  admin: 200,
  ai: 60
};
function createPolicyLimiter(policy) {
  const max = readPositiveIntEnv(POLICY_ENV_KEYS[policy], POLICY_DEFAULTS[policy]);
  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Too many requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED"
    },
    handler: (req, res, _next, options) => {
      const ip = req.ip;
      const abuse = recordSuspiciousRequest(ip, req.originalUrl);
      Logger.warn("Rate limit exceeded", {
        requestId: req.requestId,
        policy,
        ip,
        path: req.originalUrl,
        method: req.method,
        abuseCount: abuse.count
      });
      res.status(options.statusCode).json(options.message);
    }
  });
}
var healthRateLimit = createPolicyLimiter("health");
var authRateLimit = createPolicyLimiter("auth");
var publicApiRateLimit = createPolicyLimiter("public");
var catalogReadRateLimit = createPolicyLimiter("catalogRead");
var searchRateLimit = createPolicyLimiter("search");
var messagingRateLimit = createPolicyLimiter("messaging");
var adminRateLimit = createPolicyLimiter("admin");
var aiRateLimit = createPolicyLimiter("ai");
function getRateLimitSummary() {
  const policies = Object.entries(POLICY_ENV_KEYS).map(([policy, envKey]) => ({
    policy,
    envKey,
    max: readPositiveIntEnv(envKey, POLICY_DEFAULTS[policy]),
    windowMs: WINDOW_MS
  }));
  return {
    windowMs: WINDOW_MS,
    policies,
    abuseProtection: getAbuseProtectionSnapshot()
  };
}
function catalogReadRateLimitMiddleware(req, res, next) {
  if (req.method === "GET") {
    return catalogReadRateLimit(req, res, next);
  }
  return next();
}
function searchRateLimitMiddleware(req, res, next) {
  const query2 = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (req.method === "GET" && query2.length > 0) {
    return searchRateLimit(req, res, next);
  }
  return next();
}

// server/analytics/analyticsRouter.ts
import { Router as Router8 } from "express";
var analyticsRouter = Router8();
analyticsRouter.post("/analytics/events", async (req, res) => {
  try {
    const body = req.body;
    if (!isAnalyticsEventType(body.type)) {
      res.status(400).json({ error: "Unsupported analytics event type" });
      return;
    }
    const event = await recordEvent({
      ...body,
      type: body.type,
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get("user-agent") || void 0,
      userId: body.userId || req.userId || req.user?.uid
    });
    res.status(202).json({ success: true, eventId: event.id });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Invalid analytics event" });
  }
});
analyticsRouter.post("/analytics/events/batch", async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (events.length === 0) {
      res.status(400).json({ error: "events array is required" });
      return;
    }
    const normalized = events.map((event) => {
      if (!isAnalyticsEventType(event.type)) {
        throw new Error(`Unsupported analytics event type: ${String(event.type)}`);
      }
      return {
        ...event,
        type: event.type,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get("user-agent") || void 0,
        userId: event.userId || req.userId || req.user?.uid
      };
    });
    const saved = await batchRecord(normalized);
    res.status(202).json({ success: true, count: saved.length });
  } catch (error2) {
    res.status(400).json({ error: error2 instanceof Error ? error2.message : "Invalid analytics batch" });
  }
});
analyticsRouter.post("/analytics/hooks/wishlist", (req, res) => {
  recordWishlist(req, req.body || {});
  res.status(202).json({ success: true });
});
analyticsRouter.post("/analytics/hooks/compare", (req, res) => {
  recordCompare(req, req.body || {});
  res.status(202).json({ success: true });
});
analyticsRouter.get("/analytics/summary", async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : void 0;
  const from = typeof req.query.from === "string" ? req.query.from : void 0;
  const to = typeof req.query.to === "string" ? req.query.to : void 0;
  res.json({ data: await summarize(range, from, to) });
});
analyticsRouter.get("/analytics/trending", async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : void 0;
  const from = typeof req.query.from === "string" ? req.query.from : void 0;
  const to = typeof req.query.to === "string" ? req.query.to : void 0;
  res.json({ data: await getTrending(range, from, to) });
});
analyticsRouter.get("/analytics/events/types", (_req, res) => {
  res.json({ data: ANALYTICS_EVENTS });
});
analyticsRouter.get("/analytics/storage", (_req, res) => {
  res.json({ data: getAnalyticsStorageStatus() });
});
analyticsRouter.get("/admin/analytics", async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "30d";
  res.json({
    data: {
      summary: await summarize(range),
      trending: await getTrending(range),
      storage: getAnalyticsStorageStatus()
    }
  });
});

// server/moderation/moderationRouter.ts
import { Router as Router9 } from "express";

// server/moderation/moderationStore.ts
import { randomUUID as randomUUID6 } from "crypto";

// server/moderation/moderationTypes.ts
var MODERATION_QUEUES = {
  PRODUCTS: "products",
  BRANDS: "brands",
  SELLERS: "sellers",
  REVIEWS: "reviews",
  REPORTS: "reports",
  MEDIA: "media"
};
var MODERATION_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_REVIEW: "needs_review",
  ASSIGNED: "assigned",
  ARCHIVED: "archived"
};
var VERIFICATION_STATUSES = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  EXPIRED: "expired"
};

// server/moderation/moderationStore.ts
var state5 = {
  items: [],
  reports: [],
  verifications: [],
  fraudSignals: []
};
function nowIso14() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function matchesStatusFilter(item, status) {
  if (!status) return true;
  return item.status === status;
}
var moderationStore = {
  listItems(filter = {}) {
    let rows = [...state5.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter.queue) {
      rows = rows.filter((item) => item.queue === filter.queue);
    }
    if (filter.status) {
      rows = rows.filter((item) => matchesStatusFilter(item, filter.status));
    }
    if (filter.assignedModeratorId) {
      rows = rows.filter((item) => item.assignedModeratorId === filter.assignedModeratorId);
    }
    if (filter.resourceType) {
      rows = rows.filter((item) => item.resourceType === filter.resourceType);
    }
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  },
  getItem(id) {
    return state5.items.find((item) => item.id === id) ?? null;
  },
  findItemByResource(queue, resourceId) {
    return state5.items.find((item) => item.queue === queue && item.resourceId === resourceId) ?? null;
  },
  createItem(input) {
    const item = {
      ...input,
      id: `mod-${randomUUID6()}`,
      status: input.status ?? MODERATION_STATUSES.PENDING,
      createdAt: nowIso14(),
      updatedAt: nowIso14()
    };
    state5.items.unshift(item);
    return item;
  },
  updateItem(id, patch) {
    const idx = state5.items.findIndex((item) => item.id === id);
    if (idx < 0) return null;
    state5.items[idx] = { ...state5.items[idx], ...patch, updatedAt: nowIso14() };
    return state5.items[idx];
  },
  listReports(filter) {
    let rows = [...state5.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    if (filter?.category) rows = rows.filter((r) => r.category === filter.category);
    if (filter?.resourceId) rows = rows.filter((r) => r.resourceId === filter.resourceId);
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  },
  getReport(id) {
    return state5.reports.find((report) => report.id === id) ?? null;
  },
  createReport(input) {
    const report = {
      ...input,
      id: `rpt-${randomUUID6()}`,
      status: input.status ?? "open",
      createdAt: nowIso14(),
      updatedAt: nowIso14()
    };
    state5.reports.unshift(report);
    return report;
  },
  updateReport(id, patch) {
    const idx = state5.reports.findIndex((report) => report.id === id);
    if (idx < 0) return null;
    state5.reports[idx] = { ...state5.reports[idx], ...patch, updatedAt: nowIso14() };
    return state5.reports[idx];
  },
  getVerification(sellerId) {
    return state5.verifications.find((v) => v.sellerId === sellerId) ?? null;
  },
  listVerifications() {
    return [...state5.verifications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  upsertVerification(sellerId, patch, historyEntry) {
    const existing = state5.verifications.find((v) => v.sellerId === sellerId);
    const entry = {
      id: `vh-${randomUUID6()}`,
      sellerId,
      status: patch.status ?? existing?.status ?? "pending",
      changedBy: historyEntry?.changedBy,
      reason: historyEntry?.reason,
      notes: historyEntry?.notes,
      timestamp: nowIso14()
    };
    if (existing) {
      existing.status = patch.status ?? existing.status;
      existing.sellerName = patch.sellerName ?? existing.sellerName;
      existing.documentsSubmitted = patch.documentsSubmitted ?? existing.documentsSubmitted;
      existing.verifiedAt = patch.verifiedAt ?? existing.verifiedAt;
      existing.expiresAt = patch.expiresAt ?? existing.expiresAt;
      existing.rejectedReason = patch.rejectedReason ?? existing.rejectedReason;
      existing.metadata = patch.metadata ?? existing.metadata;
      existing.updatedAt = nowIso14();
      existing.history.unshift(entry);
      return existing;
    }
    const created2 = {
      id: `sv-${randomUUID6()}`,
      sellerId,
      sellerName: patch.sellerName,
      status: patch.status ?? "pending",
      documentsSubmitted: patch.documentsSubmitted ?? 0,
      verifiedAt: patch.verifiedAt,
      expiresAt: patch.expiresAt,
      rejectedReason: patch.rejectedReason,
      metadata: patch.metadata,
      history: [entry],
      createdAt: nowIso14(),
      updatedAt: nowIso14()
    };
    state5.verifications.unshift(created2);
    return created2;
  },
  addFraudSignal(input) {
    const signal = {
      ...input,
      id: `frd-${randomUUID6()}`,
      detectedAt: nowIso14(),
      reviewed: false
    };
    state5.fraudSignals.unshift(signal);
    return signal;
  },
  listFraudSignals(filter) {
    let rows = [...state5.fraudSignals];
    if (filter?.reviewed !== void 0) {
      rows = rows.filter((s) => s.reviewed === filter.reviewed);
    }
    return rows;
  },
  countItemsByQueueAndStatus() {
    const counts = {};
    for (const item of state5.items) {
      if (!counts[item.queue]) {
        counts[item.queue] = {
          pending: 0,
          approved: 0,
          rejected: 0,
          needs_review: 0,
          assigned: 0,
          archived: 0
        };
      }
      counts[item.queue][item.status] += 1;
    }
    return counts;
  },
  countReportsByStatus() {
    return state5.reports.reduce(
      (acc, report) => {
        acc[report.status] += 1;
        return acc;
      },
      { open: 0, investigating: 0, resolved: 0, dismissed: 0 }
    );
  },
  countVerificationsByStatus() {
    return state5.verifications.reduce(
      (acc, verification) => {
        acc[verification.status] += 1;
        return acc;
      },
      { pending: 0, verified: 0, rejected: 0, suspended: 0, expired: 0 }
    );
  }
};

// server/moderation/moderationQueue.ts
var QUEUE_VALUES = Object.values(MODERATION_QUEUES);
function isModerationQueueType(value) {
  return typeof value === "string" && QUEUE_VALUES.includes(value);
}
function isModerationStatus(value) {
  return typeof value === "string" && Object.values(MODERATION_STATUSES).includes(value);
}
function getQueueSummary() {
  const counts = moderationStore.countItemsByQueueAndStatus();
  const summary = {};
  for (const queue of QUEUE_VALUES) {
    const bucket = counts[queue] ?? {
      pending: 0,
      approved: 0,
      rejected: 0,
      needs_review: 0,
      assigned: 0,
      archived: 0
    };
    summary[queue] = {
      pending: bucket.pending,
      approved: bucket.approved,
      rejected: bucket.rejected,
      needsReview: bucket.needs_review,
      assigned: bucket.assigned,
      total: Object.values(bucket).reduce((sum, n) => sum + n, 0)
    };
  }
  return summary;
}

// server/moderation/reputationEngine.ts
init_operationsStore();
function gradeFromScore(score, maxScore) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.9) return "A";
  if (ratio >= 0.75) return "B";
  if (ratio >= 0.6) return "C";
  if (ratio >= 0.45) return "D";
  return "F";
}
function normalizeSeller(value) {
  return (value || "").trim().toLowerCase();
}
function sellerReviews(sellerId, sellerName) {
  const id = normalizeSeller(sellerId);
  const name = normalizeSeller(sellerName);
  return operationsStore.listReviews().filter((review) => {
    const store = normalizeSeller(review.storeName);
    const brand = normalizeSeller(review.brandName);
    return store.includes(id) || brand.includes(id) || name && (store.includes(name) || brand.includes(name));
  });
}
function sellerReports(sellerId) {
  return moderationStore.listReports().filter(
    (report) => report.resourceType === "seller" && report.resourceId === sellerId
  );
}
function sellerModerationItems(sellerId) {
  return moderationStore.listItems({ resourceType: "seller", limit: 500 }).filter(
    (item) => item.resourceId === sellerId
  );
}
function averageReviewRating(reviews) {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round(total / reviews.length * 10) / 10;
}
function approvalRate(items) {
  const decided = items.filter((item) => item.status === "approved" || item.status === "rejected");
  if (decided.length === 0) return null;
  const approved = decided.filter((item) => item.status === "approved").length;
  return Math.round(approved / decided.length * 1e3) / 10;
}
function buildComponent(key, label, value, weight, source, notes2) {
  const weightedScore = Math.round(value * weight * 10) / 10;
  return { key, label, value, weight, weightedScore, source, notes: notes2 };
}
function calculateSellerReputation(sellerId, sellerName, accountCreatedAt) {
  const reviews = sellerReviews(sellerId, sellerName);
  const reports = sellerReports(sellerId);
  const moderationItems = sellerModerationItems(sellerId);
  const verification = moderationStore.getVerification(sellerId);
  const reviewRating = averageReviewRating(reviews);
  const complaintCount = reports.filter((r) => r.status !== "dismissed").length;
  const approvalRateValue = approvalRate(moderationItems);
  const verificationStatus = verification?.status ?? VERIFICATION_STATUSES.PENDING;
  const responseTimeHours = null;
  const orderSuccessRate = null;
  let accountAgeDays = null;
  if (accountCreatedAt) {
    accountAgeDays = Math.floor(
      (Date.now() - new Date(accountCreatedAt).getTime()) / (1e3 * 60 * 60 * 24)
    );
  } else if (verification?.createdAt) {
    accountAgeDays = Math.floor(
      (Date.now() - new Date(verification.createdAt).getTime()) / (1e3 * 60 * 60 * 24)
    );
  }
  const components = [];
  if (reviewRating !== null) {
    const normalized = reviewRating / 5 * 100;
    components.push(buildComponent("review_rating", "Review Rating", normalized, 0.25, "computed"));
  } else {
    components.push(
      buildComponent("review_rating", "Review Rating", 0, 0.25, "placeholder", "No reviews available")
    );
  }
  const complaintPenalty = Math.max(0, 100 - complaintCount * 10);
  components.push(
    buildComponent(
      "complaint_count",
      "Complaint Score",
      complaintPenalty,
      0.2,
      "computed",
      `${complaintCount} active complaints`
    )
  );
  if (approvalRateValue !== null) {
    components.push(
      buildComponent("approval_rate", "Approval Rate", approvalRateValue, 0.15, "computed")
    );
  } else {
    components.push(
      buildComponent(
        "approval_rate",
        "Approval Rate",
        50,
        0.15,
        "placeholder",
        "No moderation decisions yet"
      )
    );
  }
  components.push(
    buildComponent(
      "response_time",
      "Response Time",
      responseTimeHours !== null ? Math.max(0, 100 - responseTimeHours) : 50,
      0.1,
      responseTimeHours !== null ? "computed" : "placeholder",
      responseTimeHours === null ? "Awaiting messaging SLA telemetry" : void 0
    )
  );
  components.push(
    buildComponent(
      "order_success",
      "Order Success",
      orderSuccessRate ?? 50,
      0.15,
      orderSuccessRate !== null ? "computed" : "placeholder",
      orderSuccessRate === null ? "Awaiting order fulfillment telemetry" : void 0
    )
  );
  if (accountAgeDays !== null) {
    const ageScore = Math.min(100, accountAgeDays / 365 * 100);
    components.push(buildComponent("account_age", "Account Age", ageScore, 0.1, "computed"));
  } else {
    components.push(
      buildComponent(
        "account_age",
        "Account Age",
        0,
        0.1,
        "placeholder",
        "Account creation date unavailable"
      )
    );
  }
  const verificationScore = verificationStatus === VERIFICATION_STATUSES.VERIFIED ? 100 : verificationStatus === VERIFICATION_STATUSES.PENDING ? 40 : verificationStatus === VERIFICATION_STATUSES.SUSPENDED ? 10 : verificationStatus === VERIFICATION_STATUSES.EXPIRED ? 20 : 0;
  components.push(
    buildComponent("verification_status", "Verification Status", verificationScore, 0.05, "computed")
  );
  const maxScore = 100;
  const score = Math.round(
    Math.min(
      maxScore,
      components.reduce((sum, component) => sum + component.weightedScore, 0)
    )
  );
  return {
    sellerId,
    sellerName,
    score,
    maxScore,
    grade: gradeFromScore(score, maxScore),
    reviewRating,
    complaintCount,
    approvalRate: approvalRateValue,
    responseTimeHours,
    orderSuccessRate,
    accountAgeDays,
    verificationStatus,
    components,
    calculatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function calculateTrustScore(entityType, entityId, entityLabel) {
  if (entityType === "seller") {
    const reputation = calculateSellerReputation(entityId, entityLabel);
    return {
      entityType,
      entityId,
      entityLabel,
      score: reputation.score,
      maxScore: reputation.maxScore,
      grade: reputation.grade,
      components: reputation.components,
      calculatedAt: reputation.calculatedAt
    };
  }
  const reports = moderationStore.listReports({ resourceId: entityId }).filter((report) => report.resourceType === entityType);
  const items = moderationStore.listItems({ resourceType: entityType, limit: 200 }).filter((item) => item.resourceId === entityId);
  const complaintCount = reports.filter((r) => r.status !== "dismissed").length;
  const approvalRateValue = approvalRate(items);
  const components = [
    buildComponent(
      "complaint_count",
      "Complaint Score",
      Math.max(0, 100 - complaintCount * 15),
      0.4,
      "computed",
      `${complaintCount} reports`
    ),
    buildComponent(
      "approval_rate",
      "Approval Rate",
      approvalRateValue ?? 50,
      0.35,
      approvalRateValue !== null ? "computed" : "placeholder",
      approvalRateValue === null ? "No moderation history" : void 0
    ),
    buildComponent(
      "policy_compliance",
      "Policy Compliance",
      items.some((item) => item.status === "rejected") ? 30 : 80,
      0.25,
      "computed"
    )
  ];
  const maxScore = 100;
  const score = Math.round(
    Math.min(maxScore, components.reduce((sum, c) => sum + c.weightedScore, 0))
  );
  return {
    entityType,
    entityId,
    entityLabel,
    score,
    maxScore,
    grade: gradeFromScore(score, maxScore),
    components,
    calculatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/moderation/moderationService.ts
function getModerationSummary() {
  const reportCounts = moderationStore.countReportsByStatus();
  const verificationCounts = moderationStore.countVerificationsByStatus();
  const fraudSignals = moderationStore.listFraudSignals();
  return {
    queues: getQueueSummary(),
    reports: {
      open: reportCounts.open,
      investigating: reportCounts.investigating,
      resolved: reportCounts.resolved,
      dismissed: reportCounts.dismissed,
      total: Object.values(reportCounts).reduce((sum, n) => sum + n, 0)
    },
    verifications: {
      pending: verificationCounts.pending,
      verified: verificationCounts.verified,
      rejected: verificationCounts.rejected,
      suspended: verificationCounts.suspended,
      expired: verificationCounts.expired,
      total: Object.values(verificationCounts).reduce((sum, n) => sum + n, 0)
    },
    fraudSignals: {
      unreviewed: fraudSignals.filter((s) => !s.reviewed).length,
      total: fraudSignals.length
    },
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function listModerationQueue(filter = {}) {
  return moderationStore.listItems(filter);
}

// server/moderation/moderationRouter.ts
var moderationRouter = Router9();
var requireModerationAccess = [authenticateRequest, requireRole(ROLES.MODERATOR)];
moderationRouter.get("/admin/moderation/summary", ...requireModerationAccess, (_req, res) => {
  return success(res, getModerationSummary());
});
moderationRouter.get("/admin/moderation/queue", ...requireModerationAccess, (req, res) => {
  const filter = {};
  if (typeof req.query.queue === "string" && isModerationQueueType(req.query.queue)) {
    filter.queue = req.query.queue;
  }
  if (typeof req.query.status === "string" && isModerationStatus(req.query.status)) {
    filter.status = req.query.status;
  }
  if (typeof req.query.assignedModeratorId === "string") {
    filter.assignedModeratorId = req.query.assignedModeratorId;
  }
  if (typeof req.query.resourceType === "string") {
    filter.resourceType = req.query.resourceType;
  }
  if (typeof req.query.limit === "string") {
    const limit = Number(req.query.limit);
    if (!Number.isNaN(limit) && limit > 0) filter.limit = limit;
  }
  if (typeof req.query.offset === "string") {
    const offset = Number(req.query.offset);
    if (!Number.isNaN(offset) && offset >= 0) filter.offset = offset;
  }
  return success(res, {
    items: listModerationQueue(filter),
    filter
  });
});
moderationRouter.get("/admin/reputation", ...requireModerationAccess, (req, res) => {
  const sellerId = typeof req.query.sellerId === "string" ? req.query.sellerId : void 0;
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : "seller";
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : sellerId;
  const entityLabel = typeof req.query.entityLabel === "string" ? req.query.entityLabel : void 0;
  const accountCreatedAt = typeof req.query.accountCreatedAt === "string" ? req.query.accountCreatedAt : void 0;
  if (!entityId) {
    return res.status(400).json({
      success: false,
      error: "entityId or sellerId query parameter is required"
    });
  }
  if (entityType === "seller") {
    return success(res, calculateSellerReputation(entityId, entityLabel, accountCreatedAt));
  }
  return success(res, calculateTrustScore(entityType, entityId, entityLabel));
});

// server/search/searchRouter.ts
import { Router as Router10 } from "express";

// server/search/searchEngine.ts
init_operationsStore();

// server/search/rankingWeights.ts
var DEFAULT_WEIGHTS = {
  keyword: 40,
  popularity: 15,
  trust: 15,
  seller: 10,
  freshness: 5,
  reviews: 10,
  inventory: 5
};
var ENV_MAP = {
  keyword: "RANKING_WEIGHT_KEYWORD",
  popularity: "RANKING_WEIGHT_POPULARITY",
  trust: "RANKING_WEIGHT_TRUST",
  seller: "RANKING_WEIGHT_SELLER",
  freshness: "RANKING_WEIGHT_FRESHNESS",
  reviews: "RANKING_WEIGHT_REVIEWS",
  inventory: "RANKING_WEIGHT_INVENTORY"
};
function parseWeight(value, fallback) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function getRankingWeights() {
  return {
    keyword: parseWeight(process.env[ENV_MAP.keyword], DEFAULT_WEIGHTS.keyword),
    popularity: parseWeight(process.env[ENV_MAP.popularity], DEFAULT_WEIGHTS.popularity),
    trust: parseWeight(process.env[ENV_MAP.trust], DEFAULT_WEIGHTS.trust),
    seller: parseWeight(process.env[ENV_MAP.seller], DEFAULT_WEIGHTS.seller),
    freshness: parseWeight(process.env[ENV_MAP.freshness], DEFAULT_WEIGHTS.freshness),
    reviews: parseWeight(process.env[ENV_MAP.reviews], DEFAULT_WEIGHTS.reviews),
    inventory: parseWeight(process.env[ENV_MAP.inventory], DEFAULT_WEIGHTS.inventory)
  };
}
var RANKING_WEIGHT_DEFAULTS = { ...DEFAULT_WEIGHTS };

// server/search/rankingEngine.ts
function normalizeCount(value, cap) {
  if (cap <= 0) return 0;
  return Math.min(100, Math.round(value / cap * 100));
}
function computeKeywordRelevance(product, query2) {
  if (!query2 || !query2.trim()) return 50;
  const q = query2.trim().toLowerCase();
  const title = product.title.toLowerCase();
  const description = product.description.toLowerCase();
  const brand = product.brandName.toLowerCase();
  const category = product.categoryName.toLowerCase();
  const tags = (product.tags || []).join(" ").toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 95;
  if (brand === q || category === q) return 90;
  if (title.includes(q)) return 85;
  if (brand.includes(q) || category.includes(q)) return 70;
  if (tags.includes(q)) return 65;
  if (description.includes(q)) return 55;
  return 0;
}
function computeFreshnessScore(product) {
  if (product.isNewArrival) return 100;
  const updatedMs = Date.now() - new Date(product.updatedAt).getTime();
  const days = updatedMs / (1e3 * 60 * 60 * 24);
  if (days <= 7) return 90;
  if (days <= 30) return 75;
  if (days <= 90) return 55;
  if (days <= 180) return 35;
  return 20;
}
function buildProductSignals(product, brand, ctx) {
  const analytics = ctx.analyticsCounts;
  const reviews = ctx.reviewStats?.get(product.id);
  const viewCount = analytics?.views.get(product.id) ?? 0;
  const wishlistCount = analytics?.wishlists.get(product.id) ?? 0;
  const compareCount = analytics?.compares.get(product.id) ?? 0;
  const trustScore = ctx.trustScores?.get(product.id) ?? ctx.brandTrustScores?.get(product.brandId) ?? null;
  const sellerKey = product.brandId;
  const sellerReputation = ctx.sellerReputations?.get(sellerKey) ?? null;
  const sellerHealthScore = ctx.sellerHealthScores?.get(sellerKey) ?? null;
  const verified = brand?.verifiedStatus === true || brand?.claimStatus === "verified" || ctx.brandVerified?.get(product.brandId) === true;
  const sponsoredBoost = brand?.sponsoredFlag || ctx.sponsoredBrandIds?.has(product.brandId) ? 15 : 0;
  const adminBoost = product.featuredFlag ? 10 : product.isBestseller ? 5 : 0;
  return {
    productId: product.id,
    keywordRelevance: computeKeywordRelevance(product, ctx.query),
    viewCount,
    wishlistCount,
    compareCount,
    reviewScore: reviews && reviews.count > 0 ? reviews.average : null,
    reviewCount: reviews?.count ?? 0,
    trustScore,
    sellerReputation,
    sellerHealthScore,
    verified,
    freshnessScore: computeFreshnessScore(product),
    inStock: product.stock > 0,
    sponsoredBoost,
    adminBoost,
    isRejected: ctx.rejectedProductIds?.has(product.id) ?? false
  };
}
function rankProduct(product, brand, ctx) {
  const signals = buildProductSignals(product, brand, ctx);
  if (signals.isRejected) return null;
  if (product.status !== "live") return null;
  if (ctx.query && signals.keywordRelevance <= 0) return null;
  const weights = ctx.weights ?? getRankingWeights();
  const maxPopularity = Math.max(
    1,
    ...[signals.viewCount, signals.wishlistCount, signals.compareCount]
  );
  const popularityScore = Math.round(
    normalizeCount(signals.viewCount, maxPopularity) * 0.5 + normalizeCount(signals.wishlistCount, maxPopularity) * 0.3 + normalizeCount(signals.compareCount, maxPopularity) * 0.2
  );
  const trustComponent = signals.trustScore ?? (signals.verified ? 70 : 40);
  const sellerComponent = signals.sellerReputation ?? signals.sellerHealthScore ?? (signals.verified ? 60 : 35);
  const reviewComponent = signals.reviewScore !== null ? Math.min(100, Math.round(signals.reviewScore / 5 * 80 + Math.min(signals.reviewCount, 10) * 2)) : 40;
  const inventoryComponent = signals.inStock ? 100 : 0;
  const breakdown = {
    keyword: signals.keywordRelevance * weights.keyword / 100,
    popularity: popularityScore * weights.popularity / 100,
    trust: trustComponent * weights.trust / 100,
    seller: sellerComponent * weights.seller / 100,
    freshness: signals.freshnessScore * weights.freshness / 100,
    reviews: reviewComponent * weights.reviews / 100,
    inventory: inventoryComponent * weights.inventory / 100,
    sponsoredBoost: signals.sponsoredBoost,
    adminBoost: signals.adminBoost
  };
  const score = Math.round(
    Math.min(
      100,
      Object.values(breakdown).reduce((sum, value) => sum + value, 0)
    )
  );
  return {
    product,
    score,
    maxScore: 100,
    signals,
    breakdown
  };
}
function rankProducts(products, brands, ctx) {
  const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
  const ranked = [];
  for (const product of products) {
    const result = rankProduct(product, brandMap.get(product.brandId), ctx);
    if (result) ranked.push(result);
  }
  return ranked.sort((a, b) => b.score - a.score);
}

// server/search/discoveryEngine.ts
init_operationsStore();
function rejectedProductIds() {
  return new Set(
    moderationStore.listItems({ queue: "products", status: MODERATION_STATUSES.REJECTED, limit: 5e3 }).map((item) => item.resourceId)
  );
}
function liveProducts(products, rejected) {
  return products.filter((p) => p.status === "live" && !rejected.has(p.id));
}
function toProductItems(products, scoreKey) {
  return products.map((product) => ({
    id: product.id,
    label: product.title,
    type: "product",
    metadata: {
      brandName: product.brandName,
      categoryName: product.categoryName,
      price: product.price,
      image: product.image
    },
    ...scoreKey ? {} : {}
  }));
}
function analyticsToItems(rows, type, rejected) {
  return rows.filter((row) => !rejected || !rejected.has(row.id)).map((row) => ({
    id: row.id,
    label: row.label,
    type,
    count: row.count,
    metadata: row.metadata
  }));
}
async function getTrendingSnapshot(range = "7d") {
  const trending = await getTrending(range);
  return {
    range,
    trendingSearches: trending.trendingSearches.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count
    })),
    topProducts: trending.topProducts.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count
    })),
    topBrands: trending.topBrands.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count
    })),
    topCategories: trending.topCategories.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count
    })),
    generatedAt: trending.generatedAt
  };
}
async function getDiscoveryCollections(sections) {
  const allSections = sections?.length ? sections : [
    "trendingProducts",
    "trendingBrands",
    "trendingCategories",
    "featuredProducts",
    "editorsChoice",
    "newArrivals",
    "recentlyUpdated",
    "mostCompared",
    "mostWishlisted",
    "mostViewed",
    "topRated"
  ];
  const [products, brands, homepage, summary] = await Promise.all([
    catalogStore2.listProducts(),
    catalogStore2.listBrands(),
    catalogStore2.getHomepage().catch(() => null),
    summarize("30d")
  ]);
  const rejected = rejectedProductIds();
  const live = liveProducts(products, rejected);
  const collections = {};
  for (const section of allSections) {
    switch (section) {
      case "trendingProducts":
        collections.trendingProducts = analyticsToItems(summary.topProducts, "product", rejected);
        break;
      case "trendingBrands":
        collections.trendingBrands = analyticsToItems(summary.topBrands, "brand");
        break;
      case "trendingCategories":
        collections.trendingCategories = analyticsToItems(summary.topCategories, "category");
        break;
      case "featuredProducts":
        collections.featuredProducts = toProductItems(
          live.filter((p) => p.featuredFlag || homepage?.featuredProductIds.includes(p.id))
        );
        break;
      case "editorsChoice":
        collections.editorsChoice = toProductItems(
          live.filter((p) => homepage?.featuredProductIds.includes(p.id) || p.featuredFlag)
        );
        break;
      case "newArrivals":
        collections.newArrivals = toProductItems(live.filter((p) => p.isNewArrival));
        break;
      case "recentlyUpdated":
        collections.recentlyUpdated = toProductItems(
          [...live].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20)
        );
        break;
      case "mostCompared":
        collections.mostCompared = analyticsToItems(summary.mostCompared, "product", rejected);
        break;
      case "mostWishlisted":
        collections.mostWishlisted = analyticsToItems(summary.mostWishlisted, "product", rejected);
        break;
      case "mostViewed":
        collections.mostViewed = analyticsToItems(summary.mostViewed, "product", rejected);
        break;
      case "topRated": {
        const ratings = /* @__PURE__ */ new Map();
        for (const review of operationsStore.listReviews()) {
          if (review.status !== "approved" && review.status !== "published") continue;
          if (rejected.has(review.productId)) continue;
          const row = ratings.get(review.productId) || {
            total: 0,
            count: 0,
            title: review.productTitle
          };
          row.total += review.rating;
          row.count += 1;
          ratings.set(review.productId, row);
        }
        collections.topRated = [...ratings.entries()].map(([id, data]) => ({
          id,
          label: data.title,
          type: "product",
          score: Number((data.total / data.count).toFixed(1)),
          count: data.count
        })).filter((item) => item.count > 0).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 20);
        break;
      }
      default:
        break;
    }
  }
  if (allSections.includes("trendingBrands") && (!collections.trendingBrands || collections.trendingBrands.length === 0)) {
    collections.trendingBrands = brands.filter((b) => b.featuredFlag || b.sponsoredFlag).slice(0, 10).map((b) => ({ id: b.id, label: b.name, type: "brand" }));
  }
  return {
    collections,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/search/searchEngine.ts
function parseLimit2(value, fallback = 20, max = 100) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}
function parseOffset2(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}
async function buildRankingContext(query2) {
  const summary = await summarize("30d");
  const views = new Map(summary.mostViewed.map((item) => [item.id, item.count]));
  const wishlists = new Map(summary.mostWishlisted.map((item) => [item.id, item.count]));
  const compares = new Map(summary.mostCompared.map((item) => [item.id, item.count]));
  const reviewStats = /* @__PURE__ */ new Map();
  for (const review of operationsStore.listReviews()) {
    if (review.status !== "approved" && review.status !== "published") continue;
    const existing = reviewStats.get(review.productId) || { average: 0, count: 0, total: 0 };
    const total = existing.average * existing.count + review.rating;
    const count = existing.count + 1;
    reviewStats.set(review.productId, { average: total / count, count });
  }
  const rejectedItems = moderationStore.listItems({
    queue: "products",
    status: MODERATION_STATUSES.REJECTED,
    limit: 5e3
  });
  const rejectedProductIds2 = new Set(rejectedItems.map((item) => item.resourceId));
  const brands = await catalogStore2.listBrands();
  const sponsoredBrandIds = new Set(
    brands.filter((brand) => brand.sponsoredFlag).map((brand) => brand.id)
  );
  const trustScores = /* @__PURE__ */ new Map();
  const brandTrustScores = /* @__PURE__ */ new Map();
  const sellerReputations = /* @__PURE__ */ new Map();
  const brandVerified = /* @__PURE__ */ new Map();
  for (const brand of brands) {
    brandVerified.set(brand.id, brand.verifiedStatus || brand.claimStatus === "verified");
    try {
      const brandTrust = calculateTrustScore("brand", brand.id, brand.name);
      brandTrustScores.set(brand.id, brandTrust.score);
      const reputation = calculateSellerReputation(brand.id, brand.name, brand.createdAt);
      sellerReputations.set(brand.id, reputation.score);
    } catch {
    }
  }
  const products = await catalogStore2.listProducts();
  for (const product of products) {
    try {
      const trust = calculateTrustScore("product", product.id, product.title);
      trustScores.set(product.id, trust.score);
    } catch {
    }
  }
  return {
    query: query2,
    weights: getRankingWeights(),
    sponsoredBrandIds,
    rejectedProductIds: rejectedProductIds2,
    analyticsCounts: { views, wishlists, compares },
    reviewStats,
    trustScores,
    brandTrustScores,
    sellerReputations,
    sellerHealthScores: /* @__PURE__ */ new Map(),
    brandVerified
  };
}
function applyFilters(products, filter) {
  return products.filter((product) => {
    if (filter.categoryId && product.categoryId !== filter.categoryId) return false;
    if (filter.brandId && product.brandId !== filter.brandId) return false;
    if (filter.status && product.status !== filter.status) return false;
    if (filter.inStockOnly && product.stock <= 0) return false;
    if (filter.featuredOnly && !product.featuredFlag) return false;
    if (filter.newArrivalsOnly && !product.isNewArrival) return false;
    return true;
  });
}
function sortRanked(ranked, sort = "relevance") {
  if (sort === "relevance") return ranked;
  if (sort === "price_asc") {
    return [...ranked].sort((a, b) => a.product.price - b.product.price);
  }
  if (sort === "price_desc") {
    return [...ranked].sort((a, b) => b.product.price - a.product.price);
  }
  if (sort === "newest") {
    return [...ranked].sort((a, b) => b.product.updatedAt.localeCompare(a.product.updatedAt));
  }
  if (sort === "rating") {
    return [...ranked].sort(
      (a, b) => (b.signals.reviewScore ?? 0) - (a.signals.reviewScore ?? 0)
    );
  }
  return ranked;
}
async function search(filter = {}) {
  const [products, brands] = await Promise.all([
    catalogStore2.listProducts(),
    catalogStore2.listBrands()
  ]);
  const ctx = await buildRankingContext(filter.q);
  const filtered = applyFilters(products, filter);
  const ranked = sortRanked(rankProducts(filtered, brands, ctx), filter.sort);
  const limit = parseLimit2(filter.limit, 20);
  const offset = parseOffset2(filter.offset);
  const page = ranked.slice(offset, offset + limit);
  return {
    items: page.map((item) => ({
      product: item.product,
      score: item.score,
      breakdown: item.breakdown
    })),
    meta: {
      total: ranked.length,
      limit,
      offset,
      query: filter.q || "",
      sort: filter.sort || "relevance",
      weights: ctx.weights ?? getRankingWeights()
    }
  };
}
async function autocomplete(query2, limit = 10) {
  const q = query2.trim().toLowerCase();
  const [products, brands, categories, siteConfig, summary] = await Promise.all([
    catalogStore2.listProducts(),
    catalogStore2.listBrands(),
    catalogStore2.listCategories(),
    catalogStore2.getSiteConfig().catch(() => null),
    summarize("30d")
  ]);
  const matchesPrefix = (value) => !q || value.toLowerCase().includes(q);
  const productSuggestions = products.filter((p) => p.status === "live" && matchesPrefix(`${p.title} ${p.brandName}`)).slice(0, limit).map((p) => ({ id: p.id, label: p.title, type: "product" }));
  const brandSuggestions = brands.filter((b) => matchesPrefix(b.name)).slice(0, limit).map((b) => ({ id: b.id, label: b.name, type: "brand" }));
  const categorySuggestions = categories.filter((c) => c.enabled && matchesPrefix(c.name)).slice(0, limit).map((c) => ({ id: c.id, label: c.name, type: "category" }));
  const storeSuggestions = brands.filter((b) => matchesPrefix(b.name)).slice(0, Math.min(5, limit)).map((b) => ({ id: b.id, label: b.name, type: "store" }));
  const popularSearches = (siteConfig?.popularSearches || []).filter((item) => item.isActive !== false && matchesPrefix(item.term)).slice(0, limit).map((item) => ({ id: item.id, label: item.term, type: "popular_search" }));
  const trendingSearches2 = summary.trendingSearches.filter((item) => matchesPrefix(item.label || "")).slice(0, limit).map((item) => ({ id: item.id, label: item.label || item.id, type: "trending_search" }));
  return {
    query: query2,
    products: productSuggestions,
    brands: brandSuggestions,
    categories: categorySuggestions,
    stores: storeSuggestions,
    popularSearches,
    trendingSearches: trendingSearches2
  };
}
async function recommend(productId, limit = 10) {
  const product = await catalogStore2.getProduct(productId);
  if (!product) return [];
  const result = await search({
    categoryId: product.categoryId,
    brandId: product.brandId,
    limit: limit + 1
  });
  return result.items.filter((item) => item.product.id !== productId).slice(0, limit);
}
async function buildSuggestions(query2, categoryId) {
  const q = query2.trim().toLowerCase();
  const summary = await summarize("30d");
  const siteConfig = await catalogStore2.getSiteConfig().catch(() => null);
  const popularTerms = [
    ...(siteConfig?.popularSearches || []).filter((s) => s.isActive !== false).map((s) => s.term),
    ...summary.trendingSearches.map((s) => s.label || "").filter(Boolean)
  ];
  const didYouMean = q.length > 2 ? popularTerms.find((term) => {
    const t = term.toLowerCase();
    return t !== q && (t.startsWith(q.slice(0, 3)) || q.startsWith(t.slice(0, 3)));
  }) || null : null;
  const relatedSearches = summary.trendingSearches.map((s) => s.label || "").filter((term) => term && term.toLowerCase() !== q).slice(0, 5);
  const popularInCategory = categoryId ? summary.topProducts.filter((p) => p.metadata?.categoryName).map((p) => p.label).slice(0, 5) : [];
  const popularBrands = summary.topBrands.slice(0, 5).map((b) => b.label);
  const trendingKeywords = summary.trendingSearches.slice(0, 5).map((s) => s.label || s.id);
  return {
    didYouMean,
    relatedSearches,
    popularInCategory,
    popularBrands,
    trendingKeywords
  };
}

// server/search/searchAnalytics.ts
function requestContext3(req) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get("user-agent") || void 0,
    userId: req.userId || req.user?.uid
  };
}
function recordSearchQuery(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH,
    ...payload,
    ...requestContext3(req),
    metadata: {
      ...payload.metadata || {},
      resultCount: payload.resultCount
    }
  });
}
function recordSearchClick(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_CLICK,
    ...payload,
    ...requestContext3(req)
  });
}
function recordSearchNoResult(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_NO_RESULT,
    ...payload,
    ...requestContext3(req)
  });
}
function recordAutocompleteSelection(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_AUTOCOMPLETE_SELECT,
    ...payload,
    ...requestContext3(req)
  });
}
function recordSuggestionSelection(req, payload) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_SUGGESTION_SELECT,
    ...payload,
    ...requestContext3(req)
  });
}

// server/search/searchValidation.ts
var SEARCH_SORTS = ["relevance", "price_asc", "price_desc", "newest", "rating"];
var DISCOVERY_KEYS = [
  "trendingProducts",
  "trendingBrands",
  "trendingCategories",
  "featuredProducts",
  "editorsChoice",
  "newArrivals",
  "recentlyUpdated",
  "mostCompared",
  "mostWishlisted",
  "mostViewed",
  "topRated"
];
function isSearchSort(value) {
  return typeof value === "string" && SEARCH_SORTS.includes(value);
}
function isDiscoveryCollectionKey(value) {
  return typeof value === "string" && DISCOVERY_KEYS.includes(value);
}

// server/search/searchRouter.ts
var searchRouter = Router10();
function parseQueryNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : void 0;
}
searchRouter.get("/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : void 0;
    const filter = {
      q,
      categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : void 0,
      brandId: typeof req.query.brandId === "string" ? req.query.brandId : void 0,
      status: typeof req.query.status === "string" ? req.query.status : void 0,
      inStockOnly: req.query.inStockOnly === "true",
      featuredOnly: req.query.featuredOnly === "true",
      newArrivalsOnly: req.query.newArrivalsOnly === "true",
      sort: isSearchSort(req.query.sort) ? req.query.sort : "relevance",
      limit: parseQueryNumber(req.query.limit),
      offset: parseQueryNumber(req.query.offset)
    };
    const result = await search(filter);
    if (q) {
      if (result.meta.total === 0) {
        recordSearchNoResult(req, { searchQuery: q, source: "search_api" });
      } else {
        recordSearchQuery(req, {
          searchQuery: q,
          resultCount: result.meta.total,
          source: "search_api"
        });
      }
    }
    const suggestions = q ? await buildSuggestions(q, filter.categoryId) : void 0;
    return success(res, { ...result, suggestions });
  } catch (error2) {
    return res.status(500).json({
      success: false,
      error: error2 instanceof Error ? error2.message : "Search failed"
    });
  }
});
searchRouter.get("/search/autocomplete", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = Number(req.query.limit) || 10;
  const data = await autocomplete(q, limit);
  return success(res, data);
});
searchRouter.get("/search/trending", async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "7d";
  const data = await getTrendingSnapshot(range);
  return success(res, data);
});
searchRouter.get("/search/discovery", async (req, res) => {
  const sectionsParam = typeof req.query.sections === "string" ? req.query.sections : "";
  const sections = sectionsParam.split(",").map((value) => value.trim()).filter(isDiscoveryCollectionKey);
  const data = await getDiscoveryCollections(sections.length ? sections : void 0);
  return success(res, data);
});
searchRouter.get("/search/recommend/:productId", async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const items = await recommend(req.params.productId, limit);
  return success(res, { items });
});
searchRouter.post("/search/analytics/click", (req, res) => {
  const body = req.body || {};
  if (typeof body.productId !== "string") {
    return res.status(400).json({ success: false, error: "productId is required" });
  }
  recordSearchClick(req, {
    productId: body.productId,
    productTitle: body.productTitle,
    searchQuery: body.searchQuery,
    source: "search_click_hook",
    metadata: body.metadata
  });
  return res.status(202).json({ success: true });
});
searchRouter.post("/search/analytics/autocomplete", (req, res) => {
  const body = req.body || {};
  if (typeof body.searchQuery !== "string") {
    return res.status(400).json({ success: false, error: "searchQuery is required" });
  }
  recordAutocompleteSelection(req, {
    searchQuery: body.searchQuery,
    source: "autocomplete_hook",
    metadata: body.metadata
  });
  return res.status(202).json({ success: true });
});
searchRouter.post("/search/analytics/suggestion", (req, res) => {
  const body = req.body || {};
  if (typeof body.searchQuery !== "string") {
    return res.status(400).json({ success: false, error: "searchQuery is required" });
  }
  recordSuggestionSelection(req, {
    searchQuery: body.searchQuery,
    source: "suggestion_hook",
    metadata: body.metadata
  });
  return res.status(202).json({ success: true });
});

// server/communication/communicationRouter.ts
import { Router as Router11 } from "express";

// server/communication/preferenceService.ts
function getPreferences(userId) {
  return communicationStore.getPreferences(userId);
}
function updatePreferences(userId, patch, req) {
  const updated = communicationStore.upsertPreferences(userId, {
    ...patch,
    systemRequired: true
  });
  logPreferenceChangeAudit(userId, req);
  return updated;
}

// server/communication/broadcastService.ts
function listBroadcasts() {
  return communicationStore.listBroadcasts();
}
function getBroadcast(id) {
  return communicationStore.getBroadcast(id);
}
async function createBroadcast(input, req) {
  const broadcast = communicationStore.createBroadcast({
    broadcastType: input.broadcastType,
    title: input.title,
    body: input.body,
    targetRoles: input.targetRoles ?? [],
    targetSegments: input.targetSegments ?? [],
    createdBy: input.createdBy,
    status: input.status ?? BROADCAST_STATUSES.DRAFT,
    channels: input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP],
    scheduledAt: input.scheduledAt,
    metadata: input.metadata
  });
  logBroadcastAudit("create_broadcast", broadcast.id, "success", {
    userId: input.createdBy,
    metadata: {
      broadcastType: broadcast.broadcastType,
      targetRoles: broadcast.targetRoles,
      targetSegments: broadcast.targetSegments
    }
  }, req);
  return broadcast;
}
async function sendBroadcast(id, req) {
  const broadcast = communicationStore.getBroadcast(id);
  if (!broadcast) return null;
  const updated = communicationStore.updateBroadcast(id, {
    status: BROADCAST_STATUSES.SENT,
    sentAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!updated) return null;
  const targetUserIds = updated.metadata?.targetUserIds ?? [];
  for (const userId of targetUserIds) {
    await createNotification(
      {
        userId,
        type: "broadcast",
        category: updated.broadcastType === "admin" ? "admin" : updated.broadcastType === "seller" ? "seller" : "buyer",
        title: updated.title,
        summary: updated.body,
        channels: updated.channels,
        metadata: { broadcastId: updated.id }
      },
      req
    );
  }
  recordBroadcastSent(updated, req);
  logBroadcastAudit("send_broadcast", updated.id, "success", {
    userId: req?.userId || updated.createdBy,
    metadata: { targetUserCount: targetUserIds.length }
  }, req);
  return updated;
}
function updateBroadcast(id, patch) {
  return communicationStore.updateBroadcast(id, patch);
}

// server/communication/communicationService.ts
function getCommunicationSummary() {
  const notifications = communicationStore.countNotifications();
  const broadcasts = communicationStore.listBroadcasts();
  return {
    notifications: {
      total: notifications.length,
      unread: notifications.filter((n) => !n.read && !n.archived).length,
      read: notifications.filter((n) => n.read && !n.archived).length,
      archived: notifications.filter((n) => n.archived).length,
      pinned: notifications.filter((n) => n.pinned).length,
      dismissed: notifications.filter((n) => n.dismissed).length
    },
    broadcasts: {
      total: broadcasts.length,
      draft: broadcasts.filter((b) => b.status === BROADCAST_STATUSES.DRAFT).length,
      scheduled: broadcasts.filter((b) => b.status === BROADCAST_STATUSES.SCHEDULED).length,
      sent: broadcasts.filter((b) => b.status === BROADCAST_STATUSES.SENT).length
    },
    preferences: {
      usersWithPreferences: communicationStore.countPreferencesUsers()
    },
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function getCommunicationPlatformStatus() {
  return {
    summary: getCommunicationSummary(),
    channels: listChannelStatus()
  };
}

// server/communication/communicationRouter.ts
var communicationRouter = Router11();
var requireAuth4 = [authenticateRequest];
var requireAdmin2 = [authenticateRequest, requireRole(ROLES.ADMIN)];
function parseBool(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return void 0;
}
function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : void 0;
}
function resolveUserId(req) {
  return req.userId || req.user?.uid || null;
}
function buildFilter(req, userId) {
  return {
    userId,
    read: parseBool(req.query.read),
    archived: parseBool(req.query.archived),
    dismissed: parseBool(req.query.dismissed),
    pinned: parseBool(req.query.pinned),
    priority: typeof req.query.priority === "string" ? req.query.priority : void 0,
    category: typeof req.query.category === "string" ? req.query.category : void 0,
    type: typeof req.query.type === "string" ? req.query.type : void 0,
    q: typeof req.query.q === "string" ? req.query.q : void 0,
    limit: parseNumber(req.query.limit),
    offset: parseNumber(req.query.offset)
  };
}
communicationRouter.get("/notifications", ...requireAuth4, (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  const filter = buildFilter(req, userId);
  const items = listNotifications(filter);
  return success(res, {
    items,
    summary: getNotificationCenterSummary(userId),
    filter
  });
});
communicationRouter.get("/notifications/preferences", ...requireAuth4, (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
  return success(res, getPreferences(userId));
});
communicationRouter.put("/notifications/preferences", ...requireAuth4, (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
  return success(res, updatePreferences(userId, req.body || {}, req));
});
communicationRouter.post("/notifications/read", ...requireAuth4, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ success: false, error: "ids array is required" });
  return success(res, bulkRead(ids, req));
});
communicationRouter.post("/notifications/archive", ...requireAuth4, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ success: false, error: "ids array is required" });
  return success(res, bulkArchive(ids));
});
communicationRouter.patch("/notifications/:id/read", ...requireAuth4, (req, res) => {
  const updated = markRead(req.params.id, req);
  if (!updated) return res.status(404).json({ success: false, error: "Notification not found" });
  return success(res, updated);
});
communicationRouter.patch("/notifications/:id/unread", ...requireAuth4, (req, res) => {
  const updated = markUnread(req.params.id);
  if (!updated) return res.status(404).json({ success: false, error: "Notification not found" });
  return success(res, updated);
});
communicationRouter.patch("/notifications/:id/dismiss", ...requireAuth4, (req, res) => {
  const updated = dismissNotification(req.params.id, req);
  if (!updated) return res.status(404).json({ success: false, error: "Notification not found" });
  return success(res, updated);
});
communicationRouter.patch("/notifications/:id/archive", ...requireAuth4, (req, res) => {
  const updated = archiveNotification(req.params.id);
  if (!updated) return res.status(404).json({ success: false, error: "Notification not found" });
  return success(res, updated);
});
communicationRouter.delete("/notifications/:id", ...requireAuth4, (req, res) => {
  const deleted = deleteNotification(req.params.id, req);
  if (!deleted) return res.status(404).json({ success: false, error: "Notification not found" });
  return success(res, { deleted: true });
});
communicationRouter.get("/admin/notifications", ...requireAdmin2, (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : void 0;
  const filter = buildFilter(req, userId);
  if (!filter.limit) filter.limit = 50;
  if (filter.offset === void 0) filter.offset = 0;
  return success(res, { items: listNotifications(filter), filter });
});
communicationRouter.post("/admin/notifications", ...requireAdmin2, async (req, res) => {
  const body = req.body || {};
  if (!body.userId || !body.title || !body.type || !body.category) {
    return res.status(400).json({ success: false, error: "userId, title, type, and category are required" });
  }
  const notification = await createNotification(body, req);
  return created(res, notification);
});
communicationRouter.get("/admin/broadcasts", ...requireAdmin2, (_req, res) => {
  return success(res, { items: listBroadcasts() });
});
communicationRouter.post("/admin/broadcasts", ...requireAdmin2, async (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.body || !body.broadcastType) {
    return res.status(400).json({ success: false, error: "title, body, and broadcastType are required" });
  }
  const broadcast = await createBroadcast(
    {
      ...body,
      createdBy: req.userId || req.user?.uid || "admin"
    },
    req
  );
  return created(res, broadcast);
});
communicationRouter.post("/admin/broadcasts/:id/send", ...requireAdmin2, async (req, res) => {
  const broadcast = await sendBroadcast(req.params.id, req);
  if (!broadcast) return res.status(404).json({ success: false, error: "Broadcast not found" });
  return success(res, broadcast);
});
communicationRouter.patch("/admin/broadcasts/:id", ...requireAdmin2, (req, res) => {
  const updated = updateBroadcast(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: "Broadcast not found" });
  return success(res, updated);
});
communicationRouter.get("/admin/broadcasts/:id", ...requireAdmin2, (req, res) => {
  const broadcast = getBroadcast(req.params.id);
  if (!broadcast) return res.status(404).json({ success: false, error: "Broadcast not found" });
  return success(res, broadcast);
});
communicationRouter.get("/admin/communication", ...requireAdmin2, (_req, res) => {
  return success(res, getCommunicationPlatformStatus());
});

// server/ai/aiRouter.ts
import { Router as Router12 } from "express";

// server/ai/config.ts
function readFloatEnv(key, fallback) {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function readBoolEnv(key, fallback) {
  const value = process.env[key];
  if (value === void 0) return fallback;
  return value !== "false" && value !== "0";
}
function getAiConfig() {
  const provider = process.env.AI_PROVIDER || "gemini";
  return {
    enabled: readBoolEnv("AI_ENABLED", true),
    provider,
    model: process.env.AI_MODEL || "gemini-2.0-flash",
    temperature: readFloatEnv("AI_TEMPERATURE", 0.7),
    maxTokens: readPositiveIntEnv("AI_MAX_TOKENS", 1024),
    timeoutMs: readPositiveIntEnv("AI_TIMEOUT_MS", 3e4),
    retries: readPositiveIntEnv("AI_RETRIES", 2),
    maxInputChars: readPositiveIntEnv("AI_MAX_INPUT_CHARS", 12e3),
    featureFlags: {
      chat: readBoolEnv("AI_FEATURE_CHAT", true),
      recommend: readBoolEnv("AI_FEATURE_RECOMMEND", true),
      summarize: readBoolEnv("AI_FEATURE_SUMMARIZE", true),
      compare: readBoolEnv("AI_FEATURE_COMPARE", true),
      explain: readBoolEnv("AI_FEATURE_EXPLAIN", true),
      classify: readBoolEnv("AI_FEATURE_CLASSIFY", true),
      moderate: readBoolEnv("AI_FEATURE_MODERATE", true)
    }
  };
}

// server/ai/context/contextBuilder.ts
init_operationsStore();
function truncateJson(value, max = 4e3) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
async function buildProductContext(ids) {
  if (ids?.productId) {
    const product = await catalogStore2.getProduct(ids.productId);
    return truncateJson({ product });
  }
  const products = (await catalogStore2.listProducts()).filter((p) => p.status === "live").slice(0, 20);
  return truncateJson({ products });
}
async function buildBuyerContext(ids) {
  const productId = ids?.productId;
  const reviews = operationsStore.listReviews().filter((review) => !productId || review.productId === productId).slice(0, 15);
  return truncateJson({ recentReviews: reviews });
}
async function buildSellerContext(ids) {
  const sellerId = ids?.sellerId || ids?.brandId;
  if (!sellerId) return truncateJson({ note: "sellerId not provided" });
  return truncateJson({
    reputation: calculateSellerReputation(sellerId, ids?.sellerName),
    orders: operationsStore.listOrders().slice(0, 10)
  });
}
async function buildAnalyticsContext() {
  return truncateJson(await summarize("30d"));
}
async function buildTrustContext(ids) {
  const entityType = ids?.entityType || "seller";
  const entityId = ids?.entityId || ids?.sellerId || ids?.productId || ids?.brandId;
  if (!entityId) {
    return truncateJson({ moderation: getModerationSummary() });
  }
  if (entityType === "seller") {
    return truncateJson({
      reputation: calculateSellerReputation(entityId, ids?.entityLabel),
      moderation: getModerationSummary()
    });
  }
  return truncateJson({
    trust: calculateTrustScore(entityType, entityId, ids?.entityLabel),
    moderation: getModerationSummary()
  });
}
async function buildDiscoveryContext() {
  return truncateJson(await getDiscoveryCollections(["trendingProducts", "featuredProducts", "topRated"]));
}
async function buildCommunicationContext() {
  return truncateJson(getCommunicationSummary());
}
async function buildSearchContext(query2, ids) {
  const q = query2 || ids?.query || "";
  if (!q) return truncateJson({ note: "No search query provided" });
  return truncateJson(await search({ q, limit: 10 }));
}
async function buildCombinedContext(input) {
  const sections = [];
  const sources = [...new Set(input.sources)];
  for (const source of sources) {
    switch (source) {
      case "product":
        sections.push(`[PRODUCT]
${await buildProductContext(input.ids)}`);
        break;
      case "buyer":
        sections.push(`[BUYER]
${await buildBuyerContext(input.ids)}`);
        break;
      case "seller":
        sections.push(`[SELLER]
${await buildSellerContext(input.ids)}`);
        break;
      case "analytics":
        sections.push(`[ANALYTICS]
${await buildAnalyticsContext()}`);
        break;
      case "trust":
        sections.push(`[TRUST]
${await buildTrustContext(input.ids)}`);
        break;
      case "discovery":
        sections.push(`[DISCOVERY]
${await buildDiscoveryContext()}`);
        break;
      case "communication":
        sections.push(`[COMMUNICATION]
${await buildCommunicationContext()}`);
        break;
      case "search":
        sections.push(`[SEARCH]
${await buildSearchContext(input.query, input.ids)}`);
        break;
      default:
        break;
    }
  }
  return {
    block: sections.join("\n\n"),
    sources
  };
}

// server/ai/conversation/conversationManager.ts
import { randomUUID as randomUUID7 } from "crypto";
var sessions = /* @__PURE__ */ new Map();
var MAX_MESSAGES_PER_SESSION = 40;
var MAX_SESSIONS = 500;
function nowIso15() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function trimSessions() {
  if (sessions.size <= MAX_SESSIONS) return;
  const sorted = [...sessions.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const removeCount = sessions.size - MAX_SESSIONS;
  for (let i = 0; i < removeCount; i += 1) {
    sessions.delete(sorted[i].id);
  }
}
function createConversation(input) {
  const session = {
    id: `conv-${randomUUID7()}`,
    userId: input.userId,
    skillId: input.skillId,
    messages: [],
    contextSources: input.contextSources ?? [],
    contextIds: input.contextIds ?? {},
    createdAt: nowIso15(),
    updatedAt: nowIso15()
  };
  sessions.set(session.id, session);
  trimSessions();
  return session;
}
function getConversation2(conversationId) {
  return sessions.get(conversationId) ?? null;
}
function appendMessage(conversationId, message) {
  const session = sessions.get(conversationId);
  if (!session) return null;
  session.messages.push({ ...message, timestamp: nowIso15() });
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
  }
  session.updatedAt = nowIso15();
  return session;
}
function getConversationWindow(conversationId, maxMessages = 12) {
  const session = sessions.get(conversationId);
  if (!session) return [];
  return session.messages.slice(-maxMessages);
}
function buildConversationMemoryBlock(conversationId) {
  if (!conversationId) return "";
  const window2 = getConversationWindow(conversationId);
  if (window2.length === 0) return "";
  return window2.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n");
}
function listConversationStats() {
  return {
    activeSessions: sessions.size,
    maxSessions: MAX_SESSIONS,
    maxMessagesPerSession: MAX_MESSAGES_PER_SESSION,
    persistence: "memory_only"
  };
}

// server/ai/eventHooks.ts
function requestContext4(req) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get("user-agent") || void 0,
    userId: req.userId || req.user?.uid
  };
}
function logAiAudit(action, skillId, result, options = {}, req) {
  auditSystemEvent(action, "ai_skill", result, {
    resourceId: skillId,
    userId: options.userId,
    metadata: {
      executionTimeMs: options.executionTimeMs,
      provider: options.provider,
      model: options.model,
      ...options.metadata
    }
  }, req);
}
function recordAiRequest(skillId, metadata, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_REQUEST,
    source: "emi_ai_platform",
    metadata: { skillId, ...metadata },
    ...requestContext4(req)
  });
}
function recordAiSkillExecuted(skillId, metadata, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_SKILL_EXECUTED,
    source: "emi_ai_platform",
    metadata: { skillId, ...metadata },
    ...requestContext4(req)
  });
}
function recordAiChat(metadata, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_CHAT,
    source: "emi_ai_platform",
    metadata,
    ...requestContext4(req)
  });
}
function recordAiError(skillId, message, req) {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_ERROR,
    source: "emi_ai_platform",
    metadata: { skillId, message },
    ...requestContext4(req)
  });
}

// server/ai/promptRegistry.ts
var PROMPTS = {
  recommend_products_v1: {
    id: "recommend_products_v1",
    version: "1.0.0",
    category: "recommendation",
    description: "Recommend products for a buyer based on context.",
    variables: ["query", "preferences"],
    systemPrompt: "You are Emi, Choosify product recommendation assistant. Suggest relevant products concisely. Use only provided context. Do not invent inventory.",
    temperature: 0.6,
    maxTokens: 800
  },
  summarize_product_v1: {
    id: "summarize_product_v1",
    version: "1.0.0",
    category: "summarization",
    description: "Summarize a product for shoppers.",
    variables: ["productId"],
    systemPrompt: "You are Emi. Summarize the product clearly with key benefits, price context, and availability notes from context only.",
    temperature: 0.5,
    maxTokens: 600
  },
  compare_products_v1: {
    id: "compare_products_v1",
    version: "1.0.0",
    category: "comparison",
    description: "Compare multiple products.",
    variables: ["productIds"],
    systemPrompt: "You are Emi. Compare products objectively using provided attributes. Highlight differences and best fit scenarios.",
    temperature: 0.5,
    maxTokens: 900
  },
  seller_assistant_v1: {
    id: "seller_assistant_v1",
    version: "1.0.0",
    category: "assistant",
    description: "Assist sellers with operations insights.",
    variables: ["question"],
    systemPrompt: "You are Emi seller assistant. Provide actionable seller guidance using only provided seller context.",
    temperature: 0.6,
    maxTokens: 900
  },
  buyer_assistant_v1: {
    id: "buyer_assistant_v1",
    version: "1.0.0",
    category: "assistant",
    description: "Assist buyers with shopping decisions.",
    variables: ["question"],
    systemPrompt: "You are Emi buyer assistant. Help buyers decide using only provided product and discovery context.",
    temperature: 0.6,
    maxTokens: 900
  },
  analytics_explainer_v1: {
    id: "analytics_explainer_v1",
    version: "1.0.0",
    category: "analytics",
    description: "Explain marketplace analytics summaries.",
    variables: ["question"],
    systemPrompt: "You are Emi analytics explainer. Explain metrics plainly for non-technical users. Use only analytics context.",
    temperature: 0.4,
    maxTokens: 800
  },
  search_explainer_v1: {
    id: "search_explainer_v1",
    version: "1.0.0",
    category: "search",
    description: "Explain search and discovery results.",
    variables: ["query"],
    systemPrompt: "You are Emi search explainer. Explain why results may be relevant and suggest refinements using search context only.",
    temperature: 0.5,
    maxTokens: 700
  },
  review_summary_v1: {
    id: "review_summary_v1",
    version: "1.0.0",
    category: "summarization",
    description: "Summarize product reviews.",
    variables: ["productId"],
    systemPrompt: "You are Emi. Summarize review sentiment, recurring themes, and caveats. Do not quote PII.",
    temperature: 0.4,
    maxTokens: 700
  },
  trust_explanation_v1: {
    id: "trust_explanation_v1",
    version: "1.0.0",
    category: "trust",
    description: "Explain trust and reputation scores.",
    variables: ["entityType", "entityId"],
    systemPrompt: "You are Emi trust explainer. Explain trust/reputation components clearly without revealing private user data.",
    temperature: 0.3,
    maxTokens: 700
  },
  moderation_assistant_v1: {
    id: "moderation_assistant_v1",
    version: "1.0.0",
    category: "moderation",
    description: "Assist moderators with policy-aware guidance.",
    variables: ["question"],
    systemPrompt: "You are Emi moderation assistant. Provide neutral moderation guidance. Never auto-approve or auto-reject.",
    temperature: 0.2,
    maxTokens: 800
  },
  general_chat_v1: {
    id: "general_chat_v1",
    version: "1.0.0",
    category: "general",
    description: "General Emi assistant chat.",
    variables: ["message"],
    systemPrompt: "You are Emi, Choosify AI assistant. Be helpful, concise, and safe. Use provided context only. Refuse harmful requests.",
    temperature: 0.7,
    maxTokens: 1024
  }
};
function getPrompt(promptId) {
  const prompt = PROMPTS[promptId];
  if (!prompt) {
    throw new Error(`Unknown prompt: ${promptId}`);
  }
  return prompt;
}
function listPrompts() {
  return Object.values(PROMPTS);
}
function listPromptCategories() {
  return [...new Set(Object.values(PROMPTS).map((prompt) => prompt.category))];
}

// server/ai/providers/claudeProvider.ts
var ClaudeProvider = class {
  constructor() {
    this.name = "claude";
  }
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }
  async generate(_request) {
    throw new Error("Claude provider is not implemented. Use AI_PROVIDER=gemini or add a Claude adapter.");
  }
};

// server/ai/providers/geminiProvider.ts
import { GoogleGenAI } from "@google/genai";
var GeminiProvider = class {
  constructor() {
    this.name = "gemini";
    this.client = null;
  }
  getClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }
  isConfigured() {
    return this.getClient() !== null;
  }
  async generate(request) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Gemini provider is not configured. Set GEMINI_API_KEY.");
    }
    const model = process.env.AI_MODEL || "gemini-2.0-flash";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await client.models.generateContent({
        model,
        contents: `${request.systemPrompt}

${request.userPrompt}`,
        config: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          abortSignal: controller.signal
        }
      });
      const content = response.text?.trim() || "";
      if (!content) {
        throw new Error("Gemini returned an empty response");
      }
      return {
        content,
        model,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount
        }
      };
    } finally {
      clearTimeout(timer);
    }
  }
};

// server/ai/providers/localProvider.ts
var LocalProvider = class {
  constructor() {
    this.name = "local";
  }
  isConfigured() {
    return Boolean(process.env.AI_LOCAL_ENDPOINT?.trim());
  }
  async generate(_request) {
    throw new Error("Local model provider is not implemented. Configure AI_LOCAL_ENDPOINT when ready.");
  }
};

// server/ai/providers/openaiProvider.ts
var OpenAIProvider = class {
  constructor() {
    this.name = "openai";
  }
  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }
  async generate(_request) {
    throw new Error("OpenAI provider is not implemented. Use AI_PROVIDER=gemini or add an OpenAI adapter.");
  }
};

// server/ai/providers/providerFactory.ts
var providers2 = {
  gemini: new GeminiProvider(),
  openai: new OpenAIProvider(),
  claude: new ClaudeProvider(),
  local: new LocalProvider()
};
function getAiProvider() {
  const config = getAiConfig();
  return providers2[config.provider] ?? providers2.gemini;
}
function listProviderStatus() {
  return Object.values(providers2).map((provider) => ({
    provider: provider.name,
    configured: provider.isConfigured()
  }));
}

// server/ai/safety/safetyLayer.ts
var INJECTION_PATTERNS = [
  /ignore (all|previous|above) instructions/i,
  /system prompt/i,
  /you are now/i,
  /reveal (your|the) (api|secret|key|password)/i,
  /<\s*script/i
];
function validatePromptInput(input, maxChars) {
  const config = getAiConfig();
  const limit = maxChars ?? config.maxInputChars;
  const checks = [];
  checks.push({
    name: "input_length",
    passed: input.length <= limit,
    message: input.length <= limit ? void 0 : `Input exceeds ${limit} characters`
  });
  const injectionDetected = INJECTION_PATTERNS.some((pattern) => pattern.test(input));
  checks.push({
    name: "prompt_injection",
    passed: !injectionDetected,
    message: injectionDetected ? "Potential prompt injection detected" : void 0
  });
  checks.push({
    name: "non_empty",
    passed: input.trim().length > 0,
    message: input.trim().length > 0 ? void 0 : "Input is empty"
  });
  const passed = checks.every((check) => check.passed);
  return { passed, checks };
}
function validatePromptOutput(output, maxChars) {
  const config = getAiConfig();
  const limit = maxChars ?? config.maxTokens * 4;
  const checks = [];
  checks.push({
    name: "output_length",
    passed: output.length <= limit,
    message: output.length <= limit ? void 0 : `Output exceeds ${limit} characters`
  });
  checks.push({
    name: "non_empty",
    passed: output.trim().length > 0,
    message: output.trim().length > 0 ? void 0 : "Output is empty"
  });
  const passed = checks.every((check) => check.passed);
  return { passed, checks };
}
async function withRetry(fn, retries) {
  const config = getAiConfig();
  const maxAttempts = (retries ?? config.retries) + 1;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error2) {
      lastError = error2;
      if (attempt >= maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI execution failed");
}

// server/ai/skills/skillRegistry.ts
var SKILL_REGISTRY = {
  recommend_products: {
    id: "recommend_products",
    promptId: "recommend_products_v1",
    description: "Recommend products for buyers.",
    contextSources: ["buyer", "product", "discovery", "search"],
    safetyRules: ["no_invented_inventory", "no_pii_output", "context_only"],
    outputSchema: { recommendations: "string", rationale: "string" },
    buildUserPrompt: (variables, contextBlock) => `Recommend products.
Query: ${variables.query || "general"}
Preferences: ${variables.preferences || "none"}

Context:
${contextBlock}`
  },
  summarize_product: {
    id: "summarize_product",
    promptId: "summarize_product_v1",
    description: "Summarize a single product.",
    contextSources: ["product"],
    safetyRules: ["context_only", "no_pii_output"],
    outputSchema: { summary: "string", highlights: "string[]" },
    buildUserPrompt: (variables, contextBlock) => `Summarize product ${variables.productId || "unknown"}.

Context:
${contextBlock}`
  },
  compare_products: {
    id: "compare_products",
    promptId: "compare_products_v1",
    description: "Compare multiple products.",
    contextSources: ["product", "discovery"],
    safetyRules: ["context_only", "no_pii_output"],
    outputSchema: { comparison: "string", winner: "string" },
    buildUserPrompt: (variables, contextBlock) => `Compare products: ${variables.productIds || "unknown"}.

Context:
${contextBlock}`
  },
  seller_assistant: {
    id: "seller_assistant",
    promptId: "seller_assistant_v1",
    description: "Seller operations assistant.",
    contextSources: ["seller", "analytics", "communication"],
    safetyRules: ["context_only", "no_secrets", "no_pii_output"],
    outputSchema: { answer: "string", actions: "string[]" },
    buildUserPrompt: (variables, contextBlock) => `Seller question: ${variables.question || variables.message || ""}

Context:
${contextBlock}`
  },
  buyer_assistant: {
    id: "buyer_assistant",
    promptId: "buyer_assistant_v1",
    description: "Buyer shopping assistant.",
    contextSources: ["buyer", "product", "discovery", "search"],
    safetyRules: ["context_only", "no_pii_output"],
    outputSchema: { answer: "string", suggestions: "string[]" },
    buildUserPrompt: (variables, contextBlock) => `Buyer question: ${variables.question || variables.message || ""}

Context:
${contextBlock}`
  },
  analytics_explainer: {
    id: "analytics_explainer",
    promptId: "analytics_explainer_v1",
    description: "Explain analytics summaries.",
    contextSources: ["analytics"],
    safetyRules: ["context_only", "no_pii_output"],
    outputSchema: { explanation: "string" },
    buildUserPrompt: (variables, contextBlock) => `Explain analytics.
Question: ${variables.question || variables.message || "overview"}

Context:
${contextBlock}`
  },
  search_explainer: {
    id: "search_explainer",
    promptId: "search_explainer_v1",
    description: "Explain search results.",
    contextSources: ["search", "discovery"],
    safetyRules: ["context_only"],
    outputSchema: { explanation: "string", refinements: "string[]" },
    buildUserPrompt: (variables, contextBlock) => `Explain search for: ${variables.query || variables.message || ""}

Context:
${contextBlock}`
  },
  review_summary: {
    id: "review_summary",
    promptId: "review_summary_v1",
    description: "Summarize product reviews.",
    contextSources: ["product", "buyer"],
    safetyRules: ["no_pii_output", "context_only"],
    outputSchema: { summary: "string", sentiment: "string" },
    buildUserPrompt: (variables, contextBlock) => `Summarize reviews for product ${variables.productId || "unknown"}.

Context:
${contextBlock}`
  },
  trust_explanation: {
    id: "trust_explanation",
    promptId: "trust_explanation_v1",
    description: "Explain trust and reputation.",
    contextSources: ["trust"],
    safetyRules: ["no_pii_output", "context_only"],
    outputSchema: { explanation: "string", factors: "object" },
    buildUserPrompt: (variables, contextBlock) => `Explain trust for ${variables.entityType || "entity"} ${variables.entityId || ""}.

Context:
${contextBlock}`
  },
  moderation_assistant: {
    id: "moderation_assistant",
    promptId: "moderation_assistant_v1",
    description: "Moderation guidance assistant.",
    contextSources: ["trust", "communication"],
    safetyRules: ["no_auto_decisions", "no_pii_output", "context_only"],
    outputSchema: { guidance: "string", risks: "string[]" },
    buildUserPrompt: (variables, contextBlock) => `Moderation question: ${variables.question || variables.message || ""}

Context:
${contextBlock}`
  }
};
function getSkill(skillId) {
  const skill = SKILL_REGISTRY[skillId];
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);
  return skill;
}
function listSkills() {
  return Object.values(SKILL_REGISTRY);
}

// server/ai/aiService.ts
function ensureEnabled(feature) {
  const config = getAiConfig();
  if (!config.enabled) throw new Error("AI platform is disabled");
  if (!config.featureFlags[feature]) throw new Error(`AI feature "${feature}" is disabled`);
}
async function runPrompt(input) {
  const config = getAiConfig();
  const provider = getAiProvider();
  if (!provider.isConfigured()) {
    throw new Error(`AI provider "${provider.name}" is not configured`);
  }
  const prompt = getPrompt(input.promptId);
  const inputValidation = validatePromptInput(input.userPrompt);
  if (!inputValidation.passed) {
    throw new Error("AI input failed safety validation");
  }
  const { block, sources } = await buildCombinedContext({
    sources: input.contextSources,
    ids: input.contextIds,
    query: input.query
  });
  const memoryBlock = buildConversationMemoryBlock(input.conversationId);
  const composedUserPrompt = [
    input.userPrompt,
    block ? `

Context:
${block}` : "",
    memoryBlock ? `

Conversation Memory:
${memoryBlock}` : ""
  ].join("");
  const started = Date.now();
  recordAiRequest(input.skillId || "chat", {
    promptId: prompt.id,
    promptVersion: prompt.version,
    contextSources: sources
  }, input.req);
  const response = await withRetry(
    () => provider.generate({
      systemPrompt: prompt.systemPrompt,
      userPrompt: composedUserPrompt,
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
      timeoutMs: config.timeoutMs
    })
  );
  const outputValidation = validatePromptOutput(response.content);
  if (!outputValidation.passed) {
    throw new Error("AI output failed safety validation");
  }
  const executionTimeMs = Date.now() - started;
  const metadata = {
    provider: provider.name,
    model: response.model,
    promptId: prompt.id,
    promptVersion: prompt.version,
    executionTimeMs,
    safetyChecks: outputValidation,
    contextSources: sources,
    skillId: input.skillId,
    conversationId: input.conversationId
  };
  logAiAudit("execute_ai_skill", input.skillId || prompt.id, "success", {
    userId: input.userId,
    executionTimeMs,
    provider: provider.name,
    model: response.model,
    metadata: { promptId: prompt.id, contextSources: sources }
  }, input.req);
  if (input.skillId) {
    recordAiSkillExecuted(input.skillId, {
      promptId: prompt.id,
      executionTimeMs,
      provider: provider.name
    }, input.req);
  }
  return { content: response.content, metadata };
}
async function executeSkill(input, options = {}) {
  ensureEnabled("chat");
  const skill = getSkill(input.skillId);
  const variables = input.variables ?? {};
  if (input.message) variables.message = input.message;
  const { block } = await buildCombinedContext({
    sources: input.contextSources ?? skill.contextSources,
    ids: input.contextIds,
    query: variables.query
  });
  const userPrompt = skill.buildUserPrompt(variables, block);
  const result = await runPrompt({
    promptId: skill.promptId,
    userPrompt,
    variables,
    contextSources: input.contextSources ?? skill.contextSources,
    contextIds: input.contextIds,
    query: variables.query,
    conversationId: input.conversationId,
    skillId: skill.id,
    req: options.req,
    userId: options.userId
  });
  return {
    skillId: skill.id,
    content: result.content,
    metadata: input.includeMetadata ? result.metadata : void 0
  };
}
async function chat(input, options = {}) {
  ensureEnabled("chat");
  const skillId = input.skillId ?? "buyer_assistant";
  const conversation = (input.conversationId ? getConversation2(input.conversationId) : null) || createConversation({
    userId: options.userId,
    skillId,
    contextSources: input.contextSources,
    contextIds: input.contextIds
  });
  appendMessage(conversation.id, { role: "user", content: input.message });
  try {
    const result = await executeSkill(
      {
        skillId,
        message: input.message,
        conversationId: conversation.id,
        contextSources: input.contextSources ?? conversation.contextSources,
        contextIds: input.contextIds ?? conversation.contextIds,
        includeMetadata: input.includeMetadata
      },
      options
    );
    appendMessage(conversation.id, { role: "assistant", content: result.content });
    recordAiChat({ conversationId: conversation.id, skillId }, options.req);
    return {
      conversationId: conversation.id,
      reply: result.content,
      metadata: result.metadata
    };
  } catch (error2) {
    recordAiError(skillId, error2 instanceof Error ? error2.message : "chat failed", options.req);
    throw error2;
  }
}
async function recommend2(input, options) {
  ensureEnabled("recommend");
  return executeSkill({ ...input, skillId: "recommend_products" }, options);
}
async function summarize2(input, options) {
  ensureEnabled("summarize");
  return executeSkill({ ...input, skillId: "summarize_product" }, options);
}
async function compare(input, options) {
  ensureEnabled("compare");
  return executeSkill({ ...input, skillId: "compare_products" }, options);
}
async function explain(input, options) {
  ensureEnabled("explain");
  const skillId = input.skillId || (input.contextSources?.includes("trust") ? "trust_explanation" : input.contextSources?.includes("analytics") ? "analytics_explainer" : "search_explainer");
  return executeSkill({ ...input, skillId }, options);
}
function getAiPlatformStatus() {
  const config = getAiConfig();
  const provider = getAiProvider();
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    configured: provider.isConfigured(),
    featureFlags: config.featureFlags,
    skills: listSkills().map((skill) => skill.id),
    contextSources: ["buyer", "seller", "product", "analytics", "trust", "discovery", "communication", "search"],
    channels: listProviderStatus()
  };
}

// server/ai/aiRouter.ts
var aiRouter = Router12();
var requireAuth5 = [authenticateRequest];
var SKILL_IDS = [
  "recommend_products",
  "summarize_product",
  "compare_products",
  "seller_assistant",
  "buyer_assistant",
  "analytics_explainer",
  "search_explainer",
  "review_summary",
  "trust_explanation",
  "moderation_assistant"
];
var CONTEXT_SOURCES = [
  "buyer",
  "seller",
  "product",
  "analytics",
  "trust",
  "discovery",
  "communication",
  "search"
];
function parseContextSources(value) {
  if (!Array.isArray(value)) return void 0;
  return value.filter((item) => CONTEXT_SOURCES.includes(item));
}
aiRouter.get("/ai/status", ...requireAuth5, (_req, res) => {
  return success(res, {
    ...getAiPlatformStatus(),
    prompts: listPrompts().map((prompt) => ({
      id: prompt.id,
      version: prompt.version,
      category: prompt.category
    })),
    promptCategories: listPromptCategories(),
    skills: listSkills().map((skill) => ({
      id: skill.id,
      promptId: skill.promptId,
      contextSources: skill.contextSources
    })),
    conversation: listConversationStats()
  });
});
aiRouter.post("/ai/chat", ...requireAuth5, async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.message !== "string" || !body.message.trim()) {
      return res.status(400).json({ success: false, error: "message is required" });
    }
    const result = await chat(
      {
        message: body.message.trim(),
        skillId: SKILL_IDS.includes(body.skillId) ? body.skillId : void 0,
        conversationId: typeof body.conversationId === "string" ? body.conversationId : void 0,
        contextSources: parseContextSources(body.contextSources),
        contextIds: typeof body.contextIds === "object" ? body.contextIds : void 0,
        includeMetadata: body.includeMetadata !== false
      },
      { req, userId: req.userId || req.user?.uid }
    );
    return success(res, result);
  } catch (error2) {
    return res.status(500).json({
      success: false,
      error: error2 instanceof Error ? error2.message : "AI chat failed"
    });
  }
});
aiRouter.post("/ai/recommend", ...requireAuth5, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await recommend2(
      {
        skillId: "recommend_products",
        variables: body.variables,
        contextSources: parseContextSources(body.contextSources),
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false
      },
      { req, userId: req.userId }
    );
    return success(res, result);
  } catch (error2) {
    return res.status(500).json({ success: false, error: error2 instanceof Error ? error2.message : "AI recommend failed" });
  }
});
aiRouter.post("/ai/summarize", ...requireAuth5, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await summarize2(
      {
        skillId: "summarize_product",
        variables: body.variables,
        contextSources: parseContextSources(body.contextSources) ?? ["product"],
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false
      },
      { req, userId: req.userId }
    );
    return success(res, result);
  } catch (error2) {
    return res.status(500).json({ success: false, error: error2 instanceof Error ? error2.message : "AI summarize failed" });
  }
});
aiRouter.post("/ai/compare", ...requireAuth5, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await compare(
      {
        skillId: "compare_products",
        variables: body.variables,
        contextSources: parseContextSources(body.contextSources) ?? ["product", "discovery"],
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false
      },
      { req, userId: req.userId }
    );
    return success(res, result);
  } catch (error2) {
    return res.status(500).json({ success: false, error: error2 instanceof Error ? error2.message : "AI compare failed" });
  }
});
aiRouter.post("/ai/explain", ...requireAuth5, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await explain(
      {
        skillId: body.skillId,
        variables: body.variables,
        message: body.message,
        contextSources: parseContextSources(body.contextSources),
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false
      },
      { req, userId: req.userId }
    );
    return success(res, result);
  } catch (error2) {
    return res.status(500).json({ success: false, error: error2 instanceof Error ? error2.message : "AI explain failed" });
  }
});

// server/emi/emiRouter.ts
import { Router as Router13 } from "express";
var emiRouter = Router13();
var CATALOG_SYSTEM_SCOPE = [
  "You are Emi, Choosify's public shopping assistant.",
  "Answer ONLY using the catalog data provided below (products, brands, categories, deals).",
  "If the question cannot be answered from that catalog data, say you can only help with Choosify catalog questions.",
  "Do not invent products, prices, or brands that are not in the catalog data."
].join(" ");
function truncateJson2(value, max = 12e3) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
function extractUserMessage(body) {
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }
  if (Array.isArray(body.messages)) {
    const lastUser = [...body.messages].reverse().find(
      (entry) => typeof entry === "object" && entry !== null && entry.role === "user" && typeof entry.content === "string"
    );
    if (lastUser?.content.trim()) return lastUser.content.trim();
  }
  return null;
}
async function buildPublicCatalogBlock() {
  const [products, brands, categories, deals] = await Promise.all([
    catalogStore2.listProducts(),
    catalogStore2.listBrands(),
    catalogStore2.listCategories(),
    catalogStore2.listDeals()
  ]);
  const liveProducts2 = products.filter((product) => product.status === "live").slice(0, 40).map((product) => ({
    id: product.id,
    title: product.title,
    description: product.description,
    brandId: product.brandId,
    brandName: product.brandName,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    price: product.price,
    originalPrice: product.originalPrice,
    status: product.status
  }));
  return truncateJson2({
    products: liveProducts2,
    brands: brands.slice(0, 40).map((brand) => ({
      id: brand.id,
      name: brand.name,
      description: brand.description
    })),
    categories: categories.slice(0, 40).map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description
    })),
    deals: deals.slice(0, 40).map((deal) => ({
      id: deal.id,
      name: deal.name,
      seller: deal.seller,
      category: deal.category,
      status: deal.status,
      discountType: deal.discountType,
      discountValue: deal.discountValue,
      promoCode: deal.promoCode,
      productId: deal.productId,
      brandId: deal.brandId,
      validFrom: deal.validFrom,
      validUntil: deal.validUntil
    }))
  });
}
emiRouter.post("/emi/chat", async (req, res) => {
  try {
    const body = req.body || {};
    const userMessage = extractUserMessage(body);
    if (!userMessage) {
      return res.status(400).json({ success: false, error: "message is required" });
    }
    const pageContext = body.pageContext && typeof body.pageContext === "object" ? body.pageContext : void 0;
    const catalogBlock = await buildPublicCatalogBlock();
    const scopedMessage = [
      CATALOG_SYSTEM_SCOPE,
      pageContext?.pathname ? `User is currently on page: ${pageContext.pathname}${pageContext.title ? ` (${pageContext.title})` : ""}.` : "",
      "",
      "Catalog data:",
      catalogBlock,
      "",
      "User question:",
      userMessage
    ].filter(Boolean).join("\n");
    const result = await chat(
      {
        message: scopedMessage,
        skillId: "buyer_assistant",
        // Catalog-only context — no analytics, trust, moderation, etc.
        contextSources: ["product"],
        conversationId: typeof body.conversationId === "string" ? body.conversationId : void 0,
        includeMetadata: false
      },
      { req }
    );
    return res.json({
      reply: result.reply,
      picks: [],
      conversationId: result.conversationId,
      mode: "catalog"
    });
  } catch (error2) {
    return res.status(500).json({
      success: false,
      error: error2 instanceof Error ? error2.message : "EMI chat failed"
    });
  }
});

// server/routes/health.ts
import { Router as Router14 } from "express";

// server/lib/readiness.ts
var ready = false;
function isApplicationReady() {
  return ready;
}
function getReadinessStatus() {
  return ready ? "ready" : "starting";
}

// server/routes/health.ts
var startedAt = Date.now();
var healthRouter = Router14();
healthRouter.get("/health", healthRateLimit, (_req, res) => {
  recordHealthCheck();
  return success(res, {
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: getEnvironment(),
    version: getAppVersion(),
    nodeVersion: getNodeVersion(),
    startedAt: new Date(startedAt).toISOString(),
    app: getAppName(),
    readiness: getReadinessStatus(),
    memory: getMemoryUsageSummary()
  });
});

// server/routes/diagnostics.ts
import { Router as Router15 } from "express";
var startedAt2 = Date.now();
var diagnosticsRouter = Router15();
diagnosticsRouter.get(
  "/diagnostics",
  authenticateRequest,
  requireRole(ROLES.ADMIN),
  (_req, res) => {
    const metrics = getMetricsSnapshot();
    const readiness = getReadinessStatus();
    return success(res, {
      application: {
        name: getAppName(),
        version: getAppVersion(),
        environment: getEnvironment(),
        nodeVersion: getNodeVersion(),
        uptimeSeconds: Math.floor(process.uptime()),
        startedAt: new Date(startedAt2).toISOString()
      },
      runtime: {
        memory: getMemoryUsageSummary(),
        cpu: getCpuUsageSummary(),
        system: getSystemSummary()
      },
      metrics,
      rateLimits: getRateLimitSummary(),
      health: {
        status: readiness === "ready" ? "ok" : "starting",
        readiness,
        ready: isApplicationReady(),
        healthChecks: metrics.healthChecks
      }
    });
  }
);

// server/app.ts
dotenv2.config();
validateEnvironment();
function createApp() {
  const app3 = express();
  app3.disable("x-powered-by");
  app3.use(requestIdMiddleware);
  app3.use(requestTimingMiddleware);
  app3.use(createHelmetMiddleware());
  app3.use(compression());
  app3.use(healthRouter);
  app3.use(diagnosticsRouter);
  app3.post(
    "/api/webhooks/meta",
    express.raw({ type: "application/json", limit: RAW_BODY_LIMIT }),
    handleMetaWebhookPost
  );
  app3.use(express.json({ limit: JSON_BODY_LIMIT }));
  app3.use(express.urlencoded({ extended: true, limit: URLENCODED_BODY_LIMIT }));
  app3.use(payloadTooLargeHandler);
  app3.use(createCorsMiddleware());
  app3.use("/api/v1/auth", authRateLimit);
  app3.use("/api/messaging", messagingRateLimit);
  app3.use("/api/conversations", messagingRateLimit);
  app3.use("/api/messages", messagingRateLimit);
  app3.use("/api/agents", messagingRateLimit);
  app3.use("/api/admin", adminRateLimit);
  app3.use("/api/ai", aiRateLimit);
  app3.use("/api/emi", aiRateLimit);
  app3.use("/api/v1/catalog/products", searchRateLimitMiddleware);
  app3.use("/api/v1/catalog", catalogReadRateLimitMiddleware);
  app3.use("/api", publicApiRateLimit);
  app3.use("/api", analyticsRouter);
  app3.use("/api", moderationRouter);
  app3.use("/api", searchRouter);
  app3.use("/api", communicationRouter);
  app3.use("/api", aiRouter);
  app3.use("/api", emiRouter);
  app3.use("/api", messagingRouter);
  app3.use("/api", router);
  app3.use("/api/v1", catalogRouter);
  app3.use("/api/v1", operationsRouter);
  app3.use("/api/v1", bookingRouter);
  app3.use("/api/v1", paymentsRouter);
  app3.use("/api/v1", authRouter);
  app3.get("/api/admin/stats", async (_req, res) => {
    const summary = getAnalyticsSummary("30d");
    res.json({
      totalUsers: 48291,
      activeUsers: 14032,
      sellers: 1847,
      creators: 342,
      products: 94520,
      revenue: summary.orders.revenue,
      engagement: summary.orders.total > 0 ? 12.4 : 0,
      pendingModeration: summary.reviews.pending,
      storefrontOrders: summary.orders.total,
      newLeads: summary.leads.new,
      activeShipments: summary.shipments.pending
    });
  });
  app3.post("/api/products", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "POST",
      path: "/api/products",
      payloadKeys: Object.keys(req.body || {})
    });
    res.status(201).json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products",
      productId: "prod_" + Math.random().toString(36).substring(2, 11),
      product: req.body
    });
  });
  app3.put("/api/products/:id", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "PUT",
      path: `/api/products/${req.params.id}`,
      payloadKeys: Object.keys(req.body || {})
    });
    res.json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products/:id",
      productId: req.params.id,
      product: req.body
    });
  });
  app3.patch("/api/products/:id", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "PATCH",
      path: `/api/products/${req.params.id}`,
      payloadKeys: Object.keys(req.body || {})
    });
    res.json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products/:id",
      productId: req.params.id,
      product: req.body
    });
  });
  return app3;
}
function attachErrorHandler(app3) {
  app3.use(errorHandler);
}

// server/vercelEntry.ts
var app2 = createApp();
attachErrorHandler(app2);
var vercelEntry_default = app2;
export {
  vercelEntry_default as default
};
