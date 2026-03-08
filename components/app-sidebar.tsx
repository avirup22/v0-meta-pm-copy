"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { fetchProjectFolders, type DriveItem } from "@/lib/graph"
import {
  Home,
  FolderOpen,
  CalendarDays,
  CheckSquare,
  FileText,
  Wrench,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Plus,
  Loader2,
} from "lucide-react"

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

// Sub-nav items only shown when a project is open
const PROJECT_NAV = [
  { label: "Meetings",  suffix: "/meetings",  icon: <CalendarDays size={16} strokeWidth={1.8} /> },
  { label: "Tasks",     suffix: "/tasks",     icon: <CheckSquare  size={16} strokeWidth={1.8} /> },
  { label: "Documents", suffix: "/documents", icon: <FileText     size={16} strokeWidth={1.8} /> },
  { label: "PM Tools",  suffix: "/pm-tools",  icon: <Wrench       size={16} strokeWidth={1.8} /> },
]

const BOTTOM_ITEMS = [
  { label: "Notifications", href: "/notifications", icon: <Bell     size={16} strokeWidth={1.8} /> },
  { label: "Settings",      href: "/settings",      icon: <Settings size={16} strokeWidth={1.8} /> },
]

export function AppSidebar() {
  const { isAuthenticated, displayName, token, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const [collapsed, setCollapsed] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [projects, setProjects] = useState<DriveItem[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Don't render on the login page
  if (pathname === "/") return null
  if (!isAuthenticated) return null

  // Detect if a specific project is open: /projects/[slug] or /projects/[slug]/...
  const projectSlugMatch = pathname.match(/^\/projects\/([^/]+)/)
  const activeProjectSlug = projectSlugMatch ? projectSlugMatch[1] : null

  // Load projects for the sidebar list
  const loadProjects = useCallback(async () => {
    if (!token) return
    setLoadingProjects(true)
    try {
      const folders = await fetchProjectFolders(token)
      setProjects(folders)
    } catch {
      // silently fail in sidebar
    } finally {
      setLoadingProjects(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) loadProjects()
  }, [isAuthenticated, loadProjects])

  function handleLogout() {
    logout()
    router.replace("/")
  }

  const isActive = (href: string) => {
    if (href === "/projects") return pathname.startsWith("/projects")
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-screen sticky top-0 overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? "64px" : "240px",
        background: "var(--nav-bg)",
        borderRight: "1px solid var(--nav-border)",
      }}
      aria-label="Main navigation"
    >
      {/* Logo + collapse button */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0" style={{ borderBottom: "1px solid var(--nav-border)" }}>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight font-sans" style={{ color: "var(--nav-logo)" }}>
            MetaPM
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1.5 transition-colors ml-auto"
          style={{ color: "var(--nav-muted)" }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 flex flex-col gap-0.5 px-2">

        {/* Home */}
        <NavLink href="/projects" icon={<Home size={16} strokeWidth={1.8} />} label="Home" active={pathname === "/projects"} collapsed={collapsed} />

        {/* Projects section */}
        <div>
          <button
            onClick={() => !collapsed && setProjectsOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-sans font-medium transition-colors"
            style={{
              color: isActive("/projects") ? "var(--nav-active-fg)" : "var(--nav-fg)",
              background: isActive("/projects") ? "var(--nav-active-bg)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!isActive("/projects")) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--nav-hover-bg)"
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive("/projects")) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent"
              }
            }}
            aria-expanded={projectsOpen}
          >
            <span className="shrink-0"><FolderOpen size={16} strokeWidth={1.8} /></span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">Projects</span>
                <ChevronDown
                  size={14}
                  className="shrink-0 transition-transform duration-200"
                  style={{ transform: projectsOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </>
            )}
          </button>

          {/* Project list */}
          {!collapsed && projectsOpen && (
            <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
              {loadingProjects && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Loader2 size={12} className="animate-spin" style={{ color: "var(--nav-muted)" }} />
                  <span className="text-xs font-sans" style={{ color: "var(--nav-muted)" }}>Loading...</span>
                </div>
              )}

              {!loadingProjects && (() => {
                // When a project is open, only show the active project + its sub-nav
                // When on the projects list, show all projects
                const visibleProjects = activeProjectSlug
                  ? projects.filter((p) => toSlug(p.name) === activeProjectSlug)
                  : projects

                return visibleProjects.map((p) => {
                  const href = `/projects/${toSlug(p.name)}`
                  const isActiveProject = toSlug(p.name) === activeProjectSlug
                  return (
                    <div key={p.id}>
                      {/* Project row */}
                      <Link
                        href={href}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans transition-colors truncate"
                        style={{
                          color: isActiveProject ? "var(--nav-active-fg)" : "var(--nav-muted)",
                          background: isActiveProject ? "var(--nav-active-bg)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActiveProject) (e.currentTarget as HTMLAnchorElement).style.background = "var(--nav-hover-bg)"
                        }}
                        onMouseLeave={(e) => {
                          if (!isActiveProject) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"
                        }}
                      >
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ background: isActiveProject ? "var(--nav-active-fg)" : "var(--nav-muted)" }} />
                        {p.name}
                      </Link>

                      {/* Sub-nav indented under active project */}
                      {isActiveProject && (
                        <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
                          {PROJECT_NAV.map((item) => {
                            const subHref = `/projects/${activeProjectSlug}${item.suffix}`
                            const subActive = pathname === subHref || pathname.startsWith(subHref + "/")
                            return (
                              <Link
                                key={subHref}
                                href={subHref}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans transition-colors"
                                style={{
                                  color: subActive ? "var(--nav-active-fg)" : "var(--nav-muted)",
                                  background: subActive ? "var(--nav-active-bg)" : "transparent",
                                }}
                                onMouseEnter={(e) => {
                                  if (!subActive) (e.currentTarget as HTMLAnchorElement).style.background = "var(--nav-hover-bg)"
                                }}
                                onMouseLeave={(e) => {
                                  if (!subActive) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"
                                }}
                              >
                                <span className="shrink-0">{item.icon}</span>
                                {item.label}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}

              {/* Create project — only shown when no project is open */}
              {!activeProjectSlug && (
                <button
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans transition-colors"
                  style={{ color: "var(--nav-muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--nav-hover-bg)"
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent"
                  }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Create Project
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom: user + settings */}
      <div className="shrink-0 py-3 px-2 flex flex-col gap-0.5" style={{ borderTop: "1px solid var(--nav-border)" }}>
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} collapsed={collapsed} />
        ))}

        {/* User + logout */}
        <div className="flex items-center gap-3 px-3 py-2 mt-1 rounded-lg" style={{ background: "var(--nav-hover-bg)" }}>
          <div
            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold font-sans"
            style={{ background: "var(--nav-active-fg)", color: "var(--nav-bg)" }}
          >
            {displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 text-xs font-sans truncate" style={{ color: "var(--nav-fg)" }}>
                {displayName}
              </span>
              <button
                onClick={handleLogout}
                className="rounded p-1 transition-colors"
                style={{ color: "var(--nav-muted)" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = "var(--nav-fg)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = "var(--nav-muted)"}
                aria-label="Logout"
              >
                <LogOut size={14} strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

// Reusable nav link item
function NavLink({
  href, icon, label, active, collapsed,
}: {
  href: string; icon: React.ReactNode; label: string; active: boolean; collapsed: boolean
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-sans font-medium transition-colors"
      style={{
        color: active ? "var(--nav-active-fg)" : "var(--nav-fg)",
        background: active ? "var(--nav-active-bg)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "var(--nav-hover-bg)"
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"
      }}
      title={collapsed ? label : undefined}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
