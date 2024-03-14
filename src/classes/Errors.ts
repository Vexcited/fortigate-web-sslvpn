export class AccessDeniedSMB extends Error {
  constructor () {
    super("You are not authorized to do this action.");
  }
}
