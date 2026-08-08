# Documentation Index

## Purpose
_(To be defined)_

## Version
0.0.1

## Status
Draft

## Last Updated
2026-08-06

## Author
_(Unassigned)_

## Table of Contents
_(To be added)_

---

## Overview
_(Pending)_

**Start here:** [`project/PROJECT-MASTER-INDEX.md`](project/PROJECT-MASTER-INDEX.md) is the authoritative entry point for this documentation set — it defines the BP/ES/IS/ADR hierarchy, lists every document with links, and shows how they depend on each other. Read it before making changes to code or documentation.

## Directory Map

- `blueprint/` — Product & system blueprint, versioning, and supporting assets (diagrams, workflows, state machines, screenshots)
- `engineering/` — Engineering standards, AI implementation protocol, architecture principles, and decision records
- `architecture/` — Database, API, permissions, events, security, and deployment architecture specs
- `product/` — Marketplace, trust engine, commerce, finance, and content policy specs
- `design/` — Design principles, UI component standards, UX guidelines, and brand guidelines
- `sprints/` — Sprint logs and backlog
- `api/` — REST API, webhooks, and error code references
- `templates/` — Reusable templates for feature specs, sprints, ADRs, and meeting notes

## Blueprint Documents

Canonical source of the Choosify Platform Blueprint. Documents are added here as they are converted from source Word docs.

| ID | Document | Link | Status |
|----|----------|------|--------|
| BP-000 | Executive Summary | [00-Executive-Summary.md](blueprint/00-Executive-Summary.md) | Added |
| BP-001 | Vision & Constitution | [01-Vision-Constitution.md](blueprint/01-Vision-Constitution.md) | Added |
| BP-002 | User Ecosystem & Identity Model | [02-User-Ecosystem-Identity-Model.md](blueprint/02-User-Ecosystem-Identity-Model.md) | Added |
| BP-003 | Identity, Authentication & Verification Engine | [03-Identity-Authentication-Verification-Engine.md](blueprint/03-Identity-Authentication-Verification-Engine.md) | Added |
| BP-004 | Seller Workspace & Brand Architecture | [04-Seller-Workspace-Brand-Architecture.md](blueprint/04-Seller-Workspace-Brand-Architecture.md) | Added |
| BP-005 | Product & Service Engine | [05-Product-Service-Engine.md](blueprint/05-Product-Service-Engine.md) | Added |
| BP-006 | Commerce Engine (Orders, Checkout & Payments) | [06-Commerce-Engine.md](blueprint/06-Commerce-Engine.md) | Added |
| BP-007 | Communication, Messaging & Customer Engagement Engine | [07-Communication-Messaging-Customer-Engagement-Engine.md](blueprint/07-Communication-Messaging-Customer-Engagement-Engine.md) | Added |
| BP-008 | Trust, Reputation, Moderation & Governance Engine | [08-Trust-Reputation-Moderation-Governance-Engine.md](blueprint/08-Trust-Reputation-Moderation-Governance-Engine.md) | Added |
| BP-009 | Finance, Escrow & Accounting Engine | [09-Finance-Escrow-Accounting-Engine.md](blueprint/09-Finance-Escrow-Accounting-Engine.md) | Added |
| BP-010 | Content, Discovery & Engagement Engine | [10-Content-Discovery-Engagement-Engine.md](blueprint/10-Content-Discovery-Engagement-Engine.md) | Added |
| BP-011 | Administration, CMS & Platform Operations Engine | [11-Administration-CMS-Platform-Operations-Engine.md](blueprint/11-Administration-CMS-Platform-Operations-Engine.md) | Added |
| BP-012 | Platform Architecture, System Boundaries & Technical Constitution | [12-Platform-Architecture-System-Boundaries-Technical-Constitution.md](blueprint/12-Platform-Architecture-System-Boundaries-Technical-Constitution.md) | Added |

**Blueprint phase complete.** BP-000 through BP-012 form the full architectural specification for Choosify and should guide implementation decisions across both the admin and storefront repositories going forward.

## Engineering Specifications

Living engineering specification derived from the Blueprint. Documents are added here as they are converted from source Word docs, exactly like the Blueprint.

| ID | Document | Link | Status |
|----|----------|------|--------|
| ES-001 | PostgreSQL Database Architecture & Entity Relationship Model | [ES-001-Database-Architecture.md](engineering/ES-001-Database-Architecture.md) | Added |
| ES-002 | API Architecture & Service Contracts | [ES-002-API-Architecture.md](engineering/ES-002-API-Architecture.md) | Added |
| ES-003 | Role-Based Access Control (RBAC) & Permission Matrix | [ES-003-RBAC.md](engineering/ES-003-RBAC.md) | Added |
| ES-004 | Event Bus, Domain Events & System Messaging | [ES-004-Event-Bus.md](engineering/ES-004-Event-Bus.md) | Added |
| ES-005 | Workflow State Machines & Business Lifecycles | [ES-005-State-Machines.md](engineering/ES-005-State-Machines.md) | Added |
| ES-006 | Notification Matrix & Multi-Channel Delivery Architecture | [ES-006-Notification-Matrix.md](engineering/ES-006-Notification-Matrix.md) | Added |
| ES-007 | User Interface Architecture, Design System & UX Specifications | [ES-007-UI-Specification.md](engineering/ES-007-UI-Specification.md) | Added |
| — | Management Surface ≠ Visual Builder (UI Freeze) | [UI-Management-vs-Visual-Builder-Freeze.md](engineering/UI-Management-vs-Visual-Builder-Freeze.md) | Added |
| ES-008 | Security Architecture, Privacy & Compliance Engineering | [ES-008-Security.md](engineering/ES-008-Security.md) | Added |
| ES-009 | Performance, Scalability & Infrastructure Engineering | [ES-009-Performance.md](engineering/ES-009-Performance.md) | Added |
| ES-010 | DevOps, Deployment, CI/CD & Operational Excellence | [ES-010-Deployment.md](engineering/ES-010-Deployment.md) | Added |

**Engineering Specification complete.** ES-001 through ES-010 form the living engineering specification for Choosify, translating the Blueprint (BP-000–BP-012) into concrete technical standards for database, API, RBAC, events, state machines, notifications, UI, security, performance, and DevOps. Both should guide implementation decisions across the admin and storefront repositories going forward.

Decision records (individual ADRs) live in [engineering/Decision-Records/](engineering/Decision-Records/).

## Implementation Specifications

Implementation Specifications (IS) translate the approved Blueprint (BP-000–BP-012) and Engineering Specification (ES-001–ES-010) into executable development plans. IS documents are documentation only — no production code, schema migrations, or implementation occurs at this stage. IS documents do not redesign the platform, invent new business rules, simplify architecture, or replace BP/ES decisions; those documents remain the single source of truth and are never modified by an IS.

| ID | Document | Link | Status |
|----|----------|------|--------|
| IS-001 | Identity, Authentication & Session Implementation | [IS-001-Identity-Authentication-Implementation.md](implementation/IS-001-Identity-Authentication-Implementation.md) | Added |
| IS-002 | Seller Workspace & Brand Ownership Implementation | [IS-002-Seller-Workspace-Brand-Ownership.md](implementation/IS-002-Seller-Workspace-Brand-Ownership.md) | Added |
| IS-003 | Product, Service & Inventory Engine Implementation | [IS-003-Product-Service-Inventory-Engine.md](implementation/IS-003-Product-Service-Inventory-Engine.md) | Added |
| IS-004 | Commerce, Checkout & Order Management Implementation | [IS-004-Commerce-Checkout-Order-Management.md](implementation/IS-004-Commerce-Checkout-Order-Management.md) | Added |
| IS-005 | Messaging, Communication & Social Commerce Implementation | [IS-005-Messaging-Communication-Social-Commerce.md](implementation/IS-005-Messaging-Communication-Social-Commerce.md) | Added |
| IS-006 | Trust, Reputation, Reviews & Moderation Implementation | [IS-006-Trust-Reputation-Reviews-Moderation.md](implementation/IS-006-Trust-Reputation-Reviews-Moderation.md) | Added |
| IS-007 | Finance, Escrow & Business Operations Implementation | [IS-007-Finance-Escrow-Business-Operations.md](implementation/IS-007-Finance-Escrow-Business-Operations.md) | Added |
| IS-008 | Discovery, Search, Recommendation & Content Implementation | [IS-008-Discovery-Search-Recommendation-Content.md](implementation/IS-008-Discovery-Search-Recommendation-Content.md) | Added |
| IS-009 | Administration Portal, CMS & Platform Operations Implementation | [IS-009-Administration-Portal-CMS-Platform-Operations.md](implementation/IS-009-Administration-Portal-CMS-Platform-Operations.md) | Added |
| IS-010 | Production Readiness & Sprint Execution Roadmap | [IS-010-Production-Readiness-Sprint-Execution-Roadmap.md](implementation/IS-010-Production-Readiness-Sprint-Execution-Roadmap.md) | Added |

**Implementation Specification phase complete.** IS-001 through IS-010 translate the full Blueprint and Engineering Specification into an executable, dependency-ordered, 30-sprint build plan (IS-010), governing every domain from Identity through Administration.

## Project Index

The master governance document for this entire documentation set — defines the BP/ES/IS/ADR authority hierarchy, lists every document with links, and shows dependency relationships. Start here.

| Document | Link | Status |
|----------|------|--------|
| Project Master Index | [project/PROJECT-MASTER-INDEX.md](project/PROJECT-MASTER-INDEX.md) | Added |

## Architecture Decision Records

ADRs are the only mechanism by which an implementation may deviate from or clarify a BP, ES, or IS document. Two locations currently hold ADRs:

- [`engineering/Decision-Records/`](engineering/Decision-Records/) — primary location for new ADRs
- [`adr/`](adr/) — pre-existing ADR series

| ID | Document | Link |
|----|----------|------|
| ADR-001 | BP-008 vs ES-005 Marketplace Enforcement Progression Discrepancy | [engineering/Decision-Records/ADR-001-Marketplace-Enforcement-Progression-Discrepancy.md](engineering/Decision-Records/ADR-001-Marketplace-Enforcement-Progression-Discrepancy.md) |
| ADR-015 | DRY Authentication | [adr/ADR-015_DRY_Authentication.md](adr/ADR-015_DRY_Authentication.md) |

## Details
_(Pending)_

## References
_(Pending)_

---

## Documentation Summary

**Blueprints**
13 Documents

**Engineering Specifications**
10 Documents

**Implementation Specifications**
10 Documents

**Project Index**
1 Document

**Architecture Decision Records**
1 Document (ADR-001; pre-existing series has 1 more — ADR-015)

### Status

**Documentation Phase**
COMPLETE

**Implementation Phase**
READY
