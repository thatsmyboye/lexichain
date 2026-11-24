import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Top-center keeps toasts clear of the pinned action bar on phones;
      // they pause on hover/focus and can be dismissed.
      position="top-center"
      // Start below the status bar and Dynamic Island when the page runs edge
      // to edge (the iOS app, or installed to the home screen). The inset is
      // 0 in a normal browser tab, which leaves Sonner's default spacing.
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      visibleToasts={3}
      closeButton
      duration={3000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
