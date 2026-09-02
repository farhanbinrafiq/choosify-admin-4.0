/**
 * Deterministic builder for the "Request Order Details" Meta Inbox macro.
 *
 * The questionnaire is generated from canonical product/service requirements
 * — never a hardcoded Size/Color list. Base customer fields are constant;
 * the product-specific block comes from the selected listing's real option
 * groups (a shirt asks Size + Color; a phone asks Storage + Color; a service
 * asks Date + Time + Package).
 *
 * Because Choosify controls the question format, customers are nudged to
 * reply in a labelled shape the extractor can parse deterministically.
 */

export interface MacroProductContext {
  title?: string;
  isService?: boolean;
  /** Canonical option-group names for a product, e.g. ['Size','Color'] / ['Storage','Color']. */
  optionGroupNames?: string[];
  /** Canonical booking-field labels for a service, e.g. ['Date','Time','Package']. */
  serviceFieldLabels?: string[];
}

export const MACRO_PRESETS = [
  { id: 'request_order_details', label: 'Request Order Details' },
  { id: 'ask_address', label: 'Ask for Delivery Address' },
  { id: 'ask_email_phone', label: 'Ask for Email & Phone' },
  { id: 'order_review_link', label: 'Order Created / Review Link' },
] as const;
export type MacroPresetId = (typeof MACRO_PRESETS)[number]['id'];

const BASE_FIELDS = ['Full Name', 'Email', 'Phone', 'Delivery Address', 'Quantity'];

export function buildRequestOrderDetailsMessage(ctx?: MacroProductContext): string {
  const productFields = ctx?.isService
    ? ctx?.serviceFieldLabels?.length
      ? ctx.serviceFieldLabels
      : ['Preferred Date', 'Preferred Time']
    : ctx?.optionGroupNames?.length
      ? ctx.optionGroupNames
      : [];

  const lines = [...BASE_FIELDS, ...productFields].map((f) => `${f}:`);
  const intro = ctx?.title
    ? `To place your order for ${ctx.title}, please reply with:`
    : 'To place your order, please reply with these details in one message:';

  return `${intro}\n\n${lines.join('\n')}\n\nYou can copy the list above and fill each line.`;
}

export function buildMacroMessage(id: MacroPresetId, ctx?: MacroProductContext): string {
  switch (id) {
    case 'ask_address':
      return 'Please share your full delivery address (house/road, area, city, and any landmark).';
    case 'ask_email_phone':
      return 'Please reply with:\n\nEmail:\nPhone:';
    case 'order_review_link':
      return 'Your Choosify order has been prepared. Review and confirm it here:';
    case 'request_order_details':
    default:
      return buildRequestOrderDetailsMessage(ctx);
  }
}
