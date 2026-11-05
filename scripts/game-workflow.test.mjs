import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWorkflow, validateWorkflow } from './check-game-workflow.mjs';

const yaml = readFileSync(new URL('../.github/workflows/deploy-legendary-rib-corgi.yml', import.meta.url), 'utf8');
const valid = () => parseWorkflow(yaml);
const step = (doc, id) => doc.jobs['build-deploy'].steps.find((entry) => entry.id === id);
const rejects = (mutation, code) => {
  const doc = valid(); mutation(doc);
  assert.ok(validateWorkflow(doc).includes(code), code);
};

test('actual workflow satisfies manual deployment contract', () => assert.deepEqual(validateWorkflow(valid()), []));
test('rejects duplicate YAML keys, broken YAML and non-object documents safely', () => {
  for (const source of ['name: one\nname: two', 'jobs: [']) assert.throws(() => parseWorkflow(source), /^Error: WORKFLOW_YAML_INVALID$/);
  for (const doc of [null, 3, []]) assert.deepEqual(validateWorkflow(doc), ['WORKFLOW_DOCUMENT_INVALID']);
});
test('only manual dispatch with required dev-or-SHA input is accepted', () => {
  rejects((d) => { d.on.push = {}; }, 'WORKFLOW_MANUAL_ONLY');
  rejects((d) => { d.on.workflow_dispatch.inputs.source_ref.default = 'main'; }, 'WORKFLOW_SOURCE_INPUT_INVALID');
  rejects((d) => { d.on.workflow_dispatch.inputs.source_ref.required = false; }, 'WORKFLOW_SOURCE_INPUT_INVALID');
});
test('shell injection, disabled default-branch guards and unpinned source are rejected', () => {
  rejects((d) => { step(d, 'guard').run += '\necho ${{ inputs.source_ref }}'; }, 'WORKFLOW_SHELL_INTERPOLATION');
  rejects((d) => { step(d, 'guard').run = 'exit 0\n' + step(d, 'guard').run; }, 'WORKFLOW_GUARD_INVALID');
  rejects((d) => { step(d, 'source').run = step(d, 'source').run.replace('git checkout --detach', '# git checkout --detach'); }, 'WORKFLOW_SOURCE_INVALID');
  rejects((d) => { d.jobs['build-deploy'].steps.push({ id: 'later-checkout', uses: 'actions/checkout@v4' }); }, 'WORKFLOW_STEP_ORDER_INVALID');
  rejects((d) => { step(d, 'checkout').with.ref = 'dev'; }, 'WORKFLOW_CHECKOUT_INVALID');
});
test('public settings must be exact and server/deployment credentials cannot reach builds', () => {
  rejects((d) => { d.jobs['build-deploy'].env.NEXT_PUBLIC_GAME_MODE = 'local'; }, 'WORKFLOW_PUBLIC_ENV_INVALID');
  rejects((d) => { delete d.jobs['build-deploy'].env.NEXT_PUBLIC_GAME_API_CLIENT_ID; }, 'WORKFLOW_PUBLIC_ENV_INVALID');
  rejects((d) => { step(d, 'build').env = { KEY: '${{ secrets.OTHER }}' }; }, 'WORKFLOW_SECRET_SCOPE');
  rejects((d) => { step(d, 'build').run += '\necho GAME_COSMOS_CLIENT_SECRET'; }, 'WORKFLOW_SECRET_EXPOSURE');
  rejects((d) => { step(d, 'public-config').run = "echo GAME_EXPECTED_SWA_ORIGIN=https://localhost >> $GITHUB_ENV"; }, 'WORKFLOW_ORIGIN_INVALID');
});
test('audit must include development dependencies and fail the job', () => {
  rejects((d) => { d.jobs['build-deploy'].steps = d.jobs['build-deploy'].steps.filter((s) => s.id !== 'audit'); }, 'WORKFLOW_STEP_ORDER_INVALID');
  for (const command of ['npm audit --audit-level=high --omit=dev', 'npm audit --audit-level=high || true', '# npm audit --audit-level=high']) {
    rejects((d) => { step(d, 'audit').run = command; }, 'WORKFLOW_AUDIT_INVALID');
  }
  rejects((d) => { step(d, 'audit')['continue-on-error'] = true; }, 'WORKFLOW_STEP_BYPASS');
  rejects((d) => { step(d, 'verify').if = 'false'; }, 'WORKFLOW_STEP_BYPASS');
});
test('preflight artifacts, omitted checks and deployment rebuilds are rejected', () => {
  rejects((d) => { step(d, 'test').run = step(d, 'test').run.replace('npx next typegen\n', ''); }, 'WORKFLOW_TEST_INVALID');
  rejects((d) => { step(d, 'build').run = 'npm run build:release -- --mode preflight'; }, 'WORKFLOW_BUILD_INVALID');
  rejects((d) => { step(d, 'verify').run = 'echo skipped'; }, 'WORKFLOW_VERIFY_INVALID');
  rejects((d) => { step(d, 'test').run = 'npm run lint'; }, 'WORKFLOW_TEST_INVALID');
  for (const [key, value] of [['app_location', '.'], ['api_location', 'api'], ['skip_api_build', false], ['skip_app_build', false], ['production_branch', 'dev'], ['deployment_environment', 'preview']]) {
    rejects((d) => { step(d, 'deploy').with[key] = value; }, 'WORKFLOW_UPLOAD_INVALID');
  }
});
test('deployment must fail on missing token and keep immutable action pins', () => {
  rejects((d) => { step(d, 'token').run = 'exit 0'; }, 'WORKFLOW_TOKEN_INVALID');
  rejects((d) => { step(d, 'deploy').env = { SKIP_DEPLOY_ON_MISSING_SECRETS: true }; }, 'WORKFLOW_SECRET_EXPOSURE');
  rejects((d) => { step(d, 'deploy').uses = 'Azure/static-web-apps-deploy@v1'; }, 'WORKFLOW_UPLOAD_INVALID');
  rejects((d) => { step(d, 'node').with['node-version'] = '24'; }, 'WORKFLOW_NODE_INVALID');
});
test('least permissions, serialization and provenance are required', () => {
  rejects((d) => { d.permissions.contents = 'write'; }, 'WORKFLOW_PERMISSIONS_INVALID');
  rejects((d) => { d.concurrency['cancel-in-progress'] = true; }, 'WORKFLOW_CONCURRENCY_INVALID');
  rejects((d) => { step(d, 'summary').run = 'echo done'; }, 'WORKFLOW_SUMMARY_INVALID');
  rejects((d) => { step(d, 'summary').env.SOURCE_SHA = 'dev'; }, 'WORKFLOW_SUMMARY_ENV_INVALID');
});
