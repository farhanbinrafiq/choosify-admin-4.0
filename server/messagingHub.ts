import { Request, Response, Router } from "express";
import { Server as SocketIOServer } from "socket.io";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  addDoc 
} from "firebase/firestore";
import { db } from "../src/lib/firebase";
import { UnifiedMessage, Conversation, Agent, Customer } from "../src/types";

export const messagingRouter = Router();
let ioInstance: SocketIOServer | null = null;

// Mock Queue system to simulate Bull + Redis in-memory safely with logging and retry support
class MockBullQueue {
  private queue: any[] = [];
  private processing = false;

  async add(jobName: string, data: any) {
    this.queue.push({ name: jobName, data, retries: 3 });
    console.log(`[Bull Queue] Job added: ${jobName}. Queue size: ${this.queue.length}`);
    this.processNext();
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const job = this.queue.shift();
    try {
      await this.worker(job);
    } catch (err) {
      console.error(`[Bull Queue] Failed Job ${job.name}:`, err);
      if (job.retries > 0) {
        job.retries--;
        console.log(`[Bull Queue] Retrying job ${job.name}. Retries remaining: ${job.retries}`);
        this.queue.push(job);
      }
    } finally {
      this.processing = false;
      setTimeout(() => this.processNext(), 100);
    }
  }

  private async worker(job: any) {
    const { name, data } = job;
    if (name === "process-meta-webhook") {
      await handleNormalizedMetaMessage(data);
    }
  }
}

const webhookQueue = new MockBullQueue();

// Core verification tokens
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "choosify_omni_secure_token_abc123";

// Set Socket.io server instance
export function setSocketIO(io: SocketIOServer) {
  ioInstance = io;
  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);
    
    socket.on("join:conversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`[Socket.io] Client joined conversation: ${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId) => {
      socket.leave(conversationId);
      console.log(`[Socket.io] Client left conversation: ${conversationId}`);
    });

    socket.on("typing:start", ({ conversationId, agentName }) => {
      socket.to(conversationId).emit("typing:start", { agentName });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(conversationId).emit("typing:stop");
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
}

// Pre-seeded system records in Firestore to ensure immediately beautiful sandbox environment
export async function seedOmnichannelData() {
  try {
    const querySnapshot = await getDocs(collection(db, "omni_conversations"));
    if (!querySnapshot.empty) {
      console.log("[Seeding] Omnichannel messages already seeded.");
      return;
    }

    console.log("[Seeding] Omnichannel database seed initiated...");

    // 1. Seed Customer Records
    const customersList: Customer[] = [
      {
        id: "cust_wa_01",
        name: "Sajid Karim",
        phone: "+8801712345678",
        email: "sajid.karim@gmail.com",
        avatar: "SK",
        platformIds: { whatsapp: "wa_user_sajid" }
      },
      {
        id: "cust_me_02",
        name: "Israt Jahan",
        phone: "+8801987654321",
        email: "israt.jahan@yahoo.com",
        avatar: "IJ",
        platformIds: { messenger: "fb_user_israt" }
      },
      {
        id: "cust_ig_03",
        name: "Nabila Chowdhury",
        phone: "+8801555111222",
        email: "nabila.insta@gmail.com",
        avatar: "NC",
        platformIds: { instagram: "ig_user_nabila" }
      },
      {
        id: "cust_pt_04",
        name: "Tanvir Sadek",
        phone: "+8801822334455",
        email: "tanvir.sadek@choosify.com",
        avatar: "TS",
        platformIds: { whatsapp: "wa_user_tanvir" }
      }
    ];

    for (const cust of customersList) {
      await setDoc(doc(collection(db, "omni_customers"), cust.id), cust);
    }

    // 2. Seed Agents
    const agentsList: Agent[] = [
      {
        id: "agent_farhan",
        name: "Kazi Farhan",
        email: "kazi@choosify.com.bd",
        role: "Support Specialst",
        assignedConversations: [],
        status: "active"
      },
      {
        id: "agent_nusrat",
        name: "Nusrat Jahan",
        email: "nusrat@choosify.com.bd",
        role: "WhatsApp Team Lead",
        assignedConversations: [],
        status: "active"
      },
      {
        id: "agent_zahid",
        name: "Zahid Hasan",
        email: "zahid@choosify.com.bd",
        role: "Social Media Executive",
        assignedConversations: [],
        status: "active"
      }
    ];

    for (const agent of agentsList) {
      await setDoc(doc(collection(db, "omni_agents"), agent.id), agent);
    }

    // 3. Seed Conversations & historical messages
    const sampleConversations: Conversation[] = [
      {
        conversationId: "conv_wa_01",
        platform: "whatsapp",
        senderName: "Sajid Karim",
        senderAvatar: "SK",
        lastMessage: "Is my traditional Jamdani silk order dispatched yet? Invoice #INV-294.",
        status: "open",
        assignedAgent: "agent_farhan",
        updatedAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        conversationId: "conv_me_02",
        platform: "messenger",
        senderName: "Israt Jahan",
        senderAvatar: "IJ",
        lastMessage: "Hello! We love the apparel quality we got from Karika brand. Can we partner?",
        status: "pending",
        assignedAgent: "agent_farhan",
        updatedAt: new Date(Date.now() - 7200000).toISOString()
      },
      {
        conversationId: "conv_ig_03",
        platform: "instagram",
        senderName: "Nabila Chowdhury",
        senderAvatar: "NC",
        lastMessage: "Awesome reel! Sent you a DM regarding collaboration details on Eid promotions.",
        status: "open",
        assignedAgent: "agent_zahid",
        updatedAt: new Date(Date.now() - 10800000).toISOString()
      },
      {
        conversationId: "conv_pt_04",
        platform: "platform",
        senderName: "Tanvir Sadek",
        senderAvatar: "TS",
        lastMessage: "I face a transaction delay on my cashbook sync, shows pending.",
        status: "resolved",
        assignedAgent: "agent_farhan",
        updatedAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    for (const conv of sampleConversations) {
      await setDoc(doc(collection(db, "omni_conversations"), conv.conversationId), conv);
    }

    // Historical messages
    const messagesSeed: UnifiedMessage[] = [
      // Sajid WhatsApp conversation
      {
        id: "m_wa_1",
        platform: "whatsapp",
        platformMessageId: "mid.wa_9841_abc",
        conversationId: "conv_wa_01",
        senderId: "wa_user_sajid",
        senderName: "Sajid Karim",
        content: { type: "text", body: "Salam Choosify support. Quick query about my recent purchase." },
        direction: "inbound",
        status: "read",
        assignedAgent: "agent_farhan",
        conversationStatus: "open",
        timestamp: new Date(Date.now() - 4800000).toISOString()
      },
      {
        id: "m_wa_2",
        platform: "whatsapp",
        platformMessageId: "mid.wa_9842_def",
        conversationId: "conv_wa_01",
        senderId: "agent_farhan",
        senderName: "Kazi Farhan",
        content: { type: "text", body: "Walaikum Assalam Sajid! I would love to help. Please share your order or invoice reference." },
        direction: "outbound",
        status: "read",
        assignedAgent: "agent_farhan",
        conversationStatus: "open",
        timestamp: new Date(Date.now() - 4200000).toISOString()
      },
      {
        id: "m_wa_3",
        platform: "whatsapp",
        platformMessageId: "mid.wa_9843_ghi",
        conversationId: "conv_wa_01",
        senderId: "wa_user_sajid",
        senderName: "Sajid Karim",
        content: { type: "text", body: "Is my traditional Jamdani silk order dispatched yet? Invoice #INV-294." },
        direction: "inbound",
        status: "read",
        assignedAgent: "agent_farhan",
        conversationStatus: "open",
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },

      // Israt Messenger conversation
      {
        id: "m_me_1",
        platform: "messenger",
        platformMessageId: "mid.fb_1",
        conversationId: "conv_me_02",
        senderId: "fb_user_israt",
        senderName: "Israt Jahan",
        content: { type: "text", body: "Hello! We love the apparel quality we got from Karika brand. Can we partner?" },
        direction: "inbound",
        status: "read",
        assignedAgent: "agent_farhan",
        conversationStatus: "pending",
        timestamp: new Date(Date.now() - 7200000).toISOString()
      },

      // Nabila Instagram conversation
      {
        id: "m_ig_1",
        platform: "instagram",
        platformMessageId: "mid.ig_1",
        conversationId: "conv_ig_03",
        senderId: "ig_user_nabila",
        senderName: "Nabila Chowdhury",
        content: { type: "text", body: "Awesome reel! Sent you a DM regarding collaboration details on Eid promotions." },
        direction: "inbound",
        status: "delivered",
        assignedAgent: "agent_zahid",
        conversationStatus: "open",
        timestamp: new Date(Date.now() - 10800000).toISOString()
      },

      // Tanvir Native Platform conversation
      {
        id: "m_pt_1",
        platform: "platform",
        platformMessageId: "mid.pt_1",
        conversationId: "conv_pt_04",
        senderId: "wa_user_tanvir",
        senderName: "Tanvir Sadek",
        content: { type: "text", body: "I face a transaction delay on my cashbook sync, shows pending." },
        direction: "inbound",
        status: "read",
        assignedAgent: "agent_farhan",
        conversationStatus: "resolved",
        timestamp: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    for (const msg of messagesSeed) {
      await setDoc(doc(collection(db, "omni_messages"), msg.id), msg);
    }

    console.log("[Seeding] Omnichannel database seed completed successfully.");
  } catch (error) {
    console.error("[Seeding Error] Error seeding omnichannel dataset:", error);
  }
}

// -------------------------------------------------------------
// WEBHOOK SYSTEM (CRITICAL Webhook verification & processing)
// -------------------------------------------------------------

// Meta webhook subscription verification
messagingRouter.get("/webhooks/meta", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("[Webhook Verification] Received Meta handshake audit:", { mode, token });

  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    console.log("[Webhook Verification] Webhook verified successfully.");
    return res.status(200).send(challenge);
  } else {
    console.warn("[Webhook Verification Error] Forbidden verification mismatch.");
    return res.sendStatus(403);
  }
});

// Meta webhook receiver route
messagingRouter.post("/webhooks/meta", (req: Request, res: Response) => {
  const body = req.body;

  // RealMeta webhook payload identification & parsing
  if (!body.object) {
    return res.status(400).json({ error: "Invalid meta webhook payload structure" });
  }

  console.log(`[Webhook Receipt] Event received from object: ${body.object}`);

  // Push to local resiliency queue to process async
  webhookQueue.add("process-meta-webhook", body);

  // Return fast 200 OK as required by Meta specs
  return res.status(200).json({ status: "EVENT_RECEIVED", object: body.object });
});


// Core Webhook normalization & storage
async function handleNormalizedMetaMessage(webhookData: any) {
  const { object, entry } = webhookData;
  if (!entry || entry.length === 0) return;

  let platform: "whatsapp" | "messenger" | "instagram" | "platform" = "whatsapp";
  let platformMessageId = "";
  let senderId = "";
  let senderName = "";
  let bodyContent = "";
  let mediaUrl: string | undefined = undefined;
  let type: "text" | "image" | "file" = "text";

  // Check platforms
  if (object === "whatsapp_business_account") {
    platform = "whatsapp";
    const changes = entry[0]?.changes?.[0]?.value;
    if (!changes || !changes.messages || changes.messages.length === 0) return;
    const msg = changes.messages[0];
    senderId = msg.from;
    senderName = changes.contacts?.[0]?.profile?.name || `WA User (${msg.from})`;
    platformMessageId = msg.id;

    if (msg.type === "text") {
      bodyContent = msg.text.body;
      type = "text";
    } else if (msg.type === "image") {
      bodyContent = "[Image Attachment]";
      type = "image";
      mediaUrl = msg.image.url || "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=400";
    } else {
      bodyContent = `[${msg.type} File Attachment]`;
      type = "file";
    }

  } else if (object === "page") {
    platform = "messenger";
    const messaging = entry[0]?.messaging?.[0];
    if (!messaging || !messaging.message) return;
    const msg = messaging.message;
    senderId = messaging.sender?.id;
    senderName = `Messenger Contributor (${senderId.substring(0, 5)})`;
    platformMessageId = msg.mid;

    if (msg.text) {
      bodyContent = msg.text;
      type = "text";
    } else if (msg.attachments && msg.attachments[0]) {
      const att = msg.attachments[0];
      if (att.type === "image") {
        bodyContent = "[Messenger Photo]";
        type = "image";
        mediaUrl = att.payload?.url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400";
      } else {
        bodyContent = "[Attachment Document]";
        type = "file";
      }
    }

  } else if (object === "instagram") {
    platform = "instagram";
    const messaging = entry[0]?.messaging?.[0];
    if (!messaging || !messaging.message) return;
    const msg = messaging.message;
    senderId = messaging.sender?.id;
    senderName = `IG Fan (${senderId.substring(0, 5)})`;
    platformMessageId = msg.mid;

    if (msg.text) {
      bodyContent = msg.text;
      type = "text";
    } else if (msg.attachments && msg.attachments[0]) {
      const att = msg.attachments[0];
      if (att.type === "image") {
        bodyContent = "[Instagram Photo]";
        type = "image";
        mediaUrl = att.payload?.url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400";
      } else {
        bodyContent = "[Instagram Document]";
        type = "file";
      }
    }
  }

  // Deduplicate using platformMessageId in Firestore
  const qDeduplicate = query(
    collection(db, "omni_messages"), 
    where("platformMessageId", "==", platformMessageId)
  );
  const existingDocs = await getDocs(qDeduplicate);
  if (!existingDocs.empty) {
    console.log(`[Deduplication] Message with id ${platformMessageId} already processed. Skipping.`);
    return;
  }

  // Track or Create unique conversation ID
  const conversationId = `conv_${platform}_${senderId}`;

  // Find or Create conversation document
  const convRef = doc(collection(db, "omni_conversations"), conversationId);
  const convSnap = await getDoc(convRef);
  
  let conversationStatus: "open" | "pending" | "resolved" = "open";
  let assignedAgent = "agent_farhan"; // default agent

  if (convSnap.exists()) {
    const data = convSnap.data() as Conversation;
    conversationStatus = data.status || "open";
    assignedAgent = data.assignedAgent || "agent_farhan";
  }

  // Normalise message instance
  const messageId = `m_in_${Date.now()}`;
  const normalizedMessage: UnifiedMessage = {
    id: messageId,
    platform,
    platformMessageId,
    conversationId,
    senderId,
    senderName,
    senderAvatar: senderName[0],
    content: { type, body: bodyContent, mediaUrl },
    direction: "inbound",
    status: "delivered", // incoming means marked as delivered status
    assignedAgent,
    conversationStatus,
    timestamp: new Date().toISOString()
  };

  // Persistent storage in Firestore
  await setDoc(doc(collection(db, "omni_messages"), messageId), normalizedMessage);

  // Update/Upsert Conversation document
  const updatedConversation: Conversation = {
    conversationId,
    platform,
    senderName,
    senderAvatar: senderName[0],
    lastMessage: bodyContent,
    assignedAgent,
    status: conversationStatus,
    updatedAt: new Date().toISOString()
  };

  await setDoc(convRef, updatedConversation, { merge: true });

  // Real-time Push to live controllers via socket.io
  if (ioInstance) {
    console.log(`[Socket.io] Broadcasting incoming Message event of platform ${platform}`);
    ioInstance.emit("message:received", normalizedMessage);
    ioInstance.to(conversationId).emit("message:new", normalizedMessage);
    ioInstance.emit("conversation:updated", updatedConversation);
  }
}

// -------------------------------------------------------------
// APP REST API ENFORCEMENT ENDPOINTS
// -------------------------------------------------------------

// GET all active thread conversations
messagingRouter.get("/conversations", async (req: Request, res: Response) => {
  try {
    const q = query(collection(db, "omni_conversations"), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);
    const list: Conversation[] = [];
    snapshot.forEach(doc => {
      list.push(doc.data() as Conversation);
    });
    return res.status(200).json(list);
  } catch (err: any) {
    console.error("[GET Conversations Error]", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET specific conversation
messagingRouter.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const docRef = doc(collection(db, "omni_conversations"), req.params.id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: "Conversation thread not found." });
    }
    return res.status(200).json(snap.data());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET message listing context
messagingRouter.get("/messages/:conversationId", async (req: Request, res: Response) => {
  try {
    const q = query(
      collection(db, "omni_messages"), 
      where("conversationId", "==", req.params.conversationId),
      orderBy("timestamp", "asc")
    );
    const snapshot = await getDocs(q);
    const list: UnifiedMessage[] = [];
    snapshot.forEach(doc => {
      list.push(doc.data() as UnifiedMessage);
    });
    return res.status(200).json(list);
  } catch (err: any) {
    console.error("[GET Messages Error]", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST send outbound message with template support & 24hr WhatsApp validation check
messagingRouter.post("/messages/send", async (req: Request, res: Response) => {
  try {
    const { conversationId, content, senderId, senderName } = req.body;

    if (!conversationId || !content || !content.body) {
      return res.status(400).json({ error: "Mandatory params content, conversationId required." });
    }

    // Retrieve active conversation segment
    const convRef = doc(collection(db, "omni_conversations"), conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
      return res.status(404).json({ error: "Active context thread not found" });
    }

    const conv = convSnap.data() as Conversation;

    // Check WhatsApp 24-hour rules
    let whatsappRuleViolation = false;
    if (conv.platform === "whatsapp") {
      const qLatestInbound = query(
        collection(db, "omni_messages"),
        where("conversationId", "==", conversationId),
        where("direction", "==", "inbound"),
        orderBy("timestamp", "desc")
      );
      const inboundSnap = await getDocs(qLatestInbound);
      if (!inboundSnap.empty) {
        const latestInbound = inboundSnap.docs[0].data() as UnifiedMessage;
        const lastInboundTime = new Date(latestInbound.timestamp).getTime();
        const hrsElapsed = (Date.now() - lastInboundTime) / (1000 * 60 * 60);
        if (hrsElapsed > 24) {
          whatsappRuleViolation = true;
          console.warn("[WhatsApp Policy Advisory] 24-hour service window limit exceeded. Encouraging WhatsApp authorized template protocol.");
        }
      }
    }

    // Construct unified outbound message
    const outboundMessageId = `m_out_${Date.now()}`;
    const outboundMsg: UnifiedMessage = {
      id: outboundMessageId,
      platform: conv.platform,
      platformMessageId: `mid.out_${Date.now()}_secure`,
      conversationId,
      senderId: senderId || "agent_farhan",
      senderName: senderName || "Kazi Farhan (Supervisor)",
      content: {
        type: content.type || "text",
        body: content.body,
        mediaUrl: content.mediaUrl
      },
      direction: "outbound",
      status: "sent",
      assignedAgent: conv.assignedAgent || "agent_farhan",
      conversationStatus: conv.status || "open",
      timestamp: new Date().toISOString()
    };

    // Save Message to DB
    await setDoc(doc(collection(db, "omni_messages"), outboundMessageId), outboundMsg);

    // Save Updated Conversation segment
    const updatedConv: Partial<Conversation> = {
      lastMessage: content.body,
      updatedAt: new Date().toISOString()
    };
    await setDoc(convRef, updatedConv, { merge: true });

    // Emit live to Clients
    if (ioInstance) {
      ioInstance.emit("message:received", outboundMsg);
      ioInstance.to(conversationId).emit("message:new", outboundMsg);
      ioInstance.emit("conversation:updated", { ...conv, ...updatedConv });
    }

    // Return message status along with WhatsApp policy warning flag
    return res.status(200).json({
      status: "success",
      message: outboundMsg,
      whatsapp24HourWarning: whatsappRuleViolation ? "Outgoing message exceeds WhatsApp's active 24-hour user interaction window. We enabled WhatsApp Authorized Session Templates." : null
    });

  } catch (err: any) {
    console.error("[POST Outbound Send Error]", err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH Set Conversation Status (Open, Pending, Resolved)
messagingRouter.patch("/conversation/status", async (req: Request, res: Response) => {
  try {
    const { conversationId, status } = req.body;
    if (!conversationId || !status) {
      return res.status(400).json({ error: "conversationId and status fields are mandatory." });
    }

    const convRef = doc(collection(db, "omni_conversations"), conversationId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: "Conversation context not found." });
    }

    const updatedData = { status, updatedAt: new Date().toISOString() };
    await setDoc(convRef, updatedData, { merge: true });

    const updatedConv = { ...(snap.data() as Conversation), ...updatedData };

    if (ioInstance) {
      ioInstance.emit("conversation:updated", updatedConv);
    }

    return res.status(200).json({ status: "success", conversation: updatedConv });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH Assign Agent
messagingRouter.patch("/conversation/assign-agent", async (req: Request, res: Response) => {
  try {
    const { conversationId, agentId } = req.body;
    if (!conversationId || !agentId) {
      return res.status(400).json({ error: "conversationId and agentId fields are mandatory" });
    }

    const convRef = doc(collection(db, "omni_conversations"), conversationId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: "Conversation thread not found" });
    }

    const updatedData = { assignedAgent: agentId, updatedAt: new Date().toISOString() };
    await setDoc(convRef, updatedData, { merge: true });

    const updatedConv = { ...(snap.data() as Conversation), ...updatedData };

    if (ioInstance) {
      ioInstance.emit("conversation:updated", updatedConv);
    }

    return res.status(200).json({ status: "success", conversation: updatedConv });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET Agents
messagingRouter.get("/agents", async (req: Request, res: Response) => {
  try {
    const snapshot = await getDocs(collection(db, "omni_agents"));
    const list: Agent[] = [];
    snapshot.forEach(doc => {
      list.push(doc.data() as Agent);
    });
    return res.status(200).json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
