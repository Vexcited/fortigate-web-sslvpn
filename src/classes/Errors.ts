export class AccessDeniedSMB extends Error {
  constructor () {
    super("You are not authorized to do this action.");
  }
}

export class WrongCredentials extends Error {
  constructor () {
    super("The credentials provided are wrong.");
  }
}

export class RateLimited extends Error {
  constructor () {
    super("You are being rate limited, try again later.");
  }
}
