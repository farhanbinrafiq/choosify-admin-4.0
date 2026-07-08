import { z } from 'zod';

export const SendMessageBodySchema = z.object({
  conversationId: z.string().trim().min(1, 'conversationId is required'),
  content: z.object({
    body: z.string().trim().min(1, 'content.body is required'),
    type: z.string().trim().optional(),
    mediaUrl: z.string().trim().optional(),
  }),
  senderId: z.string().trim().optional(),
  senderName: z.string().trim().optional(),
  templateName: z.string().trim().optional(),
  templateLanguage: z.string().trim().optional(),
});
