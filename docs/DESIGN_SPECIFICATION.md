# NeuroLink – UI Reference & Design Specification

> **Document Version:** 2.0  
> **Source of Truth:** User Specification (`2026-11-07`)  
> **Repository:** `PBL4_Web`  

---

## 1. Project Overview

NeuroLink is a hybrid healthcare and neuroscience social networking platform.

The platform connects:
- General users
- Healthcare professionals (HCPs)
- Researchers & BCI engineers
- Neuroscience enthusiasts

Through:
- Social interaction & clinical peer consensus
- Professional networking & verification
- Knowledge sharing & research publication
- Health data & EEG dataset management

The design combines the approachability of a modern social network, the authority and rigor of a professional research community, and the clarity of a healthcare data dashboard.

---

## 2. Design References & Archetypes

### Primary Reference: Sermo (https://www.sermo.com/)
- Social clinical feed and peer post interactions
- Verified healthcare professional profiles
- Clinical case discussions & differential diagnosis
- Rigorous professional verification (CCHN / ORCID)
- Sermo-inspired CME / Honoraria contribution & reward wallet

### Secondary References:
- **Figure 1 (https://www.figure1.com/):**
  - Clinical case presentation & differential diagnosis
  - Image-based clinical posts (scans, radiographs, EEG spectra) with patient privacy protection (PHI guardrails)
  - Medical discussions & consensus
- **Doximity (https://www.doximity.com/):**
  - Healthcare professional networking & credential presentation
  - Clinician profiles (specialty, hospital affiliation, residency, publications)
  - Secure professional messaging & HIPAA/PHI-compliant direct exchange
- **ResearchGate (https://www.researchgate.net/):**
  - Researcher profiles, ORCID integration, research interests
  - Scientific publications, preprints, datasets, and citation context
  - Academic collaboration & peer discussion
- **PatientsLikeMe (https://www.patientslikeme.com/):**
  - Patient-oriented experience & empathetic communication
  - Health tracking & symptom observation
  - Accessible presentation of clinical neuroscience topics

---

## 3. Design Philosophy (The Hybrid Direction)

NeuroLink follows a **Hybrid Design Direction**:
1. **Social Media:** Approachable, interactive, content-oriented, readable typography.
2. **Professional Network:** Structured, trustworthy, credible, verified identities.
3. **Healthcare Dashboard:** Clean, informative, data-oriented, quiet surfaces.

### Antipatterns to Avoid (Zero AI Slop):
- No generic AI-generated SaaS dashboard aesthetics.
- No excessive neon gradients or glowing borders.
- No floating cards with arbitrary shadows.
- No excessive rounded pill containers where rectangular precision is clearer.
- No overly decorative medical illustrations or fake 3D blobs.
- No repetitive copy-paste layouts that make every page look identical.

---

## 4. Main Design Modules

### 1. Home (`/feed`)
*Reference: Sermo & Figure 1*
- Social and clinical feed with chronological and following tabs.
- Clean post creation toolbar (supporting text, clinical images, and topics).
- Ghi nhận đồng thuận (Endorsement/Consensus), comments drawer, and share.
- Trending discussion topics (`#LâmSàngThầnKinh`, `#BCI_Neurotech`, `#HìnhẢnhHọcNão`, etc.).
- Recommended peer specialists (HCPs & Researchers).

### 2. Explore (`/search`)
*Reference: Facebook & Doximity*
- Unified discovery engine with category filtering:
  - All (Tất cả)
  - Healthcare Professionals (Bác sĩ & Chuyên gia y tế)
  - Researchers (Nhà nghiên cứu & Kỹ sư BCI)
  - Clinical & Academic Posts (Ca lâm sàng & Bài viết)
- Search by specialty, hospital affiliation, or neuroscience topics.

### 3. Communities (`/feed` & Explore)
*Reference: Sermo & ResearchGate*
- Professional and research community hubs.
- Topic-based discussions (Neurology, BCI, Neuroimaging, Stroke Rehabilitation).
- Community membership and active peer contributions.

### 4. Research Hub (`/contributions`)
*Reference: ResearchGate*
- Dedicated scientific contributions portal:
  - Preclinical trials and BCI papers (`RESEARCH_CONTRIBUTION`)
  - Academic peer discussions (`RESEARCH_DISCUSSION`)
  - Educational resources & clinical guidelines (`HEALTHCARE_EDUCATION`)
- Peer review pipeline and credit granting.

### 5. EEG Health Hub (`/eeg-hub`)
*Reference: Healthcare Dashboards*
- EEG dataset management and metadata display (sampling rate, electrode montages 10-20).
- Multi-channel EEG signal visualization (C3, C4, Fz, Cz, Pz, O1, O2).
- Frequency band distribution (Delta, Theta, Alpha, Beta).
- Authorized expert access & share with clinician.
- *Note: Signal processing and automated AI decoding are future development phases.*

### 6. Messages (`/messages`)
*Reference: Doximity*
- Secure direct messaging between verified colleagues and community members.
- Conversation list with unread counters.
- Message history and responsive mobile layout.

### 7. Credits & Rewards (`/rewards` & `/contributions`)
*Reference: Sermo Honoraria & CME*
- Contribution credit wallet (balance, total earned, total spent).
- Immutable transaction ledger.
- Catalog of CME courses, scientific conference passes, and academic resources.
- Transparent redemption and refund mechanics.

### 8. Profile (`/u/:username`)
*Reference: Doximity & ResearchGate*
- Personal bio and contact identity.
- Verified professional credentials (CCHN, Hospital/Institution, Title).
- Research background (ORCID, specialty, research interests).
- Published posts, clinical discussions, and academic contributions.

---

## 5. Visual Identity & Color Tokens

### Color Principles:
- **Light, clean, and restful:** Soft neutral background (`#F4F6F8`), pure white cards (`#FFFFFF`).
- **Professional Blue & Teal Accents:**
  - Primary Brand: **Clinical Slate-Navy** (`#2B4C7E`, hover `#1E3A5F`, light `#F0F4F8`).
  - Secondary Accent: **Clinical Sage-Teal** (`#2C6865`, light `#F0F7F6`).
- **Moderate Use of Color:** Zero neon/chói. High contrast for readability without visual fatigue.
- **Typography:** `Plus Jakarta Sans` & `Inter`, strong typographic hierarchy, crisp weights.
- **Surface Elevation:** Subtle 1px borders (`#E2E8F0`), minimal soft shadows.

---

## 6. Implementation Principles

1. **Source of Truth:** The existing NeuroLink codebase is the foundation.
2. **Preservation:** All existing routes, authentication, database relationships, and APIs must remain 100% operational.
3. **Empirical Quality:** All views must be verified across 3 viewports (Desktop 1440px, Tablet 768px, Mobile 375px) with zero TypeScript errors.
