import { Effect } from "effect";

import {
  ProjectScopeService,
  type ProjectScopeLookup,
  type ProjectStageScope,
} from "./services";
import type { ExternalServiceError, NotFoundError } from "../effect_errors";

/**
 * Finds a project/stage pair through the shared runtime project-scope service.
 *
 * @param payload The project/stage lookup arguments.
 * @returns An Effect that succeeds with the project/stage pair or `null`.
 * @remarks This is the Effect-native optional project-scope lookup entrypoint for domain programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findProjectStageEffect(
  payload: ProjectScopeLookup,
): Effect.Effect<ProjectStageScope | null, ExternalServiceError, ProjectScopeService> {
  return Effect.gen(function* () {
    const projectScope = yield* ProjectScopeService;
    return yield* projectScope.find(payload);
  });
}

/**
 * Requires a project/stage pair through the shared runtime project-scope service.
 *
 * @param payload The project/stage lookup arguments.
 * @returns An Effect that succeeds with the required project/stage pair.
 * @remarks This is the Effect-native required project-scope lookup entrypoint for domain programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireProjectStageEffect(
  payload: ProjectScopeLookup,
): Effect.Effect<ProjectStageScope, ExternalServiceError | NotFoundError, ProjectScopeService> {
  return Effect.gen(function* () {
    const projectScope = yield* ProjectScopeService;
    return yield* projectScope.require(payload);
  });
}
