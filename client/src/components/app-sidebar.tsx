import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Layers,
  Sparkles,
  Megaphone,
  Mail,
  Crown,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Posts", url: "/posts", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Accounts", url: "/accounts", icon: Users },
  { title: "Brands", url: "/brands", icon: Layers },
  { title: "Suggestions", url: "/suggestions", icon: Sparkles },
  { title: "Ads", url: "/ads", icon: Megaphone },
  { title: "Newsletter", url: "/newsletter", icon: Mail },
];

const settingsItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isPro, openPaywall } = useSubscription();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt=""
            className="h-9 w-auto max-w-[140px] shrink-0 object-contain object-left"
            width={140}
            height={36}
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold" data-testid="text-app-name">Juice Trends</span>
            <span className="text-xs text-muted-foreground">Marketing Hub</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Preferences</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Upgrade CTA – only shown to free plan users */}
        {!isPro && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <button
                onClick={openPaywall}
                className={cn(
                  "w-full rounded-xl border border-primary/20 bg-primary/5 p-3 text-left",
                  "hover:bg-primary/10 transition-colors group",
                )}
                data-testid="button-sidebar-upgrade"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Crown className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-semibold">Upgrade to Pro</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage unlimited accounts, unlock advanced analytics & more.
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                  <Zap className="h-3 w-3" />
                  View plans
                </div>
              </button>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {(user?.name || "??")
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isPro && (
              <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                <Crown className="h-2 w-2 text-primary-foreground" />
              </div>
            )}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm font-medium truncate"
                data-testid="text-user-name"
              >
                {user?.name}
              </span>
              {isPro && (
                <Badge
                  variant="default"
                  className="h-4 px-1 text-[10px] bg-primary/20 text-primary border-0 shrink-0"
                >
                  Pro
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {user?.email}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => logout()}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
