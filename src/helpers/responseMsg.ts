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
  DRIVER_EARNINGS_HISTORY_FETCHED: 'Driver earnings history fetched successfully',
  DRIVER_SETTLEMENT_PROCESSED: 'Driver settlement processed successfully',

  // Route
  ROUTE_NOT_FOUND: 'Route not found',
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
};
