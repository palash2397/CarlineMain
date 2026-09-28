export const Msg = {
  // General
  SERVER_ERROR: `Internal server error`,
  SUCCESS: `Success`,
  VALIDATION_ERROR: `Validation failed`,
  BAD_REQUEST: `Bad request`,
  INVALID_INPUT: `Input not understood`,

  // User
  USER_REGISTER: `User registered successfully`,
  USER_LOGIN: `User logged in successfully`,
  USER_LOGGED_OUT: `User logged out successfully`,
  USER_EXISTS: `User already exists`,
  USER_EXISTS_EMAIL: `User already exists with this email`,
  USER_EXISTS_PHONE: `User already exists with this phone number`,
  USER_ALREADY_VERIFIED: `User Already verified`,
  USER_NOT_VERIFIED: `User not verified`,
  USER_NOT_FOUND: `User not found`,
  ACCOUNT_DEACTIVATED: `Account has been temporarily deactivated`,
  ACCOUNT_VERIFIED: `User account verified successfully.`,
  USER_FETCHED: `User fetched successfully`,
  USERS_FETCHED: `Users fetched successfully`,
  USER_DELETED: `User deleted successfully`,
  USER_UPDATED: `User updated successfully`,
  USER_ADDED: `User added successfully`,
  USER_INACTIVE: `User account is temporarily inactive`,
  TEAM_MEMBER_CREATED: `Team member added successfully`,
  TEAM_MEMBER_UPDATED: `Team member updated successfully`,
  TEAM_MEMBER_DELETED: `Team member removed successfully`,
  TEAM_MEMBER_STATUS_UPDATED: `Team member status updated successfully`,
  TEAM_MEMBER_NOT_FOUND: `Team member not found`,
  TEAM_MEMBERS_FETCHED: `Team members fetched successfully`,
  CREDENTIALS_RESENT: `Temporary credentials resent successfully`,
  COMPANY_USER_CREATED: `Company user added successfully`,
  COMPANY_USER_UPDATED: `Company user updated successfully`,
  COMPANY_USER_DELETED: `Company user deleted successfully`,
  COMPANY_USER_STATUS_UPDATED: `Company user status updated successfully`,
  COMPANY_USER_NOT_FOUND: `Company user not found`,
  COMPANY_USERS_FETCHED: `Company users fetched successfully`,
  COMPANY_CONTEXT_REQUIRED: `Company context is required`,
  INVALID_EMAIL_ADDRESS: `User does not have a valid email address`,

  // Authentication
  INVALID_CREDENTIALS: `Invalid Credentials`,
  LOGIN_SUCCESS: `Login successful`,
  LOGOUT_SUCCESS: `Logout successful`,
  UNAUTHORIZED: `Unauthorized access`,
  FORBIDDEN: `Access forbidden`,
  TOKEN_EXPIRED: `Token has expired`,
  TOKEN_INVALID: `Invalid token`,
  PASSWORD_CHANGED: `Password changed successfully`,
  PASSWORD_INCORRECT: `Incorrect password`,
  PASSWORD_OLD_INCORRECT: `Incorrect old password`,
  ENTERED_OLD_PASSWORD: `You have entered your old password. Please enter a new password`,

  // Data
  DATA_FETCHED: `Data fetched successfully`,
  DATA_GENERATED: `Data generated successfully`,
  DATA_NOT_FOUND: `No data found`,
  DATA_UPDATED: `Data updated successfully`,
  DATA_DELETED: `Data deleted successfully`,
  DATA_ADDED: `Data added successfully`,
  DATA_REQUIRED: `Data is required`,
  DATA_ALREADY_EXISTS: `Data  already exists`,
  DATA_IS_CLOSED: `Data is closed`,

  // Id
  ID_REQUIRED: `Id is required`,

  // file
  PDF_REQUIRED: `PDF file is required`,
  CSV_REQUIRED: `CSV file is required`,
  EXCEL_REQUIRED: `Excel file is required`,
  IMAGE_REQUIRED: `Image file is required`,
  FILE_REQUIRED: `File is required`,

  // Profile
  USERNAME_EXISTS: `Username already exists`,

  // OTP
  OTP_SENT: `The OTP has been successfully sent to your phone number. Please check your inbox.`,
  OTP_VERIFIED: `OTP verified successfully`,
  OTP_NOT_VERIFIED: `OTP not verified. Please verify OTP.`,
  OTP_EXPIRED: `OTP has expired`,
  OTP_INVALID: `Invalid or expired OTP`,
  OTP_RESENT: `OTP resent successfully`,
  OTP_LIMIT_EXCEEDED: `OTP request limit exceeded, please try again later`,
  OTP_NOT_FOUND: `OTP not found. Please request a new OTP.`,

  // Address
  ADDRESS_CREATED: 'Address created successfully',
  ADDRESS_FETCHED: 'Addresses fetched successfully',
  ADDRESS_UPDATED: 'Address updated successfully',
  ADDRESS_DELETED: 'Address deleted successfully',
  ADDRESS_NOT_FOUND: 'Address not found',
  ADDRESS_ALREADY_EXISTS: 'You already have a saved address with this label',

  // Faq
  FAQ_CREATED: 'FAQ created successfully',
  FAQ_FETCHED: 'FAQs fetched successfully',
  FAQ_UPDATED: 'FAQ updated successfully',
  FAQ_DELETED: 'FAQ deleted successfully',
  FAQ_NOT_FOUND: 'FAQ not found',

  // Support
  SUPPORT_CREATED: 'Support request submitted successfully',
  SUPPORT_FETCHED: 'Support requests fetched successfully',
  SUPPORT_UPDATED: 'Support request updated successfully',
  SUPPORT_NOT_FOUND: 'Support request not found',

  // Driver
  DRIVER_CREATED: 'Driver registered successfully',
  DRIVER_APPLICATION_SUBMITTED:
    'Driver application submitted successfully. It is pending company approval.',
  DRIVER_APPROVED:
    'Driver approved successfully and temporary credentials sent to email',
  DRIVER_PENDING_APPROVAL:
    'Your driver application is currently pending approval by the company.',
  DRIVER_APPLICATION_REJECTED:
    'Your driver application has been rejected by the company.',
  DRIVER_EXISTS_LICENSE: 'Driver already exists with this license number',
  DRIVER_UPDATED: 'Driver details updated successfully',
  DRIVER_FETCHED: 'Driver details fetched successfully',
  DRIVER_STATUS_UPDATED: 'Driver status updated successfully',
  DRIVER_NOT_ONLINE: 'Driver is not online',
  DRIVER_NOT_AVAILABLE: 'Driver is not available',
  DRIVER_NOT_FOUND: 'Driver not found',
  DRIVER_NOT_ASSIGNED: 'Driver not assigned',
  DRIVERS_FETCHED: 'Drivers fetched successfully',
  DRIVER_UNRECOGNIZED: 'Unrecognized driver',
  DRIVER_BATCH_UPDATED: 'Driver batch updated successfully',
  DRIVER_BATCHES_UPDATED: 'Driver batches updated successfully',
  DRIVER_DELETED: 'Driver deleted successfully',
  DRIVER_EARNINGS_HISTORY_FETCHED:
    'Driver earnings history fetched successfully',
  DRIVER_SETTLEMENT_PROCESSED: 'Driver settlement processed successfully',

  // Route
  ROUTE_NOT_FOUND: 'Route not found',
  ROUTE_COORDINATES_MISSING:
    'Pickup and dropoff coordinates are required to calculate the fare',
  ROUTE_DISTANCE_UNAVAILABLE:
    'Unable to calculate the trip distance right now. Please try again',
  ROUTE_CREATED: 'Route created successfully',
  ROUTE_UPDATED: 'Route updated successfully',
  ROUTE_DELETED: 'Route deleted successfully',

  // Fare
  FARE_ESTIMATED: 'Fare estimated successfully',
  FARE_NOT_FOUND: 'Fare not found',

  // Location
  LOCATION_UPDATED: 'Location updated successfully',
  LOCATION_FETCHED: 'Location fetched successfully',
  LOCATION_NOT_FOUND: 'Location not found',
  LOCATION_DELETED: 'Location deleted successfully',
  LOCATION_CREATED: 'Location created successfully',

  // Chat
  CHAT_JOINED: 'Chat joined successfully',
  CHAT_NOT_FOUND: 'Chat not found',
  CHAT_NOT_AUTHORIZED: 'You are not authorized to join this chat',
  CHAT_ALREADY_JOINED: 'You are already a member of this chat',
  CHAT_IS_NOT_AVAILABLE: 'Chat is not available for this ride.',
  CHAT_FETCHED: 'Chat fetched successfully',

  //Message
  MESSAGE_SENT: 'Message sent successfully',
  MESSAGE_NOT_SENT: 'Message not sent',
  MESSAGE_FETCHED: 'Message fetched successfully',
  MESSAGE_NOT_FOUND: 'Message not found',

  //Rating
  RATING_SUBMITTED: 'Rating submitted successfully',
  RATING_NOT_SUBMITTED: 'Rating not submitted',
  RATING_ALREADY_SUBMITTED: 'Rating already submitted',
  RATING_FETCHED: 'Rating fetched successfully',
  RATING_NOT_FOUND: 'Rating not found',
  REVIEWS_FETCHED: 'Reviews fetched successfully',

  //Counter fare
  FARE_COUNTER_SENT: 'Fare counter sent successfully',
  FARE_COUNTER_RECEIVED: 'Fare counter received successfully',
  COUNTER_FARE_REJECTED: `Counter fare rejected successfully`,
  FARE_COUNTER_NOT_FOUND: 'Fare counter not found',
  WAIT_FOR_DRIVER_RESPONSE: 'Wait for driver response',
  WAIT_FOR_USER_RESPONSE: 'Wait for user response',
  NEGOTIATION_LIMIT_REACHED: 'Negotiation limit reached',

  // SuperAdmin
  DRIVER_VERIFIED: 'Driver verified successfully',
  DRIVER_REJECTED: 'Driver rejected successfully',

  // Ride
  RIDE_NOT_FOUND: 'Ride not found',
  RIDE_ACCEPTED: 'Ride accepted successfully',
  RIDE_STARTED: 'Ride started successfully',
  RIDE_COMPLETED: 'Ride completed successfully',
  RIDE_CANCELLED: 'Ride cancelled successfully',
  RIDE_ASSIGNED: 'Ride assigned successfully',
  RIDE_NOT_ACCEPTED: 'Ride not accepted successfully',
  RIDE_ASSIGNED_TO_YOU: 'Ride assigned successfully to you',
  RIDE_ALREADY_ASSIGNED: 'Ride already assigned successfully',
  RIDE_BOOKED: 'Ride booked successfully',
  RIDE_ALREADY_ACTIVE: 'You already have an active ride',

  // Payment
  PAYMENT_PROCESSED: 'Card payment processed successfully',
  PAYMENT_DECLINED: 'Payment declined by gateway',
  PAYMENT_FAILED: 'Payment gateway error',
  PAYMENT_REFUNDED: 'Refund processed successfully',
  VAULT_CHARGED: 'Ride charged successfully via customer account',
  CARD_SAVED: 'Card saved successfully',
  DRIVER_CARD_PROCESSED: 'Driver card details processed successfully',

  // Fare Override
  FARE_OVERRIDE_SUCCESS: 'Fare overridden successfully',
  FARE_OVERRIDE_INVALID: 'Invalid override amount',
  FARE_OVERRIDE_NOT_ALLOWED: 'Trip is not awaiting payment',
  NO_ACTIVE_TRIP: 'No active trip found',
  PAYMENT_ALREADY_COMPLETED: 'Trip payment is already completed',

  // Customer
  CUSTOMER_CREATED: 'Customer created successfully',
  CUSTOMER_NOT_FOUND: 'Customer not found',
  CUSTOMER_UPDATED: 'Customer updated successfully',
  CUSTOMER_DELETED: 'Customer deleted successfully',
  CUSTOMER_FETCHED: 'Customer fetched successfully',
  CUSTOMERS_FETCHED: 'Customers fetched successfully',
  CUSTOMER_ALREADY_EXISTS: 'Customer already exists',

  // Company
  COMPANY_CREATED: 'Company registered successfully',
  COMPANY_FETCHED: 'Company details fetched successfully',
  COMPANIES_FETCHED: 'Companies fetched successfully',
  COMPANY_UPDATED: 'Company updated successfully',
  COMPANY_STATUS_UPDATED: 'Company status updated successfully',
  COMPANY_NOT_FOUND: 'Company not found',
  COMPANY_ALREADY_EXISTS: 'Company with this code or legal name already exists',
  COMPANY_PRIMARY_CONTACT_EMAIL_EXISTS:
    'A company with this primary contact email already exists',
  AN_ACCOUNT_WITH_THIS_EMAIL_ADDRESS_ALREADY_EXISTS_IN_THE_SYSTEM:
    'An account with this email address already exists in the system',

  // Term and Conditions
  TERMS_ACCEPTED: 'Terms and conditions accepted successfully',

  // Pricing Engine
  PRICING_FETCHED: 'Pricing configuration fetched successfully',
  PRICING_UPDATED: 'Pricing configuration updated successfully',
  PRICING_NOT_CONFIGURED: 'Pricing not configured yet',
  FARE_RULES_UPDATED: 'Fare rules updated successfully',
  ZONE_RULE_CREATED: 'Zone pricing rule created successfully',
  ZONE_RULE_UPDATED: 'Zone pricing rule updated successfully',
  ZONE_RULE_DELETED: 'Zone pricing rule deleted successfully',
  ZONE_RULE_NOT_FOUND: 'Zone pricing rule not found',
  WAITING_CHARGES_UPDATED: 'Waiting charges updated successfully',

  // Vehicle Type
  VEHICLE_TYPE_CREATED: 'Vehicle type created successfully',
  VEHICLE_TYPE_UPDATED: 'Vehicle type updated successfully',
  VEHICLE_TYPE_DELETED: 'Vehicle type deleted successfully',
  VEHICLE_TYPE_NOT_FOUND: 'Vehicle type not found',
  VEHICLE_TYPE_STATUS_UPDATED: 'Vehicle type status updated successfully',
  VEHICLE_TYPES_FETCHED: 'Vehicle types fetched successfully',
  VEHICLE_TYPE_ALREADY_EXISTS: 'Vehicle type with this name already exists',

  // User Booking
  RIDE_FETCHED: 'Ride details fetched successfully',
  RIDES_FETCHED: 'Rides fetched successfully',
  RIDE_CANNOT_CANCEL: 'This ride can no longer be cancelled',
  SCHEDULE_TIME_REQUIRED: 'Pickup date and time is required for a scheduled ride',
  SCHEDULE_TIME_INVALID: 'Pickup date and time must be in the future',
  NEARBY_CABS_FETCHED: 'Nearby cabs fetched successfully',
  PROMO_INVALID: 'Promo code is invalid',
  PROMO_EXPIRED: 'Promo code has expired',
  PROMO_USAGE_LIMIT: 'Promo code usage limit is over',
  PROMO_CODES_FETCHED: 'Promo codes fetched successfully',

  // Driver Booking
  DRIVER_HOME_FETCHED: 'Driver home fetched successfully',
  DRIVER_DUTY_UPDATED: 'Duty status updated successfully',
  DRIVER_VEHICLE_NOT_SET:
    'Set your vehicle type before going online to receive rides',
  DRIVER_GO_OFFLINE_BLOCKED:
    'Complete or cancel your running ride before going offline',
  DRIVER_BUSY: 'You already have a running ride',
  DRIVER_LOCATION_UPDATED: 'Driver location updated successfully',
  RIDE_REQUESTS_FETCHED: 'Ride requests fetched successfully',
  RIDE_REQUEST_FETCHED: 'Ride request fetched successfully',
  RIDE_ALREADY_TAKEN: 'This ride is already accepted by another driver',
  RIDE_STATUS_INVALID: 'Ride is not in the right status for this action',
  DRIVER_VEHICLE_TYPE_MISMATCH: 'This ride is not for your vehicle type',
  DRIVER_ARRIVED: 'Driver reached the pickup point',
  RIDE_ALREADY_STARTED: 'Trip has already been started',
  RIDE_NOT_STARTED: 'Trip has not been started yet',
  RIDE_NOT_ARRIVED: 'Mark arrival at the pickup point before starting the trip',
  RIDE_ALREADY_COMPLETED: 'Trip is already completed',
  RIDE_ALREADY_CANCELLED: 'Trip is already cancelled',
  RIDE_NOT_COMPLETED: 'Trip must be completed before collecting the payment',
  DRIVER_EARNINGS_FETCHED: 'Driver earnings fetched successfully',
  PAYMENT_COLLECTED: 'Payment collected successfully',
};

