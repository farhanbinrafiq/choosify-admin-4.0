# Choosify Repository Architecture

This document defines the permanent repository architecture for Choosify.

## Table of Contents

1. [Repository Strategy](#1-repository-strategy)
2. [Repository 1 — Choosify-Web](#2-repository-1--choosify-web)
3. [Repository 2 — Choosify-Admin](#3-repository-2--choosify-admin)
4. [Backend Ownership](#4-backend-ownership)
5. [Database Ownership](#5-database-ownership)
6. [Authentication](#6-authentication)
7. [API Ownership](#7-api-ownership)
8. [Frontend Responsibility](#8-frontend-responsibility)
9. [Backend Responsibility](#9-backend-responsibility)
10. [Third Party Policy](#10-third-party-policy)
11. [Feature Development Flow](#11-feature-development-flow)
12. [Architecture Decision Records](#architecture-decision-records)

---

## 1. Repository Strategy

Choosify consists of two repositories.

```
Choosify
├── Choosify-Web
└── Choosify-Admin
```

---

## 2. Repository 1 — Choosify-Web

**Responsibilities**

- Customer Platform
- Seller Portal
- Creator Portal
- Public Website
- Product Pages
- Compare
- Search
- Wishlist
- Reviews

This repository NEVER contains backend business logic.

---

## 3. Repository 2 — Choosify-Admin

**Responsibilities**

- Admin Panel
- Express Backend
- PostgreSQL
- Authentication
- CMS
- Analytics
- Products
- Brands
- Categories
- Orders
- Notifications
- API

This repository owns the backend.

---

## 4. Backend Ownership

There is exactly one backend.

Express.js

Every application communicates through Express.

```
Choosify-Web  ──┐
                ├──►  Express.js
Choosify-Admin ──┘
```

---

## 5. Database Ownership

Exactly one primary database.

PostgreSQL.

---

## 6. Authentication

- JWT
- Argon2
- Refresh Tokens

---

## 7. API Ownership

All APIs belong inside Choosify-Admin.

---

## 8. Frontend Responsibility

- Display data.
- Collect user input.
- Call APIs.
- Render responses.

---

## 9. Backend Responsibility

- Business Logic
- Authentication
- Authorization
- Validation
- Database
- Permissions
- Analytics
- Notifications

---

## 10. Third Party Policy

Infrastructure services are acceptable.

Business logic services are not.

---

## 11. Feature Development Flow

```
Frontend
   ↓
  API
   ↓
Service
   ↓
Database
   ↓
Response
   ↓
Frontend
```

---

## Architecture Decision Records

### ADR-002 Repository Strategy

Choosify consists of two repositories: Choosify-Web and Choosify-Admin.

### ADR-003 Backend Ownership

There is exactly one backend: Express.js. Every application communicates through Express.

### ADR-004 API Ownership

All APIs belong inside Choosify-Admin.

### ADR-005 Database Ownership

Exactly one primary database: PostgreSQL.

### ADR-006 Authentication Ownership

Authentication is owned via JWT, Argon2, and Refresh Tokens.

### ADR-007 Frontend Responsibility

Frontend responsibilities: display data, collect user input, call APIs, render responses.

### ADR-008 Backend Responsibility

Backend responsibilities: business logic, authentication, authorization, validation, database, permissions, analytics, notifications.

### ADR-009 Third Party Policy

Infrastructure services are acceptable. Business logic services are not.

### ADR-010 Feature Development Flow

Frontend → API → Service → Database → Response → Frontend.
