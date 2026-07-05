import type { Agent, Conversation, Customer, UnifiedMessage } from '../../src/types';
import {
  hasConversationData,
  saveAgent,
  saveConversation,
  saveCustomer,
  saveMessage,
} from './omniStore';

export async function seedOmnichannelData() {
  try {
    if (await hasConversationData()) {
      console.log('[Seeding] Omnichannel messages already seeded.');
      return;
    }

    console.log('[Seeding] Omnichannel database seed initiated...');

    const customersList: Customer[] = [
      {
        id: 'cust_wa_01',
        name: 'Sajid Karim',
        phone: '+8801712345678',
        email: 'sajid.karim@gmail.com',
        avatar: 'SK',
        platformIds: { whatsapp: 'wa_user_sajid' },
      },
      {
        id: 'cust_me_02',
        name: 'Israt Jahan',
        phone: '+8801987654321',
        email: 'israt.jahan@yahoo.com',
        avatar: 'IJ',
        platformIds: { messenger: 'fb_user_israt' },
      },
      {
        id: 'cust_ig_03',
        name: 'Nabila Chowdhury',
        phone: '+8801555111222',
        email: 'nabila.insta@gmail.com',
        avatar: 'NC',
        platformIds: { instagram: 'ig_user_nabila' },
      },
      {
        id: 'cust_pt_04',
        name: 'Tanvir Sadek',
        phone: '+8801822334455',
        email: 'tanvir.sadek@choosify.com',
        avatar: 'TS',
        platformIds: { whatsapp: 'wa_user_tanvir' },
      },
    ];

    for (const cust of customersList) {
      await saveCustomer(cust);
    }

    const agentsList: Agent[] = [
      {
        id: 'agent_farhan',
        name: 'Kazi Farhan',
        email: 'kazi@choosify.com.bd',
        role: 'Support Specialst',
        assignedConversations: [],
        status: 'active',
      },
      {
        id: 'agent_nusrat',
        name: 'Nusrat Jahan',
        email: 'nusrat@choosify.com.bd',
        role: 'WhatsApp Team Lead',
        assignedConversations: [],
        status: 'active',
      },
      {
        id: 'agent_zahid',
        name: 'Zahid Hasan',
        email: 'zahid@choosify.com.bd',
        role: 'Social Media Executive',
        assignedConversations: [],
        status: 'active',
      },
    ];

    for (const agent of agentsList) {
      await saveAgent(agent);
    }

    const sampleConversations: Conversation[] = [
      {
        conversationId: 'conv_wa_01',
        platform: 'whatsapp',
        senderName: 'Sajid Karim',
        senderAvatar: 'SK',
        lastMessage: 'Is my traditional Jamdani silk order dispatched yet? Invoice #INV-294.',
        status: 'open',
        assignedAgent: 'agent_farhan',
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        conversationId: 'conv_me_02',
        platform: 'messenger',
        senderName: 'Israt Jahan',
        senderAvatar: 'IJ',
        lastMessage: 'Hello! We love the apparel quality we got from Karika brand. Can we partner?',
        status: 'pending',
        assignedAgent: 'agent_farhan',
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        conversationId: 'conv_ig_03',
        platform: 'instagram',
        senderName: 'Nabila Chowdhury',
        senderAvatar: 'NC',
        lastMessage: 'Awesome reel! Sent you a DM regarding collaboration details on Eid promotions.',
        status: 'open',
        assignedAgent: 'agent_zahid',
        updatedAt: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        conversationId: 'conv_pt_04',
        platform: 'platform',
        senderName: 'Tanvir Sadek',
        senderAvatar: 'TS',
        lastMessage: 'I face a transaction delay on my cashbook sync, shows pending.',
        status: 'resolved',
        assignedAgent: 'agent_farhan',
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    for (const conv of sampleConversations) {
      await saveConversation(conv);
    }

    const messagesSeed: UnifiedMessage[] = [
      {
        id: 'm_wa_1',
        platform: 'whatsapp',
        platformMessageId: 'mid.wa_9841_abc',
        conversationId: 'conv_wa_01',
        senderId: 'wa_user_sajid',
        senderName: 'Sajid Karim',
        content: { type: 'text', body: 'Salam Choosify support. Quick query about my recent purchase.' },
        direction: 'inbound',
        status: 'read',
        assignedAgent: 'agent_farhan',
        conversationStatus: 'open',
        timestamp: new Date(Date.now() - 4800000).toISOString(),
      },
      {
        id: 'm_wa_2',
        platform: 'whatsapp',
        platformMessageId: 'mid.wa_9842_def',
        conversationId: 'conv_wa_01',
        senderId: 'agent_farhan',
        senderName: 'Kazi Farhan',
        content: {
          type: 'text',
          body: 'Walaikum Assalam Sajid! I would love to help. Please share your order or invoice reference.',
        },
        direction: 'outbound',
        status: 'read',
        assignedAgent: 'agent_farhan',
        conversationStatus: 'open',
        timestamp: new Date(Date.now() - 4200000).toISOString(),
      },
      {
        id: 'm_wa_3',
        platform: 'whatsapp',
        platformMessageId: 'mid.wa_9843_ghi',
        conversationId: 'conv_wa_01',
        senderId: 'wa_user_sajid',
        senderName: 'Sajid Karim',
        content: {
          type: 'text',
          body: 'Is my traditional Jamdani silk order dispatched yet? Invoice #INV-294.',
        },
        direction: 'inbound',
        status: 'read',
        assignedAgent: 'agent_farhan',
        conversationStatus: 'open',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'm_me_1',
        platform: 'messenger',
        platformMessageId: 'mid.fb_1',
        conversationId: 'conv_me_02',
        senderId: 'fb_user_israt',
        senderName: 'Israt Jahan',
        content: {
          type: 'text',
          body: 'Hello! We love the apparel quality we got from Karika brand. Can we partner?',
        },
        direction: 'inbound',
        status: 'read',
        assignedAgent: 'agent_farhan',
        conversationStatus: 'pending',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'm_ig_1',
        platform: 'instagram',
        platformMessageId: 'mid.ig_1',
        conversationId: 'conv_ig_03',
        senderId: 'ig_user_nabila',
        senderName: 'Nabila Chowdhury',
        content: {
          type: 'text',
          body: 'Awesome reel! Sent you a DM regarding collaboration details on Eid promotions.',
        },
        direction: 'inbound',
        status: 'delivered',
        assignedAgent: 'agent_zahid',
        conversationStatus: 'open',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        id: 'm_pt_1',
        platform: 'platform',
        platformMessageId: 'mid.pt_1',
        conversationId: 'conv_pt_04',
        senderId: 'wa_user_tanvir',
        senderName: 'Tanvir Sadek',
        content: { type: 'text', body: 'I face a transaction delay on my cashbook sync, shows pending.' },
        direction: 'inbound',
        status: 'read',
        assignedAgent: 'agent_farhan',
        conversationStatus: 'resolved',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    for (const msg of messagesSeed) {
      await saveMessage(msg);
    }

    console.log('[Seeding] Omnichannel database seed completed successfully.');
  } catch (error) {
    console.error('[Seeding Error] Error seeding omnichannel dataset:', error);
  }
}
