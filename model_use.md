

# Model Selection Guide

| Task                                  | Model    | Effort |
| ------------------------------------- | -------- | ------ |
| Product Requirements Document (PRD)   | Opus 4.8 | High   |
| Technical Requirements Document (TRD) | Opus 4.8 | High   |
| System Architecture                   | Opus 4.8 | High   |
| Database Design                       | Opus 4.8 | High   |
| ER Diagrams                           | Opus 4.8 | High   |
| Complex Backend Logic                 | Opus 4.8 | High   |
| Security Design                       | Opus 4.8 | High   |
| Code Review                           | Opus 4.8 | High   |
| Refactoring Large Projects            | Opus 4.8 | High   |
| Performance Optimization              | Opus 4.8 | High   |

---

## Everyday Development

| Task              | Model    | Effort |
| ----------------- | -------- | ------ |
| React Development | Sonnet 5 | Medium |
| FastAPI Backend   | Sonnet 5 | Medium |
| Express.js        | Sonnet 5 | Medium |
| REST APIs         | Sonnet 5 | Medium |
| SQL Queries       | Sonnet 5 | Medium |
| CRUD Operations   | Sonnet 5 | Medium |
| Authentication    | Sonnet 5 | Medium |
| UI Components     | Sonnet 5 | Medium |
| Bug Fixing        | Sonnet 5 | Medium |
| Unit Tests        | Sonnet 5 | Medium |
| API Integration   | Sonnet 5 | Medium |

---

## Small Tasks

| Task                | Model | Effort |
| ------------------- | ----- | ------ |
| Git Commands        | Haiku | Low    |
| Shell Scripts       | Haiku | Low    |
| Docker Commands     | Haiku | Low    |
| YAML                | Haiku | Low    |
| JSON                | Haiku | Low    |
| Markdown Formatting | Haiku | Low    |
| Regex               | Haiku | Low    |
| Linux Commands      | Haiku | Low    |
| Windows PowerShell  | Haiku | Low    |

---

# Effort Levels

## Low

Use when the task requires little reasoning.

Examples

* Rename files
* Bash scripts
* Git commands
* Fix formatting
* JSON
* YAML
* Docker Compose
* Markdown
* PowerShell

---

## Medium

Use when writing or modifying code.

Examples

* CRUD APIs
* React Components
* FastAPI
* Database Queries
* API Integration
* Authentication
* Unit Tests
* Small Refactoring

---

## High

Use when the model must think deeply.

Examples

* System Design
* Architecture
* Database Normalization
* Multi-file Refactoring
* Security Analysis
* Performance Analysis
* Technical Documentation
* PRDs
* Design Decisions
* Complex Algorithms

---

# My Recommended Workflow

```text
Planning
↓
Opus 4.8 (High)

Architecture
↓
Opus 4.8 (High)

Database Design
↓
Opus 4.8 (High)

Backend Development
↓
Sonnet 5 (Medium)

Frontend Development
↓
Sonnet 5 (Medium)

Testing
↓
Sonnet 5 (Medium)

Deployment Scripts
↓
Haiku (Low)

Git / Shell / Docker
↓
Haiku (Low)

Documentation Updates
↓
Sonnet 5 (Medium)

Final Architecture Review
↓
Opus 4.8 (High)
```

## For your current project

Since you're building a **Project Management Platform** with React, FastAPI, PostgreSQL, and AWS, I'd use this split:

* **Opus 4.8 (High):** PRD, TRD, application flow, database schema, architecture decisions, complex SQL, security review, and final code review.
* **Sonnet 5 (Medium):** The majority of implementation work—React components, FastAPI endpoints, business logic, API integration, tests, and documentation updates.
* **Haiku (Low):** Git commands, shell/PowerShell scripts, Docker files, Terraform/YAML snippets, Markdown formatting, and other repetitive utilities.

This gives you the best balance of quality, speed, and cost without using Opus for tasks that Sonnet or Haiku can handle just as well.
