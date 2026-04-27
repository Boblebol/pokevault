# Security Policy

Pokevault is a local-first application: it runs on your machine, stores data in
local JSON files, and does not require an account or a hosted database.

## Supported Versions

Security fixes target the current `main` branch and the latest tagged release.
Older tags are not maintained as long-term support releases.

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability that could expose local
files, private collection data, or a user's machine.

Use GitHub Security Advisories on the repository when available:

<https://github.com/Boblebol/pokevault/security/advisories/new>

If advisories are unavailable, contact the maintainer through the GitHub profile
linked from the repository and include:

- affected version or commit;
- operating system and Python version;
- reproduction steps;
- impact assessment;
- any suggested fix, if you already have one.

## Scope

In scope:

- local API vulnerabilities that expose or mutate unintended files;
- unsafe import/export behavior;
- dependency vulnerabilities affecting the shipped app;
- Docker image issues that affect normal local use.

Out of scope:

- attacks requiring arbitrary local code execution before Pokevault starts;
- vulnerabilities in third-party services not controlled by this project;
- scraped upstream data inaccuracies without a security impact.

## Disclosure

The maintainer will acknowledge valid reports as quickly as possible, coordinate
a fix privately, and publish the remediation in the changelog once released.
