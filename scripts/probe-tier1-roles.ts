/**
 * In-process Tier 1 role-guard checks (no Firebase).
 * Usage: npx tsx scripts/probe-tier1-roles.ts
 */
import type { Request, Response, NextFunction } from 'express';
import { requireRole } from '../server/middleware/authorization';
import { hasRole } from '../server/permissions/authorization';
import { ROLES } from '../server/permissions/roles';

function userCanManageCoupons(req: { userRole?: (typeof ROLES)[keyof typeof ROLES] }): boolean {
  const role = req.userRole;
  if (!role) return false;
  return (
    hasRole(role, ROLES.ADMIN) ||
    hasRole(role, ROLES.SELLER) ||
    hasRole(role, ROLES.VERIFIED_SELLER) ||
    hasRole(role, ROLES.MARKETING_MANAGER)
  );
}

type MockRes = Response & { statusCode: number; body: unknown };

function mockRes(): MockRes {
  const res = {
    statusCode: 200,
    body: null as unknown,
    locals: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as MockRes;
}

async function runRequireRole(
  role: (typeof ROLES)[keyof typeof ROLES] | undefined,
  required: (typeof ROLES)[keyof typeof ROLES],
) {
  const mw = requireRole(required);
  const req = { userRole: role } as Request;
  const res = mockRes();
  let nextCalled = false;
  await new Promise<void>((resolve) => {
    mw(req, res, (() => {
      nextCalled = true;
      resolve();
    }) as NextFunction);
    if (!nextCalled) resolve();
  });
  return { status: res.statusCode, nextCalled, body: res.body };
}

const cases: Array<[string, boolean]> = [
  ['seller can manage coupons', userCanManageCoupons({ userRole: ROLES.SELLER })],
  ['admin can manage coupons', userCanManageCoupons({ userRole: ROLES.ADMIN })],
  ['super_admin can manage coupons', userCanManageCoupons({ userRole: ROLES.SUPER_ADMIN })],
  ['creator cannot manage coupons', !userCanManageCoupons({ userRole: ROLES.CREATOR })],
  ['finance cannot manage coupons', !userCanManageCoupons({ userRole: ROLES.FINANCE_MANAGER })],
  ['seller is not admin', !hasRole(ROLES.SELLER, ROLES.ADMIN)],
  ['super_admin is admin', hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN)],
];

let failed = 0;
for (const [label, ok] of cases) {
  console.log(ok ? 'PASS' : 'FAIL', label);
  if (!ok) failed += 1;
}

const sellerAdmin = await runRequireRole(ROLES.SELLER, ROLES.ADMIN);
console.log(
  sellerAdmin.status === 403 && !sellerAdmin.nextCalled ? 'PASS' : 'FAIL',
  'requireRole(ADMIN) seller -> 403',
  sellerAdmin.status,
);

const adminAdmin = await runRequireRole(ROLES.ADMIN, ROLES.ADMIN);
console.log(
  adminAdmin.nextCalled && adminAdmin.status === 200 ? 'PASS' : 'FAIL',
  'requireRole(ADMIN) admin -> next()',
);

const superAdmin = await runRequireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN);
console.log(
  superAdmin.nextCalled ? 'PASS' : 'FAIL',
  'requireRole(ADMIN) super_admin -> next()',
);

if (failed || sellerAdmin.status !== 403 || !adminAdmin.nextCalled || !superAdmin.nextCalled) {
  process.exit(1);
}
console.log('All in-process role guards OK');
