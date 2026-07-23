

# Application Flow Document


# 1. Introduction

## Purpose

This document defines the complete functional flow of the CITI Project Management Platform. It describes how users navigate through the application, interact with various modules, and complete business processes. The application flow serves as a blueprint for developers, designers, testers, and stakeholders by illustrating the sequence of user interactions, system responses, and business logic.

---

# 2. Application Navigation Flow

The following diagram represents the high-level navigation structure of the application.

```text
Login
   │
   ▼
Dashboard
   │
   ├──────────────► Projects
   │                    │
   │                    ▼
   │             Project Details
   │                    │
   │     ┌──────────────┼─────────────┐
   │     ▼              ▼             ▼
   │ Deliverables   Resources     Budget
   │
   ▼
Reports
   │
   ▼
Administration
```

---

# 3. User Authentication Flow

```text
User Opens Application
        │
        ▼
Login Screen
        │
        ▼
Enter Credentials
        │
        ▼
Validate Credentials
        │
 ┌──────┴────────┐
 │               │
Valid         Invalid
 │               │
 ▼               ▼
Generate JWT   Show Error
 │
 ▼
Load Dashboard
```

### System Actions

* Validate email and password.
* Authenticate user.
* Generate JWT access token.
* Retrieve user role.
* Redirect to Dashboard.
* Load role-specific permissions.

---

# 4. Dashboard Flow

```text
Dashboard
     │
     ▼
Load Dashboard Data
     │
     ├── Active Projects
     ├── Budget Summary
     ├── Resource Utilization
     ├── Deliverable Status
     ├── Upcoming Deadlines
     └── Risk Indicators
```

Dashboard provides an executive summary of the entire system.

Users can navigate directly into any module.

---

# 5. Project Management Flow

## Create Project

```text
Dashboard
     │
     ▼
Projects
     │
     ▼
Create Project
     │
     ▼
Enter Project Details
     │
     ▼
Validate Inputs
     │
 ┌────┴────┐
 │         │
Valid    Invalid
 │         │
 ▼         ▼
Save     Show Errors
 │
 ▼
Project Created
 │
 ▼
Dashboard Updated
```

---

## Edit Project

```text
Projects
     │
     ▼
Select Project
     │
     ▼
Edit Details
     │
     ▼
Validate
     │
     ▼
Save Changes
```

---

## Delete Project

```text
Project Details
      │
      ▼
Delete
      │
      ▼
Confirmation Dialog
      │
      ▼
Delete Record
      │
      ▼
Refresh List
```

---

# 6. Deliverable Management Flow

```text
Project Details
      │
      ▼
Deliverables
      │
      ▼
Create Deliverable
      │
Assign Owner
      │
Set Due Date
      │
Save
      │
Track Status
      │
Completed
```

Deliverable Status

* Not Started
* In Progress
* Blocked
* Completed

---

# 7. Resource Management Flow

```text
Resources
      │
      ▼
Select Resource
      │
      ▼
Assign Project
      │
      ▼
Allocation %
      │
      ▼
Save
      │
      ▼
Update Capacity
```

System validates:

* Maximum allocation
* Duplicate assignments
* Availability

---

# 8. Budget Management Flow

```text
Project
    │
    ▼
Budget
    │
    ▼
Planned Budget
    │
    ▼
Record Expenses
    │
    ▼
Actual Spend
    │
    ▼
Remaining Budget
```

Dashboard updates automatically.

---

# 9. Search & Filter Flow

```text
Search Bar
      │
      ▼
Enter Keyword
      │
      ▼
Apply Filters
      │
      ▼
Retrieve Matching Records
      │
      ▼
Display Results
```

Supported filters

* Status
* Department
* Project Manager
* Budget
* Date Range

---

# 10. User Management Flow (Admin)

```text
Administration
       │
       ▼
Users
       │
       ▼
Create User
       │
Assign Role
       │
Activate
       │
Save
```

Roles

* Admin
* Project Manager
* Team Member
* Finance
* Viewer

---

# 11. Error Handling Flow

```text
User Action
      │
      ▼
Validation
      │
 ┌────┴────┐
 │         │
Success   Failure
 │         │
 ▼         ▼
Continue  Display Error
```

Example

Invalid Budget

↓

Display

```
Budget cannot be negative.
```

---

# 12. Logout Flow

```text
Logout
   │
   ▼
Invalidate Token
   │
   ▼
Clear Session
   │
   ▼
Redirect Login
```

---

# 13. Complete End-to-End Business Flow

This is the most important diagram in the document.

```text
Login
   │
   ▼
Dashboard
   │
   ▼
Create Project
   │
   ▼
Assign Project Manager
   │
   ▼
Create Deliverables
   │
   ▼
Assign Team Members
   │
   ▼
Allocate Resources
   │
   ▼
Assign Budget
   │
   ▼
Track Progress
   │
   ▼
Update Deliverables
   │
   ▼
Monitor Dashboard
   │
   ▼
Generate Reports
   │
   ▼
Close Project
```

---

# Business Flow Mapping

One thing I would add—which most people miss—is a traceability table that connects the business objectives from the PRD to the application flows.

| Business Objective                 | Application Flow            |
| ---------------------------------- | --------------------------- |
| View project status                | Dashboard Flow              |
| Identify projects at risk          | Dashboard + Project Details |
| Resource allocation                | Resource Management Flow    |
| Track deliverables                 | Deliverable Management Flow |
| Detect over-allocated team members | Resource Management Flow    |
| View dependency chain              | Deliverable Management Flow |
| Track budget consumption           | Budget Management Flow      |
