import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parseDocument } from 'yaml';

const input = '${{ inputs.source_ref }}';
const defaultBranch = '${{ github.event.repository.default_branch }}';
const token = '${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_LEGENDARY_RIB_CORGI }}';
const normalize = (text) => typeof text === 'string' ? text.trim().replace(/\r\n/g, '\n') : null;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, allowed) => object(value) && Object.keys(value).every((key) => allowed.includes(key));

// Fail closed for executable guards: adding a comment, fallback, or early exit must
// not turn a string-presence check into a successful but unguarded deployment.
const scripts = {
  guard: `set -euo pipefail
[[ "$WORKFLOW_BRANCH" == "$DEFAULT_BRANCH" ]]
[[ "$GITHUB_REF" == "refs/heads/$DEFAULT_BRANCH" ]]
[[ "$SOURCE_REF" == "dev" || "$SOURCE_REF" =~ ^[0-9a-fA-F]{40}$ ]]`,
  source: `set -euo pipefail
SOURCE_SHA="$(git rev-parse HEAD)"
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
if [[ "$SOURCE_REF" != "dev" ]]; then [[ "$SOURCE_SHA" == "\${SOURCE_REF,,}" ]]; fi
git checkout --detach "$SOURCE_SHA"
printf 'sha=%s\\n' "$SOURCE_SHA" >> "$GITHUB_OUTPUT"`,
  install: 'npm ci\nnpm ci --prefix api',
  audit: 'npm audit --audit-level=high',
  test: 'npm run lint\nnpx tsc --noEmit\nnpm run typecheck:api\nnpm run test:cloud\nnpm run test:release-config\nnpm run test:workflow\nnode scripts/check-game-workflow.mjs',
  build: 'npm run build:release -- --mode production',
  verify: 'npm run check:release -- --mode production',
  token: `set -euo pipefail
[[ -n "$SWA_DEPLOY_TOKEN" ]] || { echo 'Deployment token is missing.'; exit 1; }`,
};

export function parseWorkflow(text) {
  try {
    const doc = parseDocument(text, { uniqueKeys: true });
    if (doc.errors.length) throw new Error();
    return doc.toJS({ maxAliasCount: 20 });
  } catch {
    throw new Error('WORKFLOW_YAML_INVALID');
  }
}

export function validateWorkflow(doc) {
  const errors = new Set();
  const check = (valid, code) => { if (!valid) errors.add(code); };
  if (!object(doc)) return ['WORKFLOW_DOCUMENT_INVALID'];
  check(onlyKeys(doc, ['name', 'on', 'permissions', 'concurrency', 'jobs']), 'WORKFLOW_ROOT_UNEXPECTED');
  check(doc.name === 'Deploy legendary-rib-corgi', 'WORKFLOW_NAME_INVALID');
  check(onlyKeys(doc.on, ['workflow_dispatch']) && onlyKeys(doc.on.workflow_dispatch, ['inputs']) &&
    onlyKeys(doc.on.workflow_dispatch.inputs, ['source_ref']), 'WORKFLOW_MANUAL_ONLY');
  const sourceInput = doc.on?.workflow_dispatch?.inputs?.source_ref;
  check(onlyKeys(sourceInput, ['description', 'required', 'default', 'type']) && sourceInput.required === true &&
    sourceInput.default === 'dev' && sourceInput.type === 'string', 'WORKFLOW_SOURCE_INPUT_INVALID');
  check(isDeepStrictEqual(doc.permissions, { contents: 'read' }), 'WORKFLOW_PERMISSIONS_INVALID');
  check(isDeepStrictEqual(doc.concurrency, { group: 'legendary-rib-corgi-production', 'cancel-in-progress': false }), 'WORKFLOW_CONCURRENCY_INVALID');
  check(onlyKeys(doc.jobs, ['build-deploy']), 'WORKFLOW_JOBS_INVALID');
  const job = doc.jobs?.['build-deploy'];
  if (!object(job)) return [...errors, 'WORKFLOW_JOB_MISSING'];
  check(onlyKeys(job, ['if', 'runs-on', 'defaults', 'env', 'steps']) && job.if === "github.repository == 'sejeong223/skill-practice'" &&
    job['runs-on'] === 'ubuntu-latest' && isDeepStrictEqual(job.defaults, { run: { shell: 'bash' } }), 'WORKFLOW_JOB_INVALID');
  const publicEnv = { NEXT_PUBLIC_GAME_MODE: 'cloud' };
  for (const key of ['TENANT_ID', 'WEB_CLIENT_ID', 'API_CLIENT_ID', 'REDIRECT_URI']) {
    publicEnv[`NEXT_PUBLIC_GAME_${key}`] = '${{ vars.GAME_' + key + ' }}';
  }
  check(isDeepStrictEqual(job.env, publicEnv), 'WORKFLOW_PUBLIC_ENV_INVALID');
  if (!Array.isArray(job.steps)) return [...errors, 'WORKFLOW_STEPS_MISSING'];
  const ids = ['guard', 'checkout', 'source', 'node', 'public-config', 'install', 'audit', 'test', 'build', 'verify', 'token', 'deploy', 'summary'];
  check(isDeepStrictEqual(job.steps.map((step) => step?.id), ids), 'WORKFLOW_STEP_ORDER_INVALID');
  const byId = Object.fromEntries(job.steps.filter(object).map((step) => [step.id, step]));
  for (const step of job.steps) {
    check(onlyKeys(step, ['name', 'id', 'env', 'run', 'uses', 'with']), 'WORKFLOW_STEP_BYPASS');
    if (!object(step)) continue;
    const run = step.run ?? '';
    check(typeof run === 'string' && !run.includes('${{'), 'WORKFLOW_SHELL_INTERPOLATION');
    const serialized = JSON.stringify(step);
    check(!/GAME_COSMOS_CLIENT_SECRET|SKIP_DEPLOY_ON_MISSING_SECRETS|set -x|printenv/.test(serialized), 'WORKFLOW_SECRET_EXPOSURE');
    check(!serialized.includes('secrets.') || ['token', 'deploy'].includes(step.id), 'WORKFLOW_SECRET_SCOPE');
    if (!['checkout', 'node', 'deploy'].includes(step.id)) check(!step.uses && !step.with, 'WORKFLOW_UNEXPECTED_ACTION');
    if (!['guard', 'source', 'token', 'summary'].includes(step.id)) check(!step.env, 'WORKFLOW_UNEXPECTED_ENV');
  }
  for (const [id, expected] of Object.entries(scripts)) {
    check(normalize(byId[id]?.run) === expected, `WORKFLOW_${id.toUpperCase()}_INVALID`);
  }
  check(isDeepStrictEqual(byId.guard?.env, { SOURCE_REF: input, WORKFLOW_BRANCH: '${{ github.ref_name }}', DEFAULT_BRANCH: defaultBranch }), 'WORKFLOW_BRANCH_GUARD_INVALID');
  check(isDeepStrictEqual(byId.source?.env, { SOURCE_REF: input }), 'WORKFLOW_SOURCE_ENV_INVALID');
  check(byId.checkout?.uses === 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262' &&
    isDeepStrictEqual(byId.checkout.with, { ref: input, 'persist-credentials': false }) && !byId.checkout.run, 'WORKFLOW_CHECKOUT_INVALID');
  check(byId.node?.uses === 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020' &&
    isDeepStrictEqual(byId.node.with, { 'node-version': '22', cache: 'npm', 'cache-dependency-path': 'package-lock.json\napi/package-lock.json\n' }) && !byId.node.run, 'WORKFLOW_NODE_INVALID');
  const config = normalize(byId['public-config']?.run);
  check(config === `node --input-type=module <<'NODE'
import { appendFileSync } from 'node:fs';
import { publicBuildConfig } from './scripts/game-release-utils.mjs';
const { origin } = publicBuildConfig('production');
appendFileSync(process.env.GITHUB_ENV, 'GAME_EXPECTED_SWA_ORIGIN=' + origin + '\\n');
NODE`, 'WORKFLOW_ORIGIN_INVALID');
  check(isDeepStrictEqual(byId.token?.env, { SWA_DEPLOY_TOKEN: token }), 'WORKFLOW_TOKEN_INVALID');
  check(byId.deploy?.uses === 'Azure/static-web-apps-deploy@1a947af9992250f3bc2e68ad0754c0b0c11566c9' && !byId.deploy.run &&
    isDeepStrictEqual(byId.deploy.with, { azure_static_web_apps_api_token: token, action: 'upload', app_location: 'out',
      output_location: '', api_location: 'build/game-api', skip_app_build: true, skip_api_build: true,
      production_branch: defaultBranch }), 'WORKFLOW_UPLOAD_INVALID');
  check(isDeepStrictEqual(byId.summary?.env, { SOURCE_SHA: '${{ steps.source.outputs.sha }}', WORKFLOW_REF: '${{ github.workflow_ref }}',
    DEPLOY_URL: '${{ steps.deploy.outputs.static_web_app_url }}' }), 'WORKFLOW_SUMMARY_ENV_INVALID');
  const summary = normalize(byId.summary?.run) ?? '';
  check(summary.includes("readFileSync('build/game-release.json', 'utf8')") && summary.includes('manifest.sourceCommit !== process.env.SOURCE_SHA') &&
    summary.includes('process.env.GITHUB_STEP_SUMMARY') && ['manifest.swaOrigin', 'process.env.WORKFLOW_REF', 'process.env.DEPLOY_URL'].every((part) => summary.includes(part)), 'WORKFLOW_SUMMARY_INVALID');
  return [...errors];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const doc = parseWorkflow(readFileSync(process.argv[2] ?? '.github/workflows/deploy-legendary-rib-corgi.yml', 'utf8'));
    const errors = validateWorkflow(doc);
    for (const error of errors) console.error(error);
    if (errors.length) process.exitCode = 1;
    else console.log('WORKFLOW_VALID');
  } catch {
    console.error('WORKFLOW_YAML_INVALID');
    process.exitCode = 1;
  }
}
