export type { LogLine, LogSource } from "./types.js";
export { parseLine } from "./log-parser.js";
export { MockLogSource } from "./mock-log-source.js";
export { extractCompleteLines, FileSystemLogSource, PermissionRequiredError } from "./fs-log-source.js";
export type { BlobLike, FileHandleLike, FileLike, PermissionStateLike } from "./fs-log-source.js";
export { RemoteLogSource } from "./remote-log-source.js";
export type { TailResponse } from "./remote-log-source.js";
export { stripAnsi, createProcessLineSplitter, createProcessOutputHandler } from "./process-lines.js";
export type { ProcessLineEntry, ProcessLineSplitter, ProcessOutputHandler, ProcessOutputHandlerOptions, ProcessStreamName, SplitResult } from "./process-lines.js";
export { ProcessLogBuffer, PROCESS_BUFFER_MAX_LINES, PROCESS_BUFFER_MAX_BYTES } from "./process-buffer.js";
export type { ProcessLogSnapshot } from "./process-buffer.js";
export { ProcessLogSource } from "./process-log-source.js";
export type { ProcessLogBatch, ProcessSnapshot, ProcessSnapshotEntry, ProcessLogSourceOptions } from "./process-log-source.js";
export {
  splitArgvAtDashDash,
  spawnPlanForCommand,
  processChildEnv,
  processCommandLabel,
} from "./spawn-args.js";
export type { ProcessArgvSplit, SpawnEnvVars, SpawnPlanForCommand } from "./spawn-args.js";
export { parseEstelaArgv } from "./cli-argv.js";
export type { EstelaCliArgs, EstelaCliArgsResult } from "./cli-argv.js";
export { Correlator, probableRequestForLine, PROBABLE_WINDOW_EXTRA_MS, PROBABLE_ARRIVAL_EXTRA_MS } from "./correlator.js";
export type { CorrelationResult, RequestRecord } from "./correlator.js";
export { executeRequest, MAX_BODY_CHARS, DEFAULT_REQUEST_TIMEOUT_MS } from "./http-client.js";
export type {
  ExecuteRequestOptions,
  HttpRequestInput,
  HttpResponseInfo,
  RequestErrorKind,
} from "./http-client.js";
