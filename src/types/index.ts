export type UserRole = 'associate' | 'clinician' | 'admin';

export interface User {
  id?: string;
  uid: string;
  name: string;
  displayName?: string;
  email: string;
  phone: string;
  role: UserRole;
  totalPoints: number;
  totalEarnings: number;
  age?: number;
  gender?: string;
  clinicName?: string;
  clinicAddress?: string;
  photoURL?: string;
  createdAt: any; // Firebase Timestamp
  registrationNumber?: string;
  specialization?: string;
  twoFAEnabled?: boolean;
}

export type CaseStatus = 
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'approved'
  | 'rejected'
  | 'treatment_completed'; // Added for Associate flow

export type CaseSourceType = 'associate' | 'clinician_self' | 'assigned';

export interface Case {
  id: string;
  patientName: string;
  mobile: string;
  treatmentType: string;
  clinicLocation: string;
  bookingDate: string;
  notes: string;
  clinicianNotes?: string;

  associateId?: string;
  clinicianId?: string;
  associateName?: string;
  clinicianName?: string;
  clinicianRegNo?: string;
  clinicianMobile?: string;

  // New patient info fields
  age?: number | string;
  gender?: string;
  associateMobile?: string;

  sourceType: CaseSourceType;
  selfAssigned?: boolean;

  initialProof: string[];
  finalProof: string[];

  status: CaseStatus;

  points: number;
  consultationFee: number;
  treatmentCharge?: number | string;

  updatedAt?: any; // Firebase Timestamp
  createdAt: any; // Firebase Timestamp
}

export interface Payout {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'completed' | 'paid';
  paymentMethod: 'upi' | 'bank';
  upiId?: string;
  bankDetails?: {
    holderName: string;
    accountNumber: string;
    ifsc: string;
  };
  transactionId?: string;
  notes?: string;
  createdAt: any; // Firebase Timestamp
  approvedAt?: any; // Firebase Timestamp
}

export const TREATMENT_POINTS: Record<string, number> = {
  'RCT': 5,
  'Cleaning': 2,
  'Implant': 10,
  'Crown & Bridge': 4,
  'Veneers': 6,
  'Braces': 8,
  'Extraction': 1,
  'Teeth Whitening': 3,
  'Denture': 5,
  'Filling': 1,
  'Wisdom Tooth Removal': 3,
  'Smile Design': 12,
  'Gum Treatment': 4,
  'Aligners': 15,
  'Kids Dentistry': 2,
  'Full Mouth Rehabilitation': 20,
  'Oral Surgery': 10,
  'Scaling & Polishing': 2,
  'Dental X-Ray': 0,
  'Consultation': 0,
};

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info' | 'security';
  isRead: boolean;
  createdAt: any; // Firebase Timestamp
  link?: string;
  relatedCaseId?: string;
}

export const POINT_VALUE = 50; // 1 B-Point = ₹50
