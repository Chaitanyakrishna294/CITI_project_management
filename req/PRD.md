
# Document 1

# PRODUCT REQUIREMENTS DOCUMENT

---

# 1. Document Information

| Field         | Value                            |
| ------------- | -------------------------------- |
| Project Name  | CITI Project Management Platform |
| Version       | 1.0                              |
| Document Type | Product Requirements Document    |
| Prepared By   | Engineering Team                 |
| Status        | Draft                            |
| Date          | July 2026                        |

---

# 2. Executive Summary

## Purpose

CITI Inc. currently manages projects across multiple departments using disconnected tools such as spreadsheets, emails, and individual tracking systems. This fragmented approach makes it difficult for project managers and stakeholders to monitor project progress, allocate resources effectively, manage budgets, and predict delivery timelines.

The purpose of this project is to build a centralized Project Management Platform that provides a single source of truth for project planning, execution, tracking, and reporting. The platform enables project managers, contributors, and executives to collaborate efficiently while improving project visibility, accountability, and delivery performance.

---

# 3. Problem Statement

## Current Situation

Project information is distributed across multiple systems and documents.

Common challenges include:

* Lack of centralized project visibility
* Difficulty tracking deliverable progress
* Manual resource allocation
* Budget overspending
* Missed project deadlines
* Limited reporting capabilities
* No standardized workflow across departments

These issues reduce operational efficiency and increase project delivery risk.

---

# 4. Product Vision

To provide CITI Inc. with a secure, scalable, and user-friendly project management platform that enables teams to plan, execute, monitor, and deliver projects efficiently while providing real-time operational insights to management.



# 5. Business Objectives

The Project Management Platform aims to provide CITI Inc. with centralized visibility and control over project execution, resource utilization, and financial performance. The system should enable stakeholders to make informed decisions through real-time project insights.

### BO-01: Centralized Project Visibility

Provide a unified dashboard that displays the current status of all active projects, allowing stakeholders to monitor progress, health, and overall project performance from a single platform.

### BO-02: Project Risk Identification

Identify projects that are at risk of missing their planned deadlines by monitoring schedule progress, milestone completion, and project health indicators.

### BO-03: Resource Allocation Management

Provide complete visibility into how human resources are allocated across multiple projects, enabling managers to balance workloads and optimize team utilization.

### BO-04: Deliverable Tracking

Track all project deliverables throughout their lifecycle, including ownership, due dates, dependencies, and completion status, ensuring transparency across project execution.

### BO-05: Resource Capacity Monitoring

Detect team members who are over-allocated or assigned beyond their available capacity across multiple projects, helping managers prevent burnout and scheduling conflicts.

### BO-06: Dependency Management

Visualize and manage dependency relationships between project deliverables to identify critical paths, potential bottlenecks, and cascading impacts caused by delays.

### BO-07: Budget Monitoring and Financial Visibility

Monitor planned budgets against actual expenditures for each project, providing real-time visibility into budget utilization, remaining funds, and potential cost overruns.

### BO-08: Improve Decision-Making

Provide project managers and executives with real-time dashboards, reports, and analytics that support faster and more informed operational and strategic decisions.

### BO-09: Increase Delivery Predictability

Reduce project delays and improve delivery confidence through continuous monitoring of project progress, resource availability, dependencies, and budget performance.

### BO-10: Standardize Project Management

Establish a consistent project management process across all departments by centralizing project planning, execution, monitoring, and reporting within a single platform.



| Business Objective                     | Product Feature                        |
| -------------------------------------- | -------------------------------------- |
| BO-01 Centralized Project Visibility   | Executive Dashboard, Project Dashboard |
| BO-02 Project Risk Identification      | Risk Engine, Deadline Monitoring       |
| BO-03 Resource Allocation Management   | Resource Allocation Module             |
| BO-04 Deliverable Tracking             | Deliverables Module                    |
| BO-05 Resource Capacity Monitoring     | Workload Dashboard                     |
| BO-06 Dependency Management            | Dependency Graph & Timeline            |
| BO-07 Budget Monitoring                | Budget Tracking Module                 |
| BO-08 Improve Decision-Making          | Analytics & Reports                    |
| BO-09 Increase Delivery Predictability | Health Indicators & Alerts             |
| BO-10 Standardize Project Management   | Unified Project Workspace              |



# 6. Success Metrics (KPIs)

| KPI                           | Target        |
| ----------------------------- | ------------- |
| Projects tracked digitally    | 100%          |
| Manual reporting effort       | Reduce by 70% |
| Resource allocation conflicts | Reduce by 50% |
| Missed deadlines              | Reduce by 40% |
| Dashboard loading time        | <2 seconds    |
| API response time             | <500 ms       |
| System availability           | 99.9%         |

---


## 7. Stakeholders

| Stakeholder              | Responsibilities                                                                                                             | Primary Goals                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Executive Management** | Monitor organizational project performance, review strategic KPIs, identify project risks, and make business decisions.      | Gain organization-wide visibility into project health, delivery performance, resource utilization, and budget status. |
| **Project Manager**      | Create and manage projects, assign resources, monitor deliverables, track budgets, and oversee project execution.            | Successfully deliver projects on time, within budget, and according to scope.                                         |
| **Team Members**         | Execute assigned project tasks, update deliverable progress, report blockers, and collaborate with project managers.         | Complete assigned work efficiently while maintaining accurate project status updates.                                 |
| **Finance Team**         | Monitor project budgets, track planned versus actual expenditure, review financial performance, and support budget planning. | Ensure projects remain within approved budgets and provide financial transparency.                                    |
| **System Administrator** | Manage user accounts, roles, permissions, system configuration, security settings, and overall platform maintenance.         | Maintain a secure, reliable, and well-managed application environment while ensuring authorized access.               |

### Stakeholder Influence Matrix

| Stakeholder          | Interest | Influence |
| -------------------- | -------- | --------- |
| Executive Management | High     | High      |
| Project Manager      | High     | High      |
| Team Members         | High     | Medium    |
| Finance Team         | Medium   | Medium    |
| System Administrator | High     | High      |

---

# 8. User Personas

## Persona 1 — Project Manager

### Goals

* Create projects
* Assign resources
* Monitor deliverables
* Track deadlines
* Review budget

### Pain Points

* Multiple spreadsheets
* Manual reporting
* No live dashboard

---

## Persona 2 — Team Member

### Goals

* View assigned work
* Update deliverables
* Track deadlines

Pain Points

* Unclear priorities
* No centralized task tracking

---

## Persona 3 — Executive

Goals

* Monitor all projects
* Review KPIs
* Identify project risks

Pain Points

* Delayed reports
* Limited project visibility

---

## Persona 4 — Administrator

Goals

* Manage users
* Configure roles
* Maintain platform

---

# 9. User Roles

| Role            | Permissions                  |
| --------------- | ---------------------------- |
| Admin           | Full System Access           |
| Project Manager | Manage assigned projects     |
| Contributor     | Update assigned deliverables |
| Viewer          | Read-only access             |

---

# 10. Project Scope

## In Scope

* Authentication
* User Management
* Project Management
* Deliverables
* Resource Allocation
* Budget Tracking
* Dashboard
* Search
* Filters
* Reports
* Responsive UI

---

## Out of Scope

* Email notifications
* Mobile application
* AI forecasting
* External ERP integrations
* Payroll management
* Time tracking
* Chat system

---

# 11. Functional Requirements

## Authentication

* User Login
* Logout
* JWT Authentication
* Role Management

---

## Project Management

* Create Project
* Edit Project
* Delete Project
* Archive Project

---

## Deliverables

* Create
* Assign
* Update Status
* Delete

---

## Resource Management

* Add Resource
* Assign Resource
* Track Allocation

---

## Budget Management

* Planned Budget
* Actual Spend
* Remaining Budget

---

## Dashboard

Display

* Active Projects
* Completed Projects
* Delayed Projects
* Budget Summary
* Resource Utilization
* Deliverable Status

---

## Search

Search by

* Project
* Resource
* Deliverable

---

## Filters

* Status
* Manager
* Budget
* Date
* Department

---

# 12. Non-Functional Requirements

### Performance

Dashboard loads within two seconds.

---

### Security

JWT Authentication

Password Hashing

RBAC

HTTPS

---

### Reliability

99.9% uptime.

---

### Scalability

Support future organizational growth.

---

### Accessibility

WCAG-compliant UI.

---

### Responsiveness

Desktop

Tablet

Mobile

---

# 13. Business Rules

* Every project must have one project manager.
* A deliverable belongs to exactly one project.
* Budget cannot be negative.
* Only managers can archive projects.
* Contributors cannot delete projects.
* Viewers cannot modify data.
* Closed projects cannot receive new deliverables.

---

# 14. User Stories

### US-01

As a Project Manager,

I want to create a project,

so that I can manage its lifecycle.

---

### US-02

As a Team Member,

I want to update deliverables,

so that project progress remains current.

---

### US-03

As an Executive,

I want to view dashboards,

so that I can monitor project health.

---

# 15. Acceptance Criteria

Example

Project Creation

Given a logged-in Project Manager

When valid project details are submitted

Then

* Project is created
* Data is stored
* Success message displayed
* Dashboard updates automatically

---

# 16. Assumptions

* Users have internet access.
* Organization provides authenticated users.
* PostgreSQL database is available.
* AWS infrastructure is operational.

---

# 17. Constraints

* React frontend
* Python backend
* PostgreSQL database
* AWS deployment
* Material UI components
* GitHub version control

(These align with the workshop requirements.)

---

# 18. Risks

| Risk                    | Mitigation                                 |
| ----------------------- | ------------------------------------------ |
| Database downtime       | Connection retry and backups               |
| Authentication failures | JWT validation and secure password hashing |
| Resource conflicts      | Allocation validation                      |
| Missed deadlines        | Dashboard alerts and status indicators     |
| Budget inconsistencies  | Validation rules and transaction integrity |

---

# 19. Future Enhancements

* Email and push notifications
* Gantt charts
* AI-based project risk prediction
* Calendar integration
* File attachments
* Activity timeline
* Audit logs
* Real-time collaboration
* Mobile application
* Third-party integrations (Jira, Slack, Microsoft Teams)

---

# 20. Glossary

| Term        | Definition                                                         |
| ----------- | ------------------------------------------------------------------ |
| Project     | A planned initiative with defined objectives, timeline, and budget |
| Deliverable | A measurable output within a project                               |
| Resource    | A person assigned to project work                                  |
| Allocation  | The percentage of a resource's capacity assigned to projects       |
| RBAC        | Role-Based Access Control                                          |
| KPI         | Key Performance Indicator                                          |

---
