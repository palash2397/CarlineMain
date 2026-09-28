export enum LegalPageType {
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_AND_CONDITIONS = 'TERMS_AND_CONDITIONS',
}

// Which page answered a read: the page of the company, the default page of the
// deployment written by the superadmin, or no page at all.
export type LegalPageScope = 'COMPANY' | 'GLOBAL' | 'NONE';
