export class TimelineSourceParseError extends Error {
  readonly sourceId: string;
  readonly path: string;

  constructor(sourceId: string, path: string, reason: string) {
    super(`${sourceId} ${path}: ${reason}`);
    this.name = "TimelineSourceParseError";
    this.sourceId = sourceId;
    this.path = path;
  }
}
