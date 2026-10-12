/**
 * Studio Phase A foundation probe (pure logic, no server / DB).
 *
 *   npx tsx scripts/probe-studio-foundation.ts
 *
 * Covers the decisions behind useUnsavedChangesGuard and StudioEditPill:
 * dirty detection (incl. edit-then-revert), which link clicks are intercepted,
 * and section-specific accessible names for the Edit pills.
 */
import { draftDiffers, guardedInAppPath, type LinkClickFacts } from '../src/components/studio/unsavedChangesLogic';
import { editPillAccessibleName } from '../src/components/studio/StudioEditPill';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}`, detail ?? '');
  }
}

console.log('draftDiffers');
const saved = { title: 'Lamp', price: 1200, tags: ['a', 'b'], specs: { w: 2 } };
check('identical draft is clean', !draftDiffers({ ...saved, tags: ['a', 'b'], specs: { w: 2 } }, saved));
check('changed field is dirty', draftDiffers({ ...saved, price: 1300 }, saved));
check('nested change is dirty', draftDiffers({ ...saved, specs: { w: 3 } }, saved));
check('array change is dirty', draftDiffers({ ...saved, tags: ['a'] }, saved));
const edited = { ...saved, title: 'Lamp X' };
const reverted = { ...edited, title: 'Lamp' };
check('edit then revert is clean again', draftDiffers(edited, saved) && !draftDiffers(reverted, saved));
check('no draft is clean', !draftDiffers(null, saved));
check('no saved model is clean', !draftDiffers(saved, undefined));

console.log('guardedInAppPath');
const here = { origin: 'http://localhost:3001', pathname: '/admin/products/p1/edit', search: '' };
const click = (over: Partial<LinkClickFacts>): LinkClickFacts => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  target: '',
  hasDownload: false,
  href: 'http://localhost:3001/admin/orders',
  ...over,
});
check('plain in-app link is guarded', guardedInAppPath(click({}), here) === '/admin/orders');
check('keeps search + hash', guardedInAppPath(click({ href: 'http://localhost:3001/admin/guides?tab=live#x' }), here) === '/admin/guides?tab=live#x');
check('target=_self is guarded', guardedInAppPath(click({ target: '_self' }), here) === '/admin/orders');
check('ctrl-click (new tab) is not guarded', guardedInAppPath(click({ ctrlKey: true }), here) === null);
check('meta-click is not guarded', guardedInAppPath(click({ metaKey: true }), here) === null);
check('shift-click is not guarded', guardedInAppPath(click({ shiftKey: true }), here) === null);
check('alt-click is not guarded', guardedInAppPath(click({ altKey: true }), here) === null);
check('middle button is not guarded', guardedInAppPath(click({ button: 1 }), here) === null);
check('target=_blank is not guarded', guardedInAppPath(click({ target: '_blank' }), here) === null);
check('download link is not guarded', guardedInAppPath(click({ hasDownload: true }), here) === null);
check('already-prevented click is not guarded', guardedInAppPath(click({ defaultPrevented: true }), here) === null);
check('other origin is not guarded', guardedInAppPath(click({ href: 'https://choosify.bd/brands/x' }), here) === null);
check('mailto is not guarded', guardedInAppPath(click({ href: 'mailto:a@b.c' }), here) === null);
check('same-page hash link is not guarded', guardedInAppPath(click({ href: 'http://localhost:3001/admin/products/p1/edit#pricing' }), here) === null);
check('empty href is not guarded', guardedInAppPath(click({ href: '' }), here) === null);

console.log('editPillAccessibleName');
check('default label → "Edit <section>"', editPillAccessibleName('Pricing') === 'Edit Pricing');
check('explicit "Edit" label → "Edit <section>"', editPillAccessibleName('Media', 'Edit') === 'Edit Media');
const custom = editPillAccessibleName('Cover & Avatar', 'Cover');
check('custom label keeps visible text and names the section', custom.includes('Cover') && custom.includes('Cover & Avatar'), custom);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
