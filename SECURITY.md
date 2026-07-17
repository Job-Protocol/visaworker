# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **security@visaworker.ai** with:

- A description of the issue and the impact you believe it has.
- Steps to reproduce (proof-of-concept code, curl commands, or a minimal
  patch demonstrating the issue).
- Your name/handle if you'd like to be credited.

We aim to acknowledge reports within 3 business days and to ship a fix or a
mitigation plan within 14 days for high-severity issues.

## What's in scope

- The hosted service at `visaworker.ai`.
- Code in this repository — both the open (BUSL) portion and the `ee/`
  directory, even though the latter is proprietary.

## What's out of scope

- Denial of service via traffic volume.
- Findings that require physical access to a user's device.
- Social engineering of VisaWorker staff or customers.
- Missing security headers on marketing pages with no authenticated content.

## Bug bounty

We do not currently run a paid bounty program. We're happy to credit
researchers publicly (with permission) once a fix ships.

## Supported versions

Only the `main` branch of this repository and the current production
deployment of the hosted service receive security fixes. Forks are your own
responsibility.
