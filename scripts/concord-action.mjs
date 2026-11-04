import { WorkspaceManager } from 'file:///C:/Users/kelvi/AppData/Local/nvm/v24.19.0/node_modules/@concord-ai/concord-mcp/dist/workspaces/manager.js';
import { handleUpdateWork, handleTransferWork, handleFinishWork } from 'file:///C:/Users/kelvi/AppData/Local/nvm/v24.19.0/node_modules/@concord-ai/concord-mcp/dist/tools/workflow.js';
import { SocketAgentMessageDispatcher } from 'file:///C:/Users/kelvi/AppData/Local/nvm/v24.19.0/node_modules/@concord-ai/concord-mcp/dist/relay/socket-dispatcher.js';
import { randomUUID } from 'node:crypto';

const action = process.argv[2];
const workspaceManager = WorkspaceManager.fromEnvironment('C:/Renaissance/Portfolio/orivox', process.env);
const repos = workspaceManager.current().repos;
const dispatcher = new SocketAgentMessageDispatcher();

if (action === 'accept-task') {
  const taskId = process.argv[3] || 'ORIVOX-M2-RENDERER';
  const task = repos.tasks.get(taskId);
  console.log('Current task:', task?.taskId, 'status:', task?.status, 'version:', task?.version, 'assignedTo:', task?.assignedAgentId);
  const result = handleTransferWork(repos, {
    action: 'accept',
    task_id: taskId,
    agent_id: 'antigravity:914edeee',
    expected_version: task.version,
  });
  console.log('Accept result:', result);
} else if (action === 'finish') {
  const taskId = process.argv[3] || 'ORIVOX-M2-RENDERER';
  const task = repos.tasks.get(taskId);
  console.log('Finishing task:', task?.taskId, 'version:', task?.version);
  const result = handleFinishWork(repos, {
    task_id: taskId,
    agent_id: 'antigravity:914edeee',
    expected_version: task.version,
    outcome: 'review_ready',
    what_changed: 'Implemented Milestone 2 live cloud transcription consent and transcript stream UI. Created reusable LiveTranscript component with per-source connection badges, source labeling (Microphone vs System Audio), smart auto-scroll with manual preservation, and polite aria-live region. Built M2 Deepgram Nova-3 cloud consent selector and disclosures with exact pricing ($0.0077/min/source) and opt-out retention terms. Mirrored transcript turns in collapsible side dock. Updated legacy SessionSetup.tsx and Navigation copy. Added comprehensive tests in App.test.tsx covering all M2 UI flows.',
    changed_files: [
      'src/renderer/App.tsx',
      'src/renderer/App.test.tsx',
      'src/renderer/components/LiveTranscript.tsx',
      'src/renderer/components/Navigation.tsx',
      'src/renderer/components/SessionSetup.tsx',
      'src/renderer/components/SideDock.tsx',
      'src/renderer/components/views/HomeView.tsx',
      'src/renderer/components/views/LiveSessionView.tsx',
      'src/renderer/styles.css',
      'src/shared/contracts.ts',
      'src/shared/fixtures.ts',
    ],
    tests_run: [
      'npm test: 63 passed across 8 test suites (including 27 renderer UI and M2 transcript tests)',
      'npm run typecheck: passed for node and web configurations',
      'npm run build: electron-vite production bundle compiled successfully',
    ],
    known_risks: [
      'Controlled Windows testing with live Deepgram WebSocket connection requires user-supplied DEEPGRAM_API_KEY in environment, managed strictly by Electron Main.',
      'Network disconnections will trigger exponential retry and reconnecting state in UI until connection is restored or session stopped.',
    ],
    assumptions: [
      'Main process manages Deepgram WebSocket streams with mip_opt_out=true and API key protection.',
      'Bridge publishes transcript.interim as complete current hypothesis and transcript.final as immutable utterance.',
    ],
    decisions: [
      'Separated M1 local capture consent from M2 cloud transcription consent.',
      'Polite aria-live region applied only to completed turns; interim hypotheses are displayed with visual pulse but excluded from screen reader noise.',
      'Auto-scroll preserves scroll position if user scrolls up to review prior turns.',
    ],
    guardrails_checked: [
      'No raw audio persistence or storage on disk or database.',
      'No cloud audio frames transmitted without explicit per-session M2 cloud consent.',
      'Pure M1 local capture remains fully functional when cloud transcription is off.',
    ],
    provenance: [
      { field: 'renderer', source: 'Antigravity pair-programming' },
      { field: 'shared-contracts', source: 'Concord agreement with codex:fc177949' },
    ],
  });
  console.log('Finish result:', result);
} else if (action === 'reply') {
  const replyToId = process.argv[3];
  const content = process.argv[4];
  const result = handleUpdateWork(repos, {
    operation: 'reply',
    agent_id: 'antigravity:914edeee',
    reply_to_message_id: replyToId,
    content,
    idempotency_key: 'reply-' + randomUUID(),
  }, dispatcher);
  console.log('Reply result:', result);
} else if (action === 'prompt') {
  const toAgentId = process.argv[3];
  const taskId = process.argv[4];
  const content = process.argv[5];
  const result = handleUpdateWork(repos, {
    operation: 'prompt',
    agent_id: 'antigravity:914edeee',
    to_agent_id: toAgentId,
    task_id: taskId,
    content,
    idempotency_key: 'prompt-' + randomUUID(),
  }, dispatcher);
  console.log('Prompt result:', result);
}
