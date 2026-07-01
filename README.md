# 🦷 Blueteeth — Enterprise Clinical Rewards Platform

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-10-orange?style=for-the-badge&logo=firebase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

## 📋 Overview
**Blueteeth** is a premium, full-stack clinical case management and rewards platform designed for modern dental practices. It streamlines the workflow between associates, clinicians, and administrators, ensuring secure case evidence handling and automated reward tracking.

### ✨ Key Features
- **Role-Based Dashboards**: Tailored experiences for Admins, Clinicians, and Associates.
- **Secure Evidence Vault**: Authenticated file upload and viewing system for clinical proofs (PDFs/Images).
- **Automated Workflows**: Real-time status tracking from submission to approval.
- **Dynamic Payout System**: Automated points calculation and payout management.
- **Premium UI/UX**: Dark-mode support, smooth animations (Framer Motion), and tactile feedback.

## 🛠️ Technology Stack
- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Date Handling**: Date-fns

## 🚀 Getting Started

First, install the dependencies:
```bash
npm install
```

Then, run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure
- `/src/app`: Next.js pages and API routes.
- `/src/components`: Reusable UI components.
- `/src/context`: Authentication and global state management.
- `/src/lib`: Utility functions and Firebase configuration.
- `/src/types`: TypeScript definitions.

---

## 🔄 System Workflows & Roles Spec

This platform operates three primary dashboards: Associate Hub, Clinician Dashboard, and Admin Control Panel.

### 1. High-Level Architecture Flow

```mermaid
graph TD
    subgraph Client Tier
        AssocUI[Associate Hub]
        ClinUI[Clinician Dashboard]
        AdminUI[Admin Control Panel]
    end

    subgraph Service Tier
        Auth[Firebase Authentication]
        API[Next.js Serverless API Route]
        Storage[Cloudinary Image/Document CDN]
    end

    subgraph Database Tier
        FS_Users[users collection]
        FS_Cases[cases collection]
        FS_Payouts[payouts collection]
    end

    AssocUI --> Auth
    ClinUI --> Auth
    AdminUI --> Auth

    AssocUI --> API
    ClinUI --> API
    AdminUI --> API

    API --> Storage
    API --> FS_Users
    API --> FS_Cases
    API --> FS_Payouts

    AssocUI -->|onSnapshot| FS_Cases
    ClinUI -->|onSnapshot| FS_Cases
    AdminUI -->|onSnapshot| FS_Cases
```

### 2. Role-Based Workflow Breakdown

#### 🤝 Associate Hub Workflow
Associates submit diagnostic details and track payout releases.
* **Flow**: Login &rarr; Submit Case (patient details + initial scans) &rarr; Real-time case tracking via Firestore stream &rarr; Request payout (&ge; ₹500).

```mermaid
flowchart TD
    Start([Associate logs in]) --> Hub[Associate Hub Dashboard]
    Hub --> SubmitCase[Submit New Case]
    Hub --> ViewCases[My Cases List]
    Hub --> RequestPayout[Request Payout]

    SubmitCase --> InputData[Input Patient Name & Treatment Type]
    InputData --> UploadFile[Upload Diagnostic Reports / Photos]
    UploadFile --> SaveDoc[Background Save to Firestore & Cloudinary Upload]
    SaveDoc --> PendingStatus[Case status = 'pending']

    ViewCases --> RealtimeSync[Direct Firestore Listener Syncs Status]
    RealtimeSync --> CaseDetails[View case details & final completion proof]

    RequestPayout --> InputAmount[Input withdrawal amount - Min ₹500]
    InputAmount --> SelectMethod[Select UPI or Bank Transfer]
    SelectMethod --> SubmitReq[Creates 'payouts' doc & sends Admin notification]
```

#### 🩺 Clinician Dashboard Workflow
Clinicians oversee treatment progress, record clinical notes, and upload final procedural proofs.
* **Flow**: View assigned list &rarr; Accept case (status `in_progress`) &rarr; Perform treatment &rarr; Upload completion proofs &rarr; Mark status as `completed`.

```mermaid
flowchart TD
    Start([Clinician logs in]) --> Dash[Clinician Dashboard]
    Dash --> AssignedList[View Assigned Cases]
    Dash --> SubmitSelfCase[Submit Self-Treated Case]
    Dash --> ClinicianEarnings[Track Clinician Earnings]

    AssignedList --> SelectCase[Select Case]
    SelectCase --> AcceptTreatment[Start treatment: status = 'in_progress']
    AcceptTreatment --> TreatmentComplete[Upload final completion proof & write treatment notes]
    TreatmentComplete --> MarkCompleted[Mark status = 'completed']

    SubmitSelfCase --> SelfInput[Input Patient & Treatment details]
    SelfInput --> SelfUpload[Upload both initial and final proofs]
    SelfUpload --> SelfComplete[Directly saves as status = 'completed' for Admin review]
```

#### 👑 Admin Panel & Settlement Workflow
Admins assign clinicians, verify post-op medical files, and approve payout ledger transactions.
* **Flow**: Review case &rarr; Assign to Doctor &rarr; Audit clinician's final proofs &rarr; Approve case (locks status to `approved`, credits points/earnings) &rarr; Settle payouts (atomic database transaction).

```mermaid
stateDiagram-v2
    [*] --> case_pending : Associate Submits Case
    
    state Admin_Case_Management {
        case_pending --> case_assigned : Admin assigns case to Clinician
        case_assigned --> case_completed : Clinician completes treatment & uploads final proof
        case_completed --> case_approved : Admin verifies proof & approves case
        case_completed --> case_rejected : Admin rejects case (invalid proof)
    }

    state Admin_Payout_Management {
        [*] --> payout_pending : Associate/Clinician requests payout
        payout_pending --> payout_paid : Admin transfers cash & marks as 'paid'
        payout_pending --> payout_rejected : Admin rejects request
    }
```

### 🔑 Test Accounts & Credentials (Development Mode)
To demo or review the system panels locally, you can use:
* **Admin Role**: `admin@blueteeth.in` (Password: `Admin@12345`)
* **Clinician Role**: `maillonin7687@gmail.com` (Password: `Password@123`)
* **Associate Role**: `agrizenai@gmail.com` (Password: `Password@123`)

---
Built with ❤️ for the Blueteeth Office.
