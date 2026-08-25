import React from 'react';
import { AdminFeatureNotAvailable } from '../../../components/AdminFeatureNotAvailable';

/**
 * Sprint 11 remediation: this screen was carrier API-key configuration,
 * warehouse management, shipping-rule automation, and a webhook simulator,
 * all backed by LogisticsService/LogisticsContext — a Firestore-with-
 * localStorage-fallback layer with zero real courier credentials configured
 * anywhere (every adapter defaults to sandbox: true). There is also no real
 * backend at all for warehouses or shipping rules (grepped server/ — no
 * matching routes exist), so "Configure API" here would only ever save a
 * fake key to the browser's own localStorage/Firestore doc, never to an
 * actual courier account. Rather than half-wire a config screen with
 * nothing real behind it, it now states plainly that it isn't available.
 * (Real shipment status/tracking, driven by real courier webhooks, is
 * covered by the Shipment Console and Tracking Center screens instead.)
 */
export default function CourierProviders() {
  return (
    <AdminFeatureNotAvailable
      title="Courier Integrations & Logistics Setup"
      description="Carrier API key configuration, warehouse management, and shipping-rule automation aren't available yet — no courier account is actually connected (every carrier integration is sandbox-only with no real API keys), and there's no backend yet for warehouses or routing rules. Real shipment status and tracking history from courier webhooks are already live in the Shipment Console and Tracking Center."
    />
  );
}
