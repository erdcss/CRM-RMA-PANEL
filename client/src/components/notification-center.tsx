import { Bell, CheckCheck, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

export function NotificationCenter() {
  const {
    notifications,
    markAllNotificationsRead,
    clearNotifications,
  } = useToast()
  const [open, setOpen] = useState(false)

  const unreadCount = notifications.filter((notification) => !notification.read).length

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      markAllNotificationsRead()
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Bildirimler"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Bildirimler</p>
            <p className="text-xs text-muted-foreground">
              Son {notifications.length} bildirim
            </p>
          </div>

          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={clearNotifications}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Temizle
            </button>
          ) : null}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <CheckCheck className="h-5 w-5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-medium">Yeni bildirim yok</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sistem bildirimleri burada listelenecek.
                </p>
              </div>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40"
              >
                <span
                  className={
                    notification.variant === "destructive"
                      ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive"
                      : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                  }
                />
                <div className="min-w-0 flex-1">
                  {notification.title ? (
                    <div className="text-sm font-medium leading-snug">
                      {notification.title}
                    </div>
                  ) : null}
                  {notification.description ? (
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {notification.description}
                    </div>
                  ) : null}
                  <div className="mt-1.5 text-[11px] text-muted-foreground/80">
                    {new Date(notification.createdAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
