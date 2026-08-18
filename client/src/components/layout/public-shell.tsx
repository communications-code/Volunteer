import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { NavBar } from "@/components/layout/nav-bar";
import { LargeTitleHeader } from "@/components/layout/large-title-header";
import { cn } from "@/lib/utils";
import vfwLogo from "@assets/vfw/vfw-logo-full-color.svg";

interface PublicShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  topActions?: ReactNode;
  titleActions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  activeTab?: "needs";
  hideTabs?: boolean;
  chromeLess?: boolean;
  hideTopChrome?: boolean;
  hideNavTitle?: boolean;
  contentClassName?: string;
}

export function PublicShell({
  title,
  subtitle,
  children,
  topActions,
  titleActions,
  backHref,
  backLabel = "Back",
  activeTab = "needs",
  hideTabs = false,
  chromeLess = false,
  hideTopChrome = false,
  hideNavTitle = false,
  contentClassName,
}: PublicShellProps) {
  if (chromeLess) {
    return <main className={cn("mx-auto max-w-[1400px] px-4 py-4 sm:px-6 lg:px-8", contentClassName)}>{children}</main>;
  }

  return (
    <div className="clh-public-shell">
      <div className="clh-page-frame">
        {!hideTopChrome ? (
          <>
            <NavBar
              leading={
                backHref ? (
                  <Link href={backHref}>
                    <a className="clh-nav-button">
                      <ArrowLeft className="h-4 w-4" />
                      <span>{backLabel}</span>
                    </a>
                  </Link>
                ) : (
                  <Link href="/">
                    <a className="inline-flex items-center gap-2 rounded-2xl px-1 py-1 text-sm font-medium text-slate-700">
                      <img src={vfwLogo} alt="VFW Post 7570" className="h-8 w-auto" />
                      <span className="hidden text-sm font-semibold sm:inline">Serving Network</span>
                    </a>
                  </Link>
                )
              }
              title={hideNavTitle ? undefined : (
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>VFW Post 7570</span>
                </div>
              )}
              trailing={topActions}
            />

            {title || subtitle || titleActions ? (
              <LargeTitleHeader title={title || ""} subtitle={subtitle} actions={titleActions} />
            ) : null}
          </>
        ) : null}

        <main className={cn("pb-10", contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
