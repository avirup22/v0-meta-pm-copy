"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { fetchAllCustomersWithProjects, type CustomerWithProjects } from "@/lib/graph"
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
  Building2,
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
  const [customers, setCustomers] = useState<CustomerWithProjects[]>([])
  const [openCustomers, setOpenCustomers] = useState<Set<string>>(new Set())
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Don't render on the login page
  if (pathname === "/") return null
  if (!isAuthenticated) return null

  // Detect if a specific project is open: /projects/[slug] or /projects/[slug]/...
  const projectSlugMatch = pathname.match(/^\/projects\/([^/]+)/)
  const activeProjectSlug = projectSlugMatch ? projectSlugMatch[1] : null

  // Auto-expand the customer that owns the active project
  const activeCustomer = activeProjectSlug
    ? customers.find((c) => c.projects.some((p) => toSlug(p.name) === activeProjectSlug))
    : null

  // Load customers + projects for the sidebar
  const loadProjects = useCallback(async () => {
    if (!token) return
    setLoadingProjects(true)
    try {
      const data = await fetchAllCustomersWithProjects(token)
      setCustomers(data)
      // Auto-open the first customer if none open yet
      if (data.length > 0) {
        setOpenCustomers(new Set([data[0].customer.id]))
      }
    } catch {
      // silently fail in sidebar
    } finally {
      setLoadingProjects(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) loadProjects()
  }, [isAuthenticated, loadProjects])

  // When active project changes, ensure its customer is expanded
  useEffect(() => {
    if (activeCustomer) {
      setOpenCustomers((prev) => new Set([...prev, activeCustomer.customer.id]))
    }
  }, [activeCustomer])

  function toggleCustomer(id: string) {
    setOpenCustomers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

        {/* Projects header link */}
        <NavLink href="/projects" icon={<FolderOpen size={16} strokeWidth={1.8} />} label="Projects" active={pathname === "/projects"} collapsed={collapsed} />

        {/* Customer → Project hierarchy */}
        {!collapsed && (
          <div className="flex flex-col gap-0.5 pl-2">
            {loadingProjects && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Loader2 size={12} className="animate-spin" style={{ color: "var(--nav-muted)" }} />
                <span className="text-xs font-sans" style={{ color: "var(--nav-muted)" }}>Loading...</span>
              </div>
            )}

            {!loadingProjects && customers.map((c) => {
              const isCustomerOpen = openCustomers.has(c.customer.id)
              const hasActiveProject = c.projects.some((p) => toSlug(p.name) === activeProjectSlug)

              return (
                <div key={c.customer.id}>
                  {/* Customer row */}
                  <button
                    onClick={() => toggleCustomer(c.customer.id)}
                    className="w-full flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg text-xs font-sans font-medium transition-colors"
                    style={{
                      color: hasActiveProject ? "var(--nav-fg)" : "var(--nav-muted)",
                      background: hasActiveProject ? "var(--nav-hover-bg)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--nav-hover-bg)"
                    }}
                    onMouseLeave={(e) => {
                      if (!hasActiveProject) (e.currentTarget as HTMLButtonElement).style.background = "transparent"
                    }}
                  >
                    <Building2 size={13} strokeWidth={1.8} className="shrink-0" />
                    <span className="flex-1 text-left truncate">{c.customer.name}</span>
                    <ChevronDown
                      size={11}
                      strokeWidth={2.5}
                      className="shrink-0 transition-transform duration-200"
                      style={{ transform: isCustomerOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                    />
                  </button>

                  {/* Projects under this customer */}
                  {isCustomerOpen && (
                    <div className="flex flex-col gap-0.5 pl-4 mt-0.5">
                      {c.projects.map((p) => {
                        const slug = toSlug(p.name)
                        const href = `/projects/${slug}`
                        const isOpen = slug === activeProjectSlug

                        return (
                          <div key={p.id}>
                            {/* Project row */}
                            <div className="flex items-center rounded-lg">
                              <Link
                                href={href}
                                className="flex items-center gap-2 flex-1 pl-2 pr-1 py-1.5 text-xs font-sans transition-colors truncate rounded-l-lg"
                                style={{
                                  color: isOpen ? "var(--nav-active-fg)" : "var(--nav-muted)",
                                  background: isOpen ? "var(--nav-active-bg)" : "transparent",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isOpen) (e.currentTarget as HTMLAnchorElement).style.background = "var(--nav-hover-bg)"
                                }}
                                onMouseLeave={(e) => {
                                  if (!isOpen) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: isOpen ? "var(--nav-active-fg)" : "var(--nav-muted)" }}
                                />
                                <span className="truncate">{p.name}</span>
                              </Link>
                              <button
                                onClick={() => router.push(href)}
                                className="shrink-0 p-1.5 rounded-r-lg transition-colors"
                                style={{
                                  color: isOpen ? "var(--nav-active-fg)" : "var(--nav-muted)",
                                  background: isOpen ? "var(--nav-active-bg)" : "transparent",
                                }}
                                aria-label={isOpen ? "Collapse project" : "Expand project"}
                              >
                                <ChevronDown
                                  size={11}
                                  strokeWidth={2.5}
                                  className="transition-transform duration-200"
                                  style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                                />
                              </button>
                            </div>

                            {/* Project sub-nav */}
                            {isOpen && (
                              <div className="flex flex-col gap-0.5 pl-4 mt-0.5 mb-1">
                                {PROJECT_NAV.map((item) => {
                                  const subHref = `/projects/${slug}${item.suffix}`
                                  const subActive = pathname === subHref || pathname.startsWith(subHref + "/")
                                  return (
                                    <Link
                                      key={subHref}
                                      href={subHref}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-sans transition-colors"
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
                      })}

                      {/* Create Project under this customer */}
                      <button
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-sans transition-colors"
                        style={{ color: "var(--nav-muted)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--nav-hover-bg)" }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                      >
                        <Plus size={11} strokeWidth={2.5} />
                        New Project
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
