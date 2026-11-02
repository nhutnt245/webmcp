---
title: WebMCP demo knowledge
description: Entry point for the shared task and three browser drivers.
date: 2026-11-02
---

# WebMCP demo

This repository compares three drivers against a session-only todo page
([demo/index.html](../../../demo/index.html):10,
[demo/app.js](../../../demo/app.js):3).

Compile notes just in time when implementation work establishes a useful fact;
this is not a parallel specification. Authority order: executable files under
`demo/`, `computer-use/`, `playwright/`, `webmcp/`, and `scripts/` first; referenced
upstream API documentation second; these notes third; session memory last.

| Folder | Entry | Purpose |
| --- | --- | --- |
| Root wiki | [Driver boundaries](drivers.md) | Shared state, transport, and verification pointers |

Notes use `title`, `description`, and `date` frontmatter. Register every note in
its folder index, cross-link related notes, cite source as `path:line`, and mark
unverified claims `UNVERIFIED`. Never link local raw notes. Updates carry an
`Updated YYYY-MM-DD` marker.
