"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { fetchAllCustomersWithProjects, type CustomerWithProjects } from "@/lib/graph"
import { NewProjectModal } from "@/components/new-project-modal"
import {
  Home,
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
  Layers,
  FlaskConical,
} from "lucide-react"
import { DEMO_TOKEN, DEMO_CUSTOMERS } from "@/lib/demo-data"

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-")
}

const PROJECT_NAV = [
  { label: "Meetings",  suffix: "/meetings",  icon: <CalendarDays size={14} strokeWidth={2} /> },
  { label: "Tasks",     suffix: "/tasks",     icon: <CheckSquare  size={14} strokeWidth={2} /> },
  { label: "Documents", suffix: "/documents", icon: <FileText     size={14} strokeWidth={2} /> },
  { label: "PM Tools",  suffix: "/pm-tools",  icon: <Wrench       size={14} strokeWidth={2} /> },
]

const BOTTOM_ITEMS = [
  { label: "Notifications", href: "/notifications", icon: <Bell     size={15} strokeWidth={2} /> },
  { label: "Settings",      href: "/settings",      icon: <Settings size={15} strokeWidth={2} /> },
]

export function AppSidebar() {
  const { isAuthenticated, displayName, token, isDemoMode, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const [collapsed, setCollapsed] = useState(false)
  const [customers, setCustomers] = useState<CustomerWithProjects[]>([])
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null)
  const [openProjectSlug, setOpenProjectSlug] = useState<string | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [newProjectModal, setNewProjectModal] = useState<{ open: boolean; customerId: string; customerName: string } | null>(null)

  if (pathname === "/") return null
  if (!isAuthenticated) return null

  const projectSlugMatch = pathname.match(/^\/projects\/([^/]+)/)
  const activeProjectSlug = projectSlugMatch ? projectSlugMatch[1] : null

  const activeCustomer = activeProjectSlug
    ? customers.find((c) => c.projects.some((p) => toSlug(p.name) === activeProjectSlug))
    : null

  const loadProjects = useCallback(async () => {
    if (!token) return
    setLoadingProjects(true)
    try {
      const data = token === DEMO_TOKEN
        ? DEMO_CUSTOMERS
        : await fetchAllCustomersWithProjects(token)
      setCustomers(data)
      if (data.length > 0) setOpenCustomerId(data[0].customer.id)
    } catch {
      // silently fail
    } finally {
      setLoadingProjects(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) loadProjects()
  }, [isAuthenticated, loadProjects])

  useEffect(() => {
    if (activeCustomer) setOpenCustomerId(activeCustomer.customer.id)
    if (activeProjectSlug) setOpenProjectSlug(activeProjectSlug)
  }, [activeCustomer, activeProjectSlug])

  function toggleCustomer(id: string) {
    setOpenCustomerId((prev) => (prev === id ? null : id))
  }

  function toggleProject(slug: string) {
    setOpenProjectSlug((prev) => (prev === slug ? null : slug))
  }

  function handleLogout() {
    logout()
    router.replace("/")
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-screen sticky top-0 overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? "60px" : "236px",
        background: "var(--nav-bg)",
        borderRight: "1px solid var(--nav-border)",
      }}
      aria-label="Main navigation"
    >
      {/* ── Logo bar ── */}
      <div
        className="flex items-center h-14 shrink-0 px-4"
        style={{ borderBottom: "1px solid var(--nav-border)" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 flex-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--primary)" }}
            >
              <Layers size={14} strokeWidth={2.5} color="white" />
            </div>
            <span className="text-[15px] font-black tracking-tight font-sans" style={{ color: "var(--nav-logo)" }}>
              MetaPM
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
          style={{ color: "var(--nav-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--nav-hover-bg)" }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ── Scrollable nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 flex flex-col gap-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* Home */}
        <SidebarLink
          href="/projects"
          icon={<Home size={15} strokeWidth={2} />}
          label="Home"
          active={pathname === "/projects"}
          collapsed={collapsed}
        />

        {/* Divider */}
        {!collapsed && (
          <div className="px-2 pt-4 pb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nav-muted)" }}>
              Workspaces
            </span>
          </div>
        )}
        {collapsed && <div className="h-2" />}

        {/* Customer → Project hierarchy */}
        {loadingProjects && !collapsed && (
          <div className="flex items-center gap-2 px-2 py-2">
            <Loader2 size={11} className="animate-spin shrink-0" style={{ color: "var(--nav-muted)" }} />
            <span className="text-[11px] font-sans" style={{ color: "var(--nav-muted)" }}>Loading...</span>
          </div>
        )}

        {!loadingProjects && customers.map((c) => {
          const isCustomerOpen = openCustomerId === c.customer.id
          const hasActiveProject = c.projects.some((p) => toSlug(p.name) === activeProjectSlug)

          if (collapsed) {
            return (
              <div key={c.customer.id} className="flex flex-col gap-0.5">
                {c.projects.map((p) => {
                  const slug = toSlug(p.name)
                  const isProj = slug === activeProjectSlug
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${slug}`}
                      title={p.name}
                      className="w-full h-8 flex items-center justify-center rounded-lg transition-colors"
                      style={{
                        background: isProj ? "var(--nav-active-bg)" : "transparent",
                        color: isProj ? "var(--nav-active-fg)" : "var(--nav-muted)",
                      }}
                    >
                      <span className="text-[10px] font-bold font-sans">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )
          }

          return (
            <div key={c.customer.id} className="flex flex-col">
              {/* Customer header */}
              <button
                onClick={() => toggleCustomer(c.customer.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-sans font-semibold transition-all duration-150"
                style={{
                  color: "var(--nav-fg)",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = "var(--nav-hover-bg)"
                  el.style.transform = "scale(1.01)"
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = "transparent"
                  el.style.transform = "scale(1)"
                }}
              >
                <Building2 size={12} strokeWidth={2} className="shrink-0" />
                <span className="flex-1 text-left truncate">{c.customer.name}</span>
                <ChevronDown
                  size={10}
                  strokeWidth={2.5}
                  className="shrink-0 transition-transform duration-200"
                  style={{ transform: isCustomerOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </button>

              {/* Projects */}
              {isCustomerOpen && (
                <div className="flex flex-col gap-0.5 pl-3 mt-0.5 mb-1 border-l ml-3.5" style={{ borderColor: "var(--nav-border)" }}>
                  {c.projects.map((p) => {
                    const slug = toSlug(p.name)
                    const href = `/projects/${slug}`
                    const isExpanded = openProjectSlug === slug
                    const isActive = slug === activeProjectSlug

                    return (
                      <div key={p.id}>
                        <div className="flex items-center gap-0 rounded-lg overflow-hidden group/proj"
                          style={{ background: isActive ? "var(--nav-active-bg)" : "transparent" }}
                        >
                          {/* Expand chevron */}
                          <button
                            onClick={() => toggleProject(slug)}
                            className="shrink-0 px-1.5 py-1.5 rounded-l-lg transition-colors"
                            style={{ color: isActive ? "var(--nav-active-fg)" : "var(--nav-muted)" }}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--nav-hover-bg)" }}
                            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                          >
                            <ChevronDown
                              size={10}
                              strokeWidth={2.5}
                              className="transition-transform duration-150"
                              style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                            />
                          </button>
                          {/* Project name link */}
                          <Link
                            href={href}
                            className="flex-1 py-1.5 pr-2 text-[11px] font-sans font-semibold transition-all duration-150 truncate rounded-r-lg"
                            style={{ color: isActive ? "var(--nav-active-fg)" : "var(--nav-fg)" }}
                          >
                            {p.name}
                          </Link>
                        </div>

                        {/* Sub-nav */}
                        {isExpanded && (
                          <div className="flex flex-col gap-0.5 pl-2 mt-0.5 mb-1">
                            {PROJECT_NAV.map((item) => {
                              const subHref = `/projects/${slug}${item.suffix}`
                              const subActive = pathname === subHref || pathname.startsWith(subHref + "/")
                              return (
                                <Link
                                  key={subHref}
                                  href={subHref}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-sans font-medium transition-all duration-150"
                                  style={{
                                    color: subActive ? "var(--nav-active-fg)" : "var(--nav-fg)",
                                    background: subActive ? "var(--nav-active-bg)" : "transparent",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!subActive) {
                                      const el = e.currentTarget as HTMLAnchorElement
                                      el.style.background = "var(--nav-hover-bg)"
                                      el.style.transform = "scale(1.02)"
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!subActive) {
                                      const el = e.currentTarget as HTMLAnchorElement
                                      el.style.background = "transparent"
                                      el.style.transform = "scale(1)"
                                    }
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

                  {/* New project */}
                  <button
                    onClick={() => setNewProjectModal({ open: true, customerId: c.customer.id, customerName: c.customer.name })}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-sans font-medium transition-all duration-150"
                    style={{ color: "var(--nav-fg)", opacity: 0.6 }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = "var(--nav-hover-bg)"
                      el.style.opacity = "1"
                      el.style.transform = "scale(1.02)"
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = "transparent"
                      el.style.opacity = "0.6"
                      el.style.transform = "scale(1)"
                    }}
                  >
                    <Plus size={10} strokeWidth={2.5} />
                    New Project
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* New Project Modal */}
      {newProjectModal && (
        <NewProjectModal
          open={newProjectModal.open}
          onClose={() => setNewProjectModal(null)}
          customerFolderId={newProjectModal.customerId}
          customerName={newProjectModal.customerName}
          onProjectCreated={() => {
            loadProjects()
            setNewProjectModal(null)
          }}
        />
      )}

      {/* ── Bottom: settings + user ── */}
      <div
        className="shrink-0 px-3 py-3 flex flex-col gap-1"
        style={{ borderTop: "1px solid var(--nav-border)" }}
      >
        {BOTTOM_ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={pathname.startsWith(item.href)}
            collapsed={collapsed}
          />
        ))}

        {/* Demo mode badge */}
        {isDemoMode && !collapsed && (
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-1"
            style={{ background: "oklch(0.58 0.18 200 / 0.18)", border: "1px solid oklch(0.58 0.18 200 / 0.35)" }}
          >
            <FlaskConical size={11} strokeWidth={2} style={{ color: "oklch(0.80 0.16 200)" }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "oklch(0.80 0.16 200)" }}>
              Demo Mode
            </span>
          </div>
        )}

        {/* User row */}
        <div
          className="flex items-center gap-2.5 mt-1 px-2 py-2 rounded-xl"
          style={{ background: "var(--nav-hover-bg)" }}
        >
          <div
            className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-black font-sans"
            style={{ background: isDemoMode ? "oklch(0.58 0.18 200)" : "var(--primary)", color: "white" }}
          >
            {isDemoMode ? "D" : (displayName?.[0]?.toUpperCase() ?? "U")}
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 text-[11px] font-sans font-medium truncate" style={{ color: "var(--nav-fg)" }}>
                {displayName}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md p-1 transition-colors"
                style={{ color: "var(--nav-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--nav-fg)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--nav-muted)" }}
                aria-label="Logout"
              >
                <LogOut size={13} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({
  href, icon, label, active, collapsed,
}: {
  href: string; icon: React.ReactNode; label: string; active: boolean; collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-[13px] font-sans font-semibold transition-all duration-150"
      style={{
        color: active ? "var(--nav-active-fg)" : "var(--nav-fg)",
        background: active ? "var(--nav-active-bg)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          const el = e.currentTarget as HTMLAnchorElement
          el.style.background = "var(--nav-hover-bg)"
          el.style.color = "white"
          el.style.transform = "scale(1.02)"
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          const el = e.currentTarget as HTMLAnchorElement
          el.style.background = "transparent"
          el.style.color = "var(--nav-fg)"
          el.style.transform = "scale(1)"
        }
      }}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
