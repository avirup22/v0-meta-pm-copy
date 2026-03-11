/**
 * Demo / preview data used when the app is running in Demo Mode
 * (no Microsoft bearer token required).
 */

import type {
  DriveItem,
  CustomerWithProjects,
  ProjectDatabase,
  ProjectRow,
  TeamMemberRow,
} from "@/lib/graph"

export const DEMO_TOKEN = "DEMO_MODE"

// ── Customers + Projects ─────────────────────────────────────────────────────

export const DEMO_CUSTOMERS: CustomerWithProjects[] = [
  {
    customer: { id: "cust-pfizer", name: "Pfizer" },
    projects: [
      { id: "proj-pfizer-001", name: "Oncology Launch 2025", folder: { childCount: 5 } },
      { id: "proj-pfizer-002", name: "HCP Digital Engagement", folder: { childCount: 3 } },
      { id: "proj-pfizer-003", name: "Rare Disease Awareness", folder: { childCount: 2 } },
    ],
  },
  {
    customer: { id: "cust-novartis", name: "Novartis" },
    projects: [
      { id: "proj-nov-001", name: "CAR-T Patient Journey", folder: { childCount: 4 } },
      { id: "proj-nov-002", name: "Global Brand Relaunch", folder: { childCount: 6 } },
    ],
  },
  {
    customer: { id: "cust-internal", name: "Internal" },
    projects: [
      { id: "proj-int-001", name: "MetaPM Platform Development", folder: { childCount: 8 } },
      { id: "proj-int-002", name: "Sales Enablement Q3", folder: { childCount: 2 } },
    ],
  },
]

// ── Project Folder lookup by slug ────────────────────────────────────────────

const ALL_PROJECTS: DriveItem[] = DEMO_CUSTOMERS.flatMap((c) => c.projects)

export function getDemoProjectBySlug(slug: string): DriveItem | null {
  return (
    ALL_PROJECTS.find(
      (p) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") === slug
    ) ?? null
  )
}

// ── Project Database ─────────────────────────────────────────────────────────

const DEMO_PROJECT_DB: Record<string, ProjectDatabase> = {
  "proj-pfizer-001": {
    project: {
      Client_Name: "Pfizer",
      Project_Name: "Oncology Launch 2025",
      Project_folder_ID: "proj-pfizer-001",
      Project_Manager: "Sarah Mitchell",
      Start_Date: "01 Jan 2025",
      End_date: "31 Dec 2025",
      Project_status: "Active",
      Project_Type: "Brand Launch",
    },
    internalTeam: [
      { Project_folder_ID: "proj-pfizer-001", Name: "Sarah Mitchell", Email: "s.mitchell@company.com", Designation: "Project Manager" },
      { Project_folder_ID: "proj-pfizer-001", Name: "James Okafor", Email: "j.okafor@company.com", Designation: "Creative Lead" },
      { Project_folder_ID: "proj-pfizer-001", Name: "Priya Sharma", Email: "p.sharma@company.com", Designation: "Medical Writer" },
    ],
    clientTeam: [
      { Project_folder_ID: "proj-pfizer-001", Name: "Dr. Elena Rossi", Email: "e.rossi@pfizer.com", Designation: "Brand Director" },
      { Project_folder_ID: "proj-pfizer-001", Name: "Tom Nguyen", Email: "t.nguyen@pfizer.com", Designation: "Regulatory Affairs" },
    ],
  },
  "proj-pfizer-002": {
    project: {
      Client_Name: "Pfizer",
      Project_Name: "HCP Digital Engagement",
      Project_folder_ID: "proj-pfizer-002",
      Project_Manager: "James Okafor",
      Start_Date: "15 Mar 2025",
      End_date: "15 Sep 2025",
      Project_status: "Active",
      Project_Type: "Digital Campaign",
    },
    internalTeam: [
      { Project_folder_ID: "proj-pfizer-002", Name: "James Okafor", Email: "j.okafor@company.com", Designation: "Project Manager" },
      { Project_folder_ID: "proj-pfizer-002", Name: "Amara Diallo", Email: "a.diallo@company.com", Designation: "UX Designer" },
    ],
    clientTeam: [
      { Project_folder_ID: "proj-pfizer-002", Name: "Linda Chen", Email: "l.chen@pfizer.com", Designation: "Digital Marketing Lead" },
    ],
  },
  "proj-nov-001": {
    project: {
      Client_Name: "Novartis",
      Project_Name: "CAR-T Patient Journey",
      Project_folder_ID: "proj-nov-001",
      Project_Manager: "Priya Sharma",
      Start_Date: "01 Feb 2025",
      End_date: "30 Nov 2025",
      Project_status: "Active",
      Project_Type: "Patient Education",
    },
    internalTeam: [
      { Project_folder_ID: "proj-nov-001", Name: "Priya Sharma", Email: "p.sharma@company.com", Designation: "Project Manager" },
      { Project_folder_ID: "proj-nov-001", Name: "Lucas Ferreira", Email: "l.ferreira@company.com", Designation: "Content Strategist" },
    ],
    clientTeam: [
      { Project_folder_ID: "proj-nov-001", Name: "Dr. Mark Adler", Email: "m.adler@novartis.com", Designation: "Medical Affairs Lead" },
    ],
  },
  "proj-int-001": {
    project: {
      Client_Name: "Internal",
      Project_Name: "MetaPM Platform Development",
      Project_folder_ID: "proj-int-001",
      Project_Manager: "Alex Kim",
      Start_Date: "01 Oct 2024",
      End_date: "30 Jun 2025",
      Project_status: "Active",
      Project_Type: "Internal Product",
    },
    internalTeam: [
      { Project_folder_ID: "proj-int-001", Name: "Alex Kim", Email: "a.kim@company.com", Designation: "Product Owner" },
      { Project_folder_ID: "proj-int-001", Name: "Mei Zhang", Email: "m.zhang@company.com", Designation: "Lead Developer" },
      { Project_folder_ID: "proj-int-001", Name: "Sam Patel", Email: "s.patel@company.com", Designation: "QA Engineer" },
    ],
    clientTeam: [],
  },
}

const DEFAULT_DB: ProjectDatabase = {
  project: null,
  internalTeam: [],
  clientTeam: [],
}

export function getDemoProjectDatabase(projectFolderId: string): ProjectDatabase {
  return DEMO_PROJECT_DB[projectFolderId] ?? DEFAULT_DB
}

// ── Meetings ─────────────────────────────────────────────────────────────────

export const DEMO_MEETINGS: Record<string, {
  id: string
  title: string
  date: string
  organizer: string
  participants: number
  taskCount: number
  decisionCount: number
  riskCount: number
}[]> = {
  "proj-pfizer-001": [
    { id: "mtg-001", title: "Kick-off Workshop", date: "2025-01-15", organizer: "Sarah Mitchell", participants: 8, taskCount: 5, decisionCount: 3, riskCount: 1 },
    { id: "mtg-002", title: "Creative Review Round 1", date: "2025-02-10", organizer: "James Okafor", participants: 5, taskCount: 3, decisionCount: 2, riskCount: 0 },
    { id: "mtg-003", title: "Regulatory Alignment", date: "2025-03-04", organizer: "Dr. Elena Rossi", participants: 6, taskCount: 4, decisionCount: 1, riskCount: 2 },
    { id: "mtg-004", title: "Q1 Status Update", date: "2025-03-28", organizer: "Sarah Mitchell", participants: 10, taskCount: 6, decisionCount: 4, riskCount: 1 },
  ],
  "proj-nov-001": [
    { id: "mtg-101", title: "Discovery Workshop", date: "2025-02-05", organizer: "Priya Sharma", participants: 7, taskCount: 4, decisionCount: 2, riskCount: 1 },
    { id: "mtg-102", title: "Journey Map Review", date: "2025-02-28", organizer: "Dr. Mark Adler", participants: 4, taskCount: 2, decisionCount: 3, riskCount: 0 },
  ],
  "proj-int-001": [
    { id: "mtg-201", title: "Sprint Planning - Sprint 12", date: "2025-03-03", organizer: "Alex Kim", participants: 4, taskCount: 8, decisionCount: 2, riskCount: 0 },
    { id: "mtg-202", title: "Architecture Review", date: "2025-03-10", organizer: "Mei Zhang", participants: 3, taskCount: 3, decisionCount: 5, riskCount: 1 },
    { id: "mtg-203", title: "Demo Day - Sprint 12", date: "2025-03-17", organizer: "Alex Kim", participants: 9, taskCount: 2, decisionCount: 1, riskCount: 0 },
  ],
}
