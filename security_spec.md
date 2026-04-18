# Urban Hikers Security Specification

This document defines the security invariants and test payloads for the Urban Hikers "Local Pulse OS" Firestore database.

## Data Invariants

1.  **Broadcast Identity**: Every broadcast must have a title and properly formatted coordinates.
2.  **Broadcast Expiry**: Expiry timestamps must be in the future during creation and MUST be server-validated.
3.  **Role Integrity**: Users cannot grant themselves `admin` or `partner` status. Roles are assigned by internal processes or admin updates.
4.  **PII Isolation**: User email addresses must only be readable by the owner or an admin.
5.  **Interaction Integrity**: Logs (taps, vibe reports) are write-only by the public and readable only by admins.

## The "Dirty Dozen" (Attack Payloads)

| Attack Type | Collection | Payload / Action | Expected Result |
| :--- | :--- | :--- | :--- |
| **Identity Spoof** | `users` | Update `role` to `admin` as `user` | **REJECTED** |
| **Shadow Update** | `broadcasts` | Add `verified: true` (ghost field) | **REJECTED** |
| **PII Leak** | `users` | Read another user's profile | **REJECTED** |
| **Status Shortcircuit** | `broadcasts` | Set `active: true` on an expired event | **REJECTED** |
| **Resource Poison** | `nodes` | Set `id` to a 10KB junk string | **REJECTED** |
| **Time Spoof** | `broadcasts` | Send `expires_at` from 2001 | **REJECTED** |
| **Orphaned Write** | `broadcasts` | Create broadcast for non-existent node | **REJECTED** |
| **Quota Exhaustion** | `taps` | 1000 taps in 1 second | **REJECTED (Rate Limit)** |
| **Self-Assigned Role** | `users` | `create` profile with `role: "super_admin"` | **REJECTED** |
| **ID Injection** | `pois` | Document ID: `../../../system/config` | **REJECTED** |
| **Validation Gap** | `broadcasts` | `title` is `true` (boolean instead of string) | **REJECTED** |
| **Blanket Read** | `taps` | Query all taps without node filter | **REJECTED** |

## Test Runner (Logic Definitions)

The following `firestore.rules` will implement these guards.
