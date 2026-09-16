import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

const correlationIdSchema = z.string().uuid();

export interface AuditCorrelation {
  requestId: string;
  runId: string | null;
}

export function createRequestCorrelation(runId: string | null = null): AuditCorrelation {
  return Object.freeze({
    requestId: randomUUID(),
    runId: runId === null ? null : correlationIdSchema.parse(runId),
  });
}

export function createRunCorrelation(): AuditCorrelation {
  return Object.freeze({ requestId: randomUUID(), runId: randomUUID() });
}

