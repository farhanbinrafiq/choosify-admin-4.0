# Management Surface ≠ Visual Builder (UI Freeze)

**Status:** Frozen (UI Recovery Milestone `v1.3-ui-parity`)  
**Audience:** Engineering / future sprints  
**Related:** ES-007 UI Specification, BP-011 Administration & CMS

## Permanent rule

**Management Surface != Visual Builder**

Do not collapse administration lists into storefront editors, and do not replace approved Visual Builders with legacy CMS forms.

| Surface | Meaning |
|--------|---------|
| **Brand Management** | Platform Brand administration / list |
| **Brand Profile** | Admin governance / profile surface |
| **Brand Visual Builder** | Individual Brand editor resembling the public Brand storefront |
| **Products & Inventory Management** | Product / inventory administration |
| **Product Visual Builder** | Individual Product editor resembling public Product Detail |
| **Creator Management** | Creator administration |
| **Creator Visual Builder** | Individual Creator editor resembling public Creator Profile |
| **Guide Management** | Guide / content administration |
| **Guide Visual Builder** | Individual Guide editor resembling public Guide Detail |

## Routing migration must not imply UI redesign

When future implementation work moves a route from CmsMirror / legacy infrastructure to React (or another runtime), the **currently approved visual presentation must be preserved** unless an explicit redesign is authorized.

Surgical cutovers are allowed **only** for single-entity editor routes (for example `/admin/products/:id/edit`). Management / list routes must remain on their approved implementations.

## Why this freeze exists

This rule prevents future sprints from reintroducing legacy layouts or treating Visual Builder cutovers as an invitation to redesign frozen Admin surfaces.
