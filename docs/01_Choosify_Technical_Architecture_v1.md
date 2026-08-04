# Choosify Technical Architecture v1.0

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Project Mission](#2-project-mission)
3. [Engineering Mission](#3-engineering-mission)
4. [Core Engineering Principles](#4-core-engineering-principles)
5. [Approved Technology Stack](#5-approved-technology-stack)
6. [Technologies Not Approved](#6-technologies-not-approved)
7. [System Architecture](#7-system-architecture)
8. [Beta Launch Goal](#8-beta-launch-goal)
9. [Success Criteria](#9-success-criteria)
10. [Three Immutable Rules](#10-three-immutable-rules)
11. [Architecture Decision Record 001](#architecture-decision-record-001)

---

## 1. Project Identity

**Project Name:**
Choosify

**Tagline:**
Choose. Compare. Decide Wisely.

---

## 2. Project Mission

Build Bangladesh's most trusted product discovery and comparison platform where consumers can confidently choose products, brands and verified sellers through transparent information, community recommendations and trustworthy data.

---

## 3. Engineering Mission

Build Choosify as a scalable, secure, maintainable, production-grade platform where every core business function is owned and controlled by Choosify.

This means:

- We own authentication
- We own business logic
- We own APIs
- We own the database
- We own permissions
- We own the platform

---

## 4. Core Engineering Principles

1. Preserve existing UI unless explicitly requested.

2. Preserve business logic unless explicitly requested.

3. Every request must pass through the Express backend.

   Frontend

   ↓

   Express

   ↓

   PostgreSQL

4. One backend.

5. One authentication system.

   JWT + Argon2

6. One primary database.

   PostgreSQL

7. No unnecessary vendor lock-in.

---

## 5. Approved Technology Stack

**Frontend:**
React 19
Vite
TypeScript
Tailwind CSS

**Backend:**
Express.js

**Database:**
PostgreSQL

**ORM:**
Drizzle ORM

**Authentication:**
JWT
Argon2

**Validation:**
Zod

**Hosting:**
Vercel (frontend)
Backend hosting to be decided

**DNS:**
Cloudflare

---

## 6. Technologies Not Approved

- Firebase Authentication
- Firestore as primary database
- Firebase Cloud Functions
- Backendless
- Supabase Auth
- Any backend platform that owns Choosify's business logic.

---

## 7. System Architecture

Users

↓

React

↓

Express API

↓

Business Logic

↓

PostgreSQL

---

## 8. Beta Launch Goal

Closed Beta

- Founder
- 2-5 trusted testers
  - Customer
  - Seller
  - Creator
  - Admin

**Goal:**

Every workflow should behave like a production application.

---

## 9. Success Criteria

- No mock authentication
- No placeholder business logic
- Stable APIs
- Stable database
- Stable permissions
- Minimal bugs

---

## 10. Three Immutable Rules

1. Never redesign UI unless requested.

2. Never change architecture without approval.

3. Never sacrifice stability for speed.

---

## Architecture Decision Record 001

**Title**

Self-Owned Platform Architecture

**Decision**

Choosify owns:

- Authentication
- Database
- Business Logic
- Permissions
- APIs

**Primary Stack**

- Express
- PostgreSQL
- Drizzle ORM
- JWT
- Argon2

Firebase is considered a temporary dependency only where existing functionality still relies on it during migration.
