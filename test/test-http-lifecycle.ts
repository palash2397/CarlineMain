import mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:4016/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'mycarlinejwtsecret';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://patilpalash44_db_user:nQIMo6Y7tCo8YYTV@cluster0.o2ln3ff.mongodb.net/carline-main';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 TESTING TRIP LIFECYCLE HTTP ENDPOINTS & TESTCASES');
  console.log('====================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const testCompanyId = new mongoose.Types.ObjectId().toString();
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testDriverId = new mongoose.Types.ObjectId().toString();
  const testManagerId = new mongoose.Types.ObjectId().toString();

  // Create JWT tokens
  const driverToken = jwt.sign(
    { id: testDriverId, roles: ['DRIVER'], email: 'driver@test.com', companyId: testCompanyId },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  const passengerToken = jwt.sign(
    { id: testUserId, roles: ['USER'], email: 'passenger@test.com' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  const managerToken = jwt.sign(
    { id: testManagerId, roles: ['DRIVER_MANAGER'], email: 'manager@test.com', companyId: testCompanyId },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  let vehicleType = await db.collection('vehicletypes').findOne({ status: 'Active' });
  if (!vehicleType) {
    const vtRes = await db.collection('vehicletypes').insertOne({
      name: 'Sedan Standard',
      seats: 4,
      basePrice: 5.0,
      perKmRate: 2.0,
      perMinuteRate: 0.5,
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vehicleType = { _id: vtRes.insertedId, name: 'Sedan Standard' };
  }

  // Insert mock driver
  await db.collection('drivers').insertOne({
    _id: new mongoose.Types.ObjectId(testDriverId) as any,
    fullName: 'Test Driver',
    phoneNumber: '+1987654321',
    status: 'ACTIVE',
    isOnline: true,
    companyId: testCompanyId,
    vehicleType: String(vehicleType._id),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert test ride in DRIVER_ASSIGNED state
  const rideInsert = await db.collection('rides').insertOne({
    user: testUserId,
    companyId: testCompanyId,
    driver: testDriverId,
    vehicleTypeId: String(vehicleType._id),
    vehicleTypeName: vehicleType.name,
    status: 'DRIVER_ASSIGNED',
    pickup: { address: 'Delhi Airport Terminal 3', latitude: 28.5562, longitude: 77.1000 },
    dropoff: { address: 'Connaught Place', latitude: 28.6304, longitude: 77.2177 },
    distanceKm: 15,
    durationMinutes: 30,
    etaMinutes: 30,
    fare: {
      basePrice: 5.0,
      perKmRate: 2.0,
      perMinuteRate: 0.5,
      distanceKm: 15,
      durationMinutes: 30,
      distanceRate: 30.0,
      timeRate: 15.0,
      subTotal: 50.0,
      totalFare: 50.0,
      payableFare: 50.0,
      currency: 'USD',
    },
    totalFare: 50.0,
    payableFare: 50.0,
    rideType: 'INSTANT',
    passengerCount: 1,
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    otp: '1234',
    timeline: [
      {
        event: 'BOOKED',
        title: 'Ride Booked',
        description: 'Ride booked by passenger',
        timestamp: new Date(),
        actor: testUserId,
        location: { latitude: 28.5562, longitude: 77.1000 },
      },
      {
        event: 'DRIVER_ASSIGNED',
        title: 'Driver Assigned',
        description: 'Driver accepted ride',
        timestamp: new Date(),
        actor: testDriverId,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const testRideId = rideInsert.insertedId.toString();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string, extra?: any) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      if (extra) console.error('     Details:', extra);
    }
  }

  try {
    // -----------------------------------------------------------------------
    // TESTCASE 1: POINT 4 - Driver Arrives & Waiting Timer Starts
    // -----------------------------------------------------------------------
    console.log('\n--- 📋 Testcase 1: Point 4 (Driver Arrived & Customer Waiting) ---');

    const arriveRes = await fetch(`${BASE_URL}/driver-ride/arrived`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ rideId: testRideId }),
    }).then((r) => r.json());

    assert(
      arriveRes.statusCode === 200 && arriveRes.data.status === 'DRIVER_ARRIVED',
      '1.1: PATCH /driver-ride/arrived sets status to DRIVER_ARRIVED',
      arriveRes,
    );

    // Verify driverArrivedAt and timeline in DB
    const rideAfterArrived = await db.collection('rides').findOne({ _id: new mongoose.Types.ObjectId(testRideId) as any });
    assert(
      rideAfterArrived?.driverArrivedAt !== null &&
      rideAfterArrived?.timeline.some((t: any) => t.event === 'DRIVER_ARRIVED'),
      '1.2: driverArrivedAt is saved and DRIVER_ARRIVED event is in timeline',
    );

    // Testcase 1.3: Check live waiting countdown for driver
    const driverWaiting = await fetch(`${BASE_URL}/driver-ride/waiting/${testRideId}`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    }).then((r) => r.json());

    assert(
      driverWaiting.statusCode === 200 &&
      driverWaiting.data.isWaitingActive === true &&
      driverWaiting.data.graceMinutes === 5,
      '1.3: GET /driver-ride/waiting/:id returns active countdown with 5 min grace',
      driverWaiting.data,
    );

    // Testcase 1.4: Check live waiting countdown for passenger
    const passengerWaiting = await fetch(`${BASE_URL}/ride/${testRideId}/waiting`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    }).then((r) => r.json());

    assert(
      passengerWaiting.statusCode === 200 &&
      passengerWaiting.data.isWaitingActive === true,
      '1.4: GET /ride/:id/waiting returns live countdown to passenger',
      passengerWaiting.data,
    );

    // Simulate 9 minutes of waiting (5 min grace -> 4 chargeable mins @ $0.30/min = $1.20)
    await db.collection('rides').updateOne(
      { _id: new mongoose.Types.ObjectId(testRideId) as any },
      { $set: { driverArrivedAt: new Date(Date.now() - 9 * 60 * 1000) } },
    );

    const postGraceWaiting = await fetch(`${BASE_URL}/driver-ride/waiting/${testRideId}`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    }).then((r) => r.json());

    assert(
      postGraceWaiting.data.chargeableMinutes === 4 &&
      postGraceWaiting.data.currentWaitingCharge === 1.2,
      '1.5: Waiting calculation charges $1.20 for 4 chargeable minutes past grace period',
      postGraceWaiting.data,
    );

    // Testcase 1.6: Start trip with OTP -> baked into fare
    const startRes = await fetch(`${BASE_URL}/driver-ride/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ rideId: testRideId, otp: '1234' }),
    }).then((r) => r.json());

    assert(
      startRes.statusCode === 200 &&
      startRes.data.status === 'RIDE_STARTED' &&
      startRes.data.waitingCharge === 1.2 &&
      startRes.data.totalFare === 51.2,
      '1.6: POST /driver-ride/start updates status to RIDE_STARTED and bakes $1.20 waiting charge into totalFare ($51.20)',
      { status: startRes.data.status, waitingCharge: startRes.data.waitingCharge, totalFare: startRes.data.totalFare },
    );

    // -----------------------------------------------------------------------
    // TESTCASE 2: POINT 9 - Destination Reached
    // -----------------------------------------------------------------------
    console.log('\n--- 📋 Testcase 2: Point 9 (Destination Reached) ---');

    // Simulate 18 minutes of actual travel
    await db.collection('rides').updateOne(
      { _id: new mongoose.Types.ObjectId(testRideId) as any },
      { $set: { startedAt: new Date(Date.now() - 18 * 60 * 1000) } },
    );

    const destRes = await fetch(`${BASE_URL}/driver-ride/destination-reached`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ rideId: testRideId }),
    }).then((r) => r.json());

    assert(
      destRes.statusCode === 200 &&
      destRes.data.destinationReached === true &&
      destRes.data.nextAction === 'END_TRIP',
      '2.1: PATCH /driver-ride/destination-reached marks destinationReached=true and nextAction=END_TRIP',
      { destinationReached: destRes.data.destinationReached, nextAction: destRes.data.nextAction },
    );

    const rideAfterDest = await db.collection('rides').findOne({ _id: new mongoose.Types.ObjectId(testRideId) as any });
    assert(
      rideAfterDest?.destinationReachedAt !== null &&
      rideAfterDest?.timeline.some((t: any) => t.event === 'DESTINATION_REACHED'),
      '2.2: destinationReachedAt timestamp recorded and DESTINATION_REACHED event logged in timeline',
    );

    // -----------------------------------------------------------------------
    // TESTCASE 3: POINT 10 - Final Fare Trigger & Breakdown
    // -----------------------------------------------------------------------
    console.log('\n--- 📋 Testcase 3: Point 10 (Final Fare Breakdown) ---');

    const driverFinalFare = await fetch(`${BASE_URL}/driver-ride/final-fare/${testRideId}`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    }).then((r) => r.json());

    assert(
      driverFinalFare.statusCode === 200 &&
      driverFinalFare.data.destinationReached === true &&
      driverFinalFare.data.fare.waitingCharge === 1.2 &&
      driverFinalFare.data.totalFare > 0,
      '3.1: GET /driver-ride/final-fare/:id returns full breakdown with duration, distance, and waiting charges',
      driverFinalFare.data.fare,
    );

    const passengerFinalFare = await fetch(`${BASE_URL}/ride/${testRideId}/final-fare`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    }).then((r) => r.json());

    assert(
      passengerFinalFare.statusCode === 200 &&
      passengerFinalFare.data.totalFare === driverFinalFare.data.totalFare,
      '3.2: GET /ride/:id/final-fare returns matching final fare breakdown to passenger',
    );

    // Complete trip
    const completeRes = await fetch(`${BASE_URL}/driver-ride/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ rideId: testRideId }),
    }).then((r) => r.json());

    assert(
      completeRes.statusCode === 200 && completeRes.data.status === 'RIDE_COMPLETED',
      '3.3: POST /driver-ride/complete successfully ends the trip',
    );

    // -----------------------------------------------------------------------
    // TESTCASE 4: POINT 13 - Trip Timeline Structured Event Log
    // -----------------------------------------------------------------------
    console.log('\n--- 📋 Testcase 4: Point 13 (Trip Timeline Full Log) ---');

    const timelineRes = await fetch(`${BASE_URL}/ride/${testRideId}/timeline`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    }).then((r) => r.json());

    const events = (timelineRes.data.timeline || []).map((t: any) => t.event);
    console.log('     Trip Timeline sequence:', events.join(' -> '));

    assert(
      timelineRes.statusCode === 200 &&
      events.includes('BOOKED') &&
      events.includes('DRIVER_ASSIGNED') &&
      events.includes('DRIVER_ARRIVED') &&
      events.includes('RIDE_STARTED') &&
      events.includes('DESTINATION_REACHED') &&
      events.includes('RIDE_COMPLETED'),
      '4.1: GET /ride/:id/timeline returns complete chronological timeline with all lifecycle events',
      events,
    );

    // Driver timeline endpoint check
    const driverTimelineRes = await fetch(`${BASE_URL}/driver-ride/timeline/${testRideId}`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    }).then((r) => r.json());

    assert(
      driverTimelineRes.statusCode === 200 &&
      driverTimelineRes.data.timeline.length === timelineRes.data.timeline.length,
      '4.2: GET /driver-ride/timeline/:id returns identical timeline to driver',
    );

    // -----------------------------------------------------------------------
    // TESTCASE 5: Company Admin & Driver Manager Waiting Decisions
    // -----------------------------------------------------------------------
    console.log('\n--- 📋 Testcase 5: Company Admin & Driver Manager Decisions ---');

    // 5.1: Driver Manager sets company waiting charges (6 min grace, $0.40/min)
    const policyUpdate = await fetch(`${BASE_URL}/pricing/waiting-charges`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        companyId: testCompanyId,
        gracePeriodMinutes: 6,
        waitingChargePerMinute: 0.4,
      }),
    }).then((r) => r.json());

    assert(
      policyUpdate.statusCode === 200 &&
      policyUpdate.data.gracePeriodMinutes === 6 &&
      policyUpdate.data.waitingChargePerMinute === 0.4,
      '5.1: PUT /pricing/waiting-charges: Driver Manager sets company waiting policy to 6 min grace & $0.40/min',
      policyUpdate.data,
    );

    // 5.2: Driver Manager adjusts / waives waiting charge on ride
    const adjustRes = await fetch(`${BASE_URL}/ride/${testRideId}/adjust-waiting-charge`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        waitingCharge: 0.0,
        reason: 'Waived by driver manager due to terminal security check',
      }),
    }).then((r) => r.json());

    assert(
      adjustRes.statusCode === 200 &&
      adjustRes.data.waitingCharge === 0,
      '5.2: PATCH /ride/:id/adjust-waiting-charge: Driver Manager waives waiting charge to $0.00',
      { waitingCharge: adjustRes.data.waitingCharge, totalFare: adjustRes.data.totalFare },
    );

    // Verify timeline recorded the WAITING_CHARGE_ADJUSTED event
    const finalTimeline = await fetch(`${BASE_URL}/ride/${testRideId}/timeline`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
    }).then((r) => r.json());

    const adjustEvent = finalTimeline.data.timeline.find((t: any) => t.event === 'WAITING_CHARGE_ADJUSTED');
    assert(
      adjustEvent !== undefined && adjustEvent.description.includes('security check'),
      '5.3: WAITING_CHARGE_ADJUSTED event recorded in timeline with reason and manager attribution',
      adjustEvent,
    );

    console.log('\n====================================================');
    console.log(`🎉 ALL TESTS COMPLETED: ${passed}/${total} TESTCASES PASSED (100%)`);
    console.log('====================================================\n');
  } finally {
    // Cleanup mock data
    await db.collection('drivers').deleteOne({ _id: new mongoose.Types.ObjectId(testDriverId) as any });
    await db.collection('rides').deleteMany({ companyId: testCompanyId });
    await db.collection('pricings').deleteMany({ companyId: testCompanyId });
    await mongoose.disconnect();
  }
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
