import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Settings, Tags, Wallet, ArrowLeftRight, Coins, BarChart3, LineChart, TrendingUp, Target, BookOpen, PiggyBank } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader } from "@/components/ui/sidebar";

const navMain = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Budget Planner", url: "/budget", icon: Wallet },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Net Worth Tracker", url: "/networth", icon: Coins },
];
const navAnalytics = [
  { title: "Budget Dashboard", url: "/budget-dashboard", icon: BarChart3 },
  { title: "Net Worth Dashboard", url: "/networth-dashboard", icon: LineChart },
  { title: "Projection Planner", url: "/projection", icon: TrendingUp },
  { title: "Goals", url: "/goals", icon: Target },
];
const navConfig = [
  { title: "Categories", url: "/categories", icon: Tags },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help / Notes", url: "/help", icon: BookOpen },
];

export function AppSidebar() {
  const path = useRouterState({ select: r => r.location.pathname });
  const isActive = (url: string) => url === "/" ? path === "/" : path.startsWith(url);

  const renderGroup = (label: string, items: typeof navMain) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Ledger</span>
            <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Personal Finance OS</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Workspace", navMain)}
        {renderGroup("Analytics", navAnalytics)}
        {renderGroup("Configuration", navConfig)}
      </SidebarContent>
    </Sidebar>
  );
}
