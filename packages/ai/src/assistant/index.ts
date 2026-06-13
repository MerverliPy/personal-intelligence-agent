// ---------------------------------------------------------------------------
// Assistant orchestration barrel exports (P3-T05)
// ---------------------------------------------------------------------------

export { AssistantOrchestrator } from './orchestrator.js';
export { mapDbRoleToGateway, mapGatewayRoleToDb } from './role-mapping.js';
export type {
  OrchestratorSseEvent,
  OrchestratorRunOptions,
  AssistantOrchestratorConfig,
  SseRunStartedEvent,
  SseResponseDeltaEvent,
  SseCitationProvisionalEvent,
  SseApprovalRequiredEvent,
  SseResponseCompletedEvent,
  SseRunFailedEvent,
} from './types.js';
