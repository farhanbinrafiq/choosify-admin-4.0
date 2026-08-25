import React from 'react';
import { AdminFeatureNotAvailable } from '../../../components/AdminFeatureNotAvailable';

/**
 * Sprint 11 remediation: this screen generated waybills/labels via
 * LogisticsService.generateLabel(), which always fabricates a plain-text
 * "label" regardless of what the (also fake, sandbox-only) courier adapter
 * returns — no real courier account is configured anywhere in this app
 * (all six adapters default to sandbox: true with zero real API keys). A
 * label that looks real but isn't would get printed and put on an actual
 * package, so rather than continue generating fake waybills this screen now
 * states plainly that real label generation isn't available yet.
 */
export default function ShippingLabels() {
  return (
    <AdminFeatureNotAvailable
      title="Shipping Labels & Waybills"
      description="Real courier label/waybill generation isn't available yet — no courier account is actually connected (every carrier integration is sandbox-only with no API keys configured). Generating a label here would produce a fake document, not something you could put on a real package."
    />
  );
}
