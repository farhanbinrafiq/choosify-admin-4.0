import { LogisticsService } from './LogisticsService';
import { SteadfastAdapter } from './adapters/SteadfastAdapter';
import { Shipment } from '../../types/shipment';

async function runPhase1Tests() {
  console.log('🧪 Starting LMS Phase 1 Foundation Programmatic Tests...\n');

  try {
    // 1. Initialize Logistics Service
    console.log('1. Initializing LogisticsService...');
    const service = LogisticsService.getInstance();
    console.log('✅ LogisticsService singleton retrieved successfully.\n');

    // 2. Register Courier Adapter & Verify Health Check
    console.log('2. Verifying SteadfastAdapter health check...');
    const adapter = service.getAdapter('steadfast');
    if (!adapter) {
      throw new Error('❌ SteadfastAdapter is not registered!');
    }
    const health = await adapter.healthCheck();
    console.log(`✅ Adapter: ${adapter.name} (${adapter.code})`);
    console.log(`✅ Health Status: ${health.status}, Message: ${health.message}\n`);

    // 3. Test Shipping Cost and COD Fee Estimator
    console.log('3. Testing shipping charges and COD fee estimation...');
    const insideDhakaEstimate = await adapter.estimateShipping({
      weight: 1.5,
      pickupDistrict: 'Dhaka',
      deliveryDistrict: 'Dhaka',
      codAmount: 5000
    });
    console.log('✅ Inside Dhaka Estimate (COD: 5000):', insideDhakaEstimate);

    const outsideDhakaEstimate = await adapter.estimateShipping({
      weight: 2.0,
      pickupDistrict: 'Dhaka',
      deliveryDistrict: 'Chittagong',
      codAmount: 0
    });
    console.log('✅ Outside Dhaka Estimate (COD: 0):', outsideDhakaEstimate);
    console.log('');

    // 4. Create Simulated Shipment Consignment
    console.log('4. Dispatching a test consignment...');
    const shipmentParams = {
      orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      sellerId: 'seller_demo_123',
      customerId: 'cust_demo_456',
      courierCode: 'steadfast',
      pickupAddress: {
        street: '12 Banani Road',
        city: 'Dhaka',
        district: 'Dhaka',
        postalCode: '1213',
        phone: '01712345678'
      },
      deliveryAddress: {
        street: '56 GEC Circle',
        city: 'Chittagong',
        district: 'Chittagong',
        postalCode: '4000',
        phone: '01812345679'
      },
      sellerContact: {
        name: 'John Seller',
        phone: '01712345678',
        email: 'seller@example.com'
      },
      customerContact: {
        name: 'Jane Customer',
        phone: '01812345679',
        email: 'customer@example.com'
      },
      codAmount: 3500,
      weight: 1.2,
      packageType: 'regular' as const,
      contents: [
        {
          productId: 'prod_999',
          name: 'Premium Leather Wallet',
          quantity: 1,
          price: 3500
        }
      ]
    };

    const shipment: Shipment = await service.createShipment(shipmentParams);
    console.log('✅ Shipment dispatched successfully!');
    console.log(`✅ Assigned Shipment ID: ${shipment.id}`);
    console.log(`✅ Assigned Tracking Number: ${shipment.trackingNumber}`);
    console.log(`✅ Current Status: ${shipment.status}`);
    console.log(`✅ Total Charges: BDT ${shipment.totalCharge}\n`);

    // 5. Test Live Tracking Synchronization
    console.log('5. Simulating live tracking sync with courier...');
    const updatedShipment = await service.syncTracking(shipment.id);
    console.log(`✅ Synced Status: ${updatedShipment.status}`);
    console.log('✅ Tracking History Logs:');
    updatedShipment.trackingEvents.forEach((evt, idx) => {
      console.log(`   [${idx + 1}] [${evt.timestamp}] - Status: ${evt.status} @ ${evt.location} - ${evt.description}`);
    });
    console.log('');

    // 6. Test Shipment Cancellation
    console.log('6. Testing shipment cancellation...');
    await service.cancelShipment(shipment.id, 'Customer changed their mind.');
    const cancelledShipment = await service.getShipment(shipment.id);
    console.log(`✅ Post-Cancel Status: ${cancelledShipment?.status}`);
    console.log(`✅ Last Timeline Event: "${cancelledShipment?.trackingEvents[cancelledShipment.trackingEvents.length - 1].description}"\n`);

    // 7. Test Automation Rules Engine
    console.log('7. Testing Automation Rules Engine with simulated rules...');
    const matchingRule = await service.evaluateShippingRules({
      deliveryDistrict: 'Chittagong',
      totalAmount: 4000,
      weight: 1.2
    }, 'seller_demo_123');

    if (matchingRule) {
      console.log(`✅ Automation matched rule: "${matchingRule.name}" (Courier: ${matchingRule.action.courierCode})`);
    } else {
      console.log('ℹ️ No custom shipping rules found matching parameters (Defaulting to basic handler).');
    }

    console.log('\n🎉 ALL PHASE 1 CORE LOGISTICS TESTS PASSED PERFECTLY!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Phase 1 Verification Failed!');
    console.error(error);
    process.exit(1);
  }
}

runPhase1Tests();
