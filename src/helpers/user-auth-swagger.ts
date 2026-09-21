// Swagger v2 (/api/v1/docs/v2) is our own clean document. Every section we
// build is listed here with its owner so it stays easy to identify.
export const V2_SECTIONS = [
  {
    name: 'User Auth',
    description:
      'Customer signup, login, OTP and password APIs. Owner: Prakash Mishra',
  },
  {
    name: 'User Booking',
    description:
      'Passenger app booking, upfront fare, live tracking and cancellation. Owner: Prakash Mishra',
  },
  {
    name: 'Driver Booking',
    description:
      'Driver app duty, ride requests, trip lifecycle (accept / arrived / start / complete / collect payment), trips and earnings. Owner: Prakash Mishra',
  },
];

const SECTION_PATHS: Record<string, string[]> = {
  'Driver Booking': ['/driver-ride/'],
  'User Booking': ['/ride/'],
  'User Auth': [
    '/auth/register',
    '/auth/login',
    '/auth/verify-otp',
    '/auth/resend-otp',
    '/user/forgot-password',
    '/user/reset-password',
  ],
};

function sectionOfPath(path: string) {
  if (
    SECTION_PATHS['Driver Booking'].some((part) => path.indexOf(part) !== -1)
  ) {
    return 'Driver Booking';
  }

  if (SECTION_PATHS['User Booking'].some((part) => path.indexOf(part) !== -1)) {
    return 'User Booking';
  }

  if (SECTION_PATHS['User Auth'].some((part) => path.endsWith(part))) {
    return 'User Auth';
  }

  return null;
}

export function keepV2SectionsOnly(document: any): any {
  const paths: Record<string, any> = {};

  Object.entries(document.paths || {}).forEach(([path, item]) => {
    const section = sectionOfPath(path);

    if (!section) return;

    Object.values(item as any).forEach((operation: any) => {
      if (operation && typeof operation === 'object') {
        operation.tags = [section];
      }
    });

    paths[path] = item;
  });

  document.paths = paths;

  return document;
}
