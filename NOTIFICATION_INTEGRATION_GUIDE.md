# 📲 Carline - Firebase Push & In-App Notification Integration Guide
> **Audience**: Mobile App Developers (Flutter / React Native / Native iOS & Android) & Web Developers  
> **Modules**: User (Passenger) App & Driver App  
> **Swagger URL**: `http://localhost:4016/api/v1/docs` *(Section: `Notifications (by Prakash)`)*  
> **Firebase Project**: `carline-2ed3c`

---

## 📑 Table of Contents
1. [Firebase Configuration](#1-firebase-configuration)
2. [Notification APIs (Swagger)](#2-notification-apis-swagger)
3. [User (Passenger) Lifecycle Events](#3-user-passenger-lifecycle-events)
4. [Driver Lifecycle Events](#4-driver-lifecycle-events)
5. [In-App Notification Center & Bell Badge](#5-in-app-notification-center--bell-badge)
6. [Real-time Socket.IO Event (Foreground Toast)](#6-real-time-socketio-event-foreground-toast)
7. [Frontend Code Examples](#7-frontend-code-examples)

---

## 1. Firebase Configuration

Dono apps (User aur Driver) ke liye Firebase project `carline-2ed3c` setup hai:

| Platform | Required File / Key | Location in Project |
| :--- | :--- | :--- |
| **Android** | `google-services.json` | `android/app/google-services.json` |
| **iOS** | `GoogleService-Info.plist` | `ios/Runner/GoogleService-Info.plist` |
| **Web** | Web Config + VAPID Key | Firebase Console -> Project Settings -> Cloud Messaging |

> 💡 **Tip**: Firebase Console se `carline-2ed3c` select karke Android ke liye Package Name (e.g. `com.carline.user` ya `com.carline.driver`) aur iOS ke liye Bundle Identifier register karke credentials download karein.

---

## 2. Notification APIs (Swagger)

All endpoints require JWT Bearer Authentication (`Authorization: Bearer <TOKEN>`).

### 2.1 Register / Update Device FCM Token
> **Kab call karna hai**: Login ke turant baad, ya app launch hone par jab Firebase SDK device token generate kare.

- **Method**: `POST`
- **URL**: `/api/v1/notification/fcm-token`
- **Headers**:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "fcmToken": "eY1x...sample_device_fcm_token...9Qz"
  }
  ```
- **Response (`201 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "fcmToken": "eY1x...sample_device_fcm_token...9Qz"
    },
    "message": "FCM token registered successfully",
    "success": true
  }
  ```

---

### 2.2 Get Bell Icon Unread Count
> **Kab call karna hai**: App header / Navbar me Bell icon ke upar red badge count (e.g. 🔴 3) dikhane ke liye.

- **Method**: `GET`
- **URL**: `/api/v1/notification/unread-count`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "count": 3
    },
    "message": "Unread count fetched",
    "success": true
  }
  ```

---

### 2.3 Get In-App Notifications History
> **Kab call karna hai**: Notification center / list screen open karne par (Supports Pagination).

- **Method**: `GET`
- **URL**: `/api/v1/notification/my?page=1&limit=20`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "notifications": [
        {
          "_id": "6acce2c2d3e92d408e53b6f4",
          "title": "Driver Arrived",
          "body": "Driver Arvind has arrived. Share OTP: 2186 to start trip.",
          "type": "DRIVER_ARRIVED",
          "data": {
            "rideId": "6acce08c76baad27250d94c0",
            "otp": "2186"
          },
          "isRead": false,
          "createdAt": "2026-10-12T13:38:10.401Z"
        }
      ],
      "total": 12,
      "page": 1,
      "limit": 20,
      "unreadCount": 3
    },
    "message": "Notifications fetched",
    "success": true
  }
  ```

---

### 2.4 Mark a Single Notification as Read
> **Kab call karna hai**: Jab user kisi notification item par tap kare.

- **Method**: `PATCH`
- **URL**: `/api/v1/notification/:id/read`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "6acce2c2d3e92d408e53b6f4",
      "isRead": true,
      "readAt": "2026-10-12T13:40:00.000Z"
    },
    "message": "Notification marked as read",
    "success": true
  }
  ```

---

### 2.5 Mark All Notifications as Read
> **Kab call karna hai**: Notification screen me "Mark all as read" button click karne par.

- **Method**: `PATCH`
- **URL**: `/api/v1/notification/read-all`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": { "modifiedCount": 3 },
    "message": "All notifications marked as read",
    "success": true
  }
  ```

---

### 2.6 Send Test Push Notification
> **Developer Testing ke liye**: Apne phone par test notification bhej kar verify karne ke liye.

- **Method**: `POST`
- **URL**: `/api/v1/notification/test-push`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
  ```json
  {
    "title": "Test Push",
    "body": "Hello from Carline! Firebase notifications are working.",
    "type": "TEST_PUSH",
    "data": { "customKey": "test123" }
  }
  ```

---

### 2.7 Dispatcher Communication (Send to Driver or Rider)
> **Dispatcher Panel ke liye**: Dispatcher dwara kisi trip ke driver ya passenger ko direct custom push + in-app alert bhejna.

- **Method**: `POST`
- **URL**: `/api/v1/notification/dispatcher/send`
- **Headers**: `Authorization: Bearer <DISPATCHER_OR_ADMIN_JWT_TOKEN>`
- **Body**:
  ```json
  {
    "targetType": "DRIVER",
    "targetId": "6aa8e3a259dc9fc0913ababe",
    "rideId": "6acce08c76baad27250d94c0",
    "title": "Dispatcher Alert",
    "body": "Please report to terminal 2 for pickup immediately.",
    "data": { "priority": "urgent" }
  }
  ```
- **Response (`201 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "targetId": "6aa8e3a259dc9fc0913ababe",
      "targetType": "DRIVER",
      "rideId": "6acce08c76baad27250d94c0"
    },
    "message": "Dispatcher notification sent successfully",
    "success": true
  }
  ```

---

### 2.8 Broadcast Communication (All Drivers / All Users)
> **Admin / Dispatcher Panel ke liye**: Saare drivers ya saare passengers ko ek click me bulk push announcement bhejna.

- **Method**: `POST`
- **URL**: `/api/v1/notification/broadcast`
- **Headers**: `Authorization: Bearer <ADMIN_OR_DISPATCHER_JWT_TOKEN>`
- **Body**:
  ```json
  {
    "target": "DRIVERS",
    "title": "Weekend 25% Surge Incentive!",
    "body": "Complete 5 rides this Saturday and earn 25% extra bonus.",
    "companyId": "6aa904a815f2afcc842ee858",
    "data": { "promoCode": "WEEKEND25" }
  }
  ```
- **Response (`201 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "broadcastId": "6ace14d32354d792f72775a2",
      "target": "DRIVERS",
      "totalRecipients": 8,
      "fcmTokensReached": 2,
      "successCount": 2,
      "failureCount": 0
    },
    "message": "Broadcast notification dispatched successfully",
    "success": true
  }
  ```

---

### 2.9 Broadcast History
> **Admin / Dispatcher Panel ke liye**: Purani bheji hui announcements ki list dekhna.

- **Method**: `GET`
- **URL**: `/api/v1/notification/broadcasts?page=1&limit=20`
- **Headers**: `Authorization: Bearer <ADMIN_OR_DISPATCHER_JWT_TOKEN>`

---

## 3. User (Passenger) Lifecycle Events

Backend in sabhi events par User ke phone par Push Notification + In-App notification automatically send karta hai:

| Event | `type` in Payload | Title | Body Example | Data Payload (`notification.data`) |
| :--- | :--- | :--- | :--- | :--- |
| **Ride Booked** | `RIDE_CREATED` | Booking Confirmed | *"Your ride booking is confirmed! Searching for nearby drivers..."* | `{ "rideId": "...", "type": "RIDE_CREATED" }` |
| **Scheduled Ride Booked** | `RIDE_SCHEDULED` | Ride Scheduled | *"Your ride is scheduled for Oct 25, 2026, 10:30 AM. We will find a driver before your pickup."* | `{ "rideId": "...", "type": "RIDE_SCHEDULED" }` |
| **Scheduled Ride Due** | `RIDE_CREATED` | Scheduled Ride Active | *"Your scheduled ride is starting now! Searching for nearby drivers..."* | `{ "rideId": "...", "type": "RIDE_CREATED" }` |
| **Driver Assigned** | `DRIVER_ASSIGNED` | Driver Assigned | *"Driver John Doe has accepted your ride request and is on the way."* | `{ "rideId": "...", "driverId": "...", "type": "DRIVER_ASSIGNED" }` |
| **Driver Arrived** | `DRIVER_ARRIVED` | Driver Arrived | *"Your driver has arrived at the pickup location. Share OTP 4921 to start your ride."* | `{ "rideId": "...", "otp": "4921", "type": "DRIVER_ARRIVED" }` |
| **Trip Started** | `TRIP_STARTED` | Trip Started | *"Your trip to Airport Terminal 2 has started. Have a safe journey!"* | `{ "rideId": "...", "type": "TRIP_STARTED" }` |
| **Destination Reached**| `DESTINATION_REACHED` | Destination Reached | *"You have arrived at your destination."* | `{ "rideId": "...", "type": "DESTINATION_REACHED" }` |
| **Trip Completed** | `TRIP_COMPLETED` | Trip Completed | *"Trip completed! Total fare is $25.50. Thank you for riding with Carline."* *(+ HTML Invoice Receipt Email sent to passenger)* | `{ "rideId": "...", "payableFare": "25.50", "type": "TRIP_COMPLETED" }` |
| **Payment Received** | `PAYMENT_COMPLETED` | Payment Received | *"Payment of $25.50 received via CASH. Thank you for riding with Carline!"* | `{ "rideId": "...", "payableFare": "25.50", "paymentMethod": "CASH", "type": "PAYMENT_COMPLETED" }` |
| **Ride Cancelled** | `RIDE_CANCELLED` | Ride Cancelled | *"Your driver cancelled the ride. Reason: Flat tire"* OR *"You have cancelled your ride."* OR *"No driver accepted the request within the time limit"* | `{ "rideId": "...", "type": "RIDE_CANCELLED" }` |
| **Ride Details Updated** | `RIDE_UPDATED` | Ride Details Updated | *"Your ride details have been updated successfully."* | `{ "rideId": "...", "type": "RIDE_UPDATED" }` |
| **Waiting Charge Adjusted** | `FARE_ADJUSTED` | Waiting Charge Adjusted | *"Waiting charges updated to $5.00. Total payable fare: $30.50."* | `{ "rideId": "...", "waitingCharge": "5.00", "payableFare": "30.50", "type": "FARE_ADJUSTED" }` |
| **Chat Message** | `CHAT_MESSAGE` | Driver (John Doe) | *"I am waiting near the red building entrance."* | `{ "rideId": "...", "senderRole": "DRIVER", "senderName": "John Doe", "type": "CHAT_MESSAGE" }` |

---

## 4. Driver Lifecycle Events

Driver App ke liye automatic Push Notifications & In-App Alerts:

| Event | `type` in Payload | Title | Body Example | Action in App |
| :--- | :--- | :--- | :--- | :--- |
| **New Ride Request** | `RIDE_REQUEST` | New Ride Request | *"New ride request nearby. Pickup: 123 Main St. Fare: $25.50"* | Ring bell / show incoming ride popup with 30s countdown timer |
| **Trip Assigned (Dispatcher)**| `DRIVER_ASSIGNED` | New Trip Assigned | *"A trip #354d has been assigned to you by dispatcher. Pickup: 123 Main St."* | Open trip details screen |
| **Ride Accepted Confirmation**| `RIDE_ACCEPTED` | Ride Accepted | *"You have accepted ride #354d. Head to pickup: 123 Main St."* | Navigate to pickup on map |
| **Driver Arrived Confirmation**| `DRIVER_ARRIVED` | Arrived at Pickup | *"You have arrived at pickup. Please ask the passenger for the 4-digit OTP to start the trip."* | Show OTP input dialog |
| **Trip Started Confirmation**| `TRIP_STARTED` | Trip Started 🚗 | *"Trip to Airport Terminal 2 has started. Drive safely!"* | Turn-by-turn navigation to dropoff |
| **Destination Reached** | `DESTINATION_REACHED`| Destination Reached | *"You have arrived at the destination. Proceed to complete the trip."* | Show End Trip / Complete button |
| **Trip Completed & Earnings** | `TRIP_COMPLETED` | Trip Completed 🎉 | *"Trip #354d completed. Total fare is $25.50. Earnings: $20.40."* | Show fare summary & cash to collect (if cash trip) |
| **Payment Confirmed** | `PAYMENT_COMPLETED` | Payment Confirmed | *"Payment of $25.50 recorded successfully via CASH."* | Return driver to active duty radar |
| **Ride Cancelled** | `RIDE_CANCELLED` | Ride Cancelled | *"Passenger has cancelled the ride. Reason: Change of plans"* OR *"You have cancelled ride #354d."* | Clear trip & restore Active duty status |
| **Ride Details Updated** | `RIDE_UPDATED` | Ride Details Updated | *"Trip #354d details have been updated."* | Refresh ride details & route |
| **Chat Message** | `CHAT_MESSAGE` | Passenger (Alice) | *"I am wearing a yellow jacket near gate 1."* | Open in-ride chat conversation |

---

## 5. In-App Notification Center & Bell Badge

Notification Center banane ke liye standard flow:
1. Header me `GET /api/v1/notification/unread-count` call karein.
2. Agar `count > 0` hai toh Bell icon par red badge dikhayein.
3. Bell icon click karne par `GET /api/v1/notification/my?page=1&limit=20` se notifications display karein.
4. Item tap karne par:
   - `PATCH /api/v1/notification/:id/read` call karein.
   - `payload.data.type` ke hisaab se relevant screen (Trip Tracking, Rating, ya Chat) par navigate karein.

---

## 6. Real-time Socket.IO Event (Foreground Toast)

Jab user app ke andar ho (foreground me active), toh notification bar ke alawa **In-App Toast Popup** dikhane ke liye Socket event listen karein:

- **Socket Server URL**: `http://localhost:4016`
- **Event Name**: `notification:new`
- **Listener Payload**:
  ```json
  {
    "title": "Driver Arrived",
    "body": "Driver has arrived at pickup. OTP: 2186",
    "type": "DRIVER_ARRIVED",
    "data": {
      "rideId": "6acce08c76baad27250d94c0",
      "otp": "2186"
    }
  }
  ```

---

## 7. Frontend Code Examples

### A. Flutter (Dart) Example
```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class NotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  Future<void> initFCM(String userJwtToken) async {
    // 1. Request Permission
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      // 2. Get Device Token
      String? token = await _fcm.getToken();
      if (token != null) {
        print("Device FCM Token: $token");
        // 3. Send to Backend
        await registerFcmToken(token, userJwtToken);
      }

      // 4. Listen for Token Refresh
      _fcm.onTokenRefresh.listen((newToken) {
        registerFcmToken(newToken, userJwtToken);
      });
    }

    // 5. Foreground Notification Listener
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print("Foreground notification: ${message.notification?.title}");
      // Show local toast / snackbar
    });
  }

  Future<void> registerFcmToken(String fcmToken, String jwtToken) async {
    final response = await http.post(
      Uri.parse('http://localhost:4016/api/v1/notification/fcm-token'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $jwtToken',
      },
      body: jsonEncode({'fcmToken': fcmToken}),
    );
    print("Token registered response: ${response.statusCode}");
  }
}
```

---

### B. React Native / Web Example (JavaScript / TypeScript)
```javascript
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

export async function setupNotifications(userJwtToken) {
  const messaging = getMessaging();

  // 1. Request permission & token
  const fcmToken = await getToken(messaging, {
    vapidKey: 'YOUR_VAPID_KEY_HERE',
  });

  if (fcmToken) {
    // 2. Register with backend
    await fetch('http://localhost:4016/api/v1/notification/fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userJwtToken}`,
      },
      body: JSON.stringify({ fcmToken }),
    });
  }

  // 3. Foreground message listener
  onMessage(messaging, (payload) => {
    console.log('New notification arrived:', payload);
    // Show Toast banner
  });
}
```
