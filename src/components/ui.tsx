import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  fullWidth?: boolean;
};

const buttonVariants = {
  primary:
    "bg-accent-primary text-white shadow-card hover:bg-accent-primary/90",
  secondary:
    "border border-line bg-surface text-text-primary hover:bg-background",
  ghost: "text-text-primary hover:bg-accent-primary/8",
};

export function Button({
  children,
  className = "",
  disabled,
  fullWidth = false,
  loading = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`tap-target inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-pill border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated" | "outlined";
};

const cardVariants = {
  default: "border border-line/70 bg-surface shadow-card",
  elevated: "bg-surface shadow-raised",
  outlined: "border border-line bg-transparent",
};

export function Card({
  className = "",
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-lg ${cardVariants[variant]} ${className}`}
      {...props}
    />
  );
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "primary" | "sage" | "online" | "danger";
};

const badgeTones = {
  neutral: "bg-line/55 text-text-secondary",
  primary: "bg-accent-primary/12 text-accent-primary",
  sage: "bg-accent-secondary/12 text-accent-secondary",
  online: "bg-online/12 text-online",
  danger: "bg-danger/12 text-danger",
};

export function Badge({
  className = "",
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-pill px-3 py-1 text-caption font-semibold leading-none ${badgeTones[tone]} ${className}`}
      {...props}
    />
  );
}

export function Pill(props: BadgeProps) {
  return <Badge {...props} />;
}

type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function SectionHeader({
  action,
  className = "",
  description,
  eyebrow,
  title,
  ...props
}: SectionHeaderProps) {
  return (
    <header className={`flex items-end justify-between gap-4 ${className}`} {...props}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-caption font-bold tracking-[0.16em] text-accent-primary uppercase">
            {eyebrow}
          </p>
        )}
        <h2 className="font-editorial text-section font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function MobileShell({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mx-auto min-h-svh w-full max-w-mobile bg-background ${className}`}
      {...props}
    />
  );
}

type BottomNavProps = HTMLAttributes<HTMLElement> & {
  activeHref: "/home" | "/schedule" | "/album" | "/cards";
};

const bottomNavItems = [
  { href: "/home", icon: "home", label: "홈" },
  { href: "/schedule", icon: "schedule", label: "일정" },
  { href: "/album", icon: "album", label: "앨범" },
  { href: "/cards", icon: "card", label: "카드" },
] as const;

function BottomNavIcon({ icon }: { icon: (typeof bottomNavItems)[number]["icon"] }) {
  const paths = {
    home: <path d="m3.5 11 8.5-7 8.5 7v8.5h-6v-5h-5v5h-6z" />,
    schedule: (
      <>
        <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
        <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M7.5 14h2M14.5 14h2" />
      </>
    ),
    album: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8" cy="9" r="1.5" />
        <path d="m4.5 18 5-5 3.25 3.25 2.75-2.75 4 4" />
      </>
    ),
    card: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
        <path d="M12 17s-5-2.8-5-6.1C7 8 10.7 7.4 12 9.6 13.3 7.4 17 8 17 10.9 17 14.2 12 17 12 17Z" />
      </>
    ),
  } as const;

  return (
    <svg
      aria-hidden="true"
      className="bottom-nav-icon"
      data-icon={icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </svg>
  );
}

export function BottomNav({ activeHref, className = "", ...props }: BottomNavProps) {
  return (
    <nav
      aria-label="주요 탐색"
      className={`bottom-nav ${className}`}
      {...props}
    >
      <ul className="bottom-nav-list">
        {bottomNavItems.map(({ href, icon, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={activeHref === href ? "page" : undefined}
              className="bottom-nav-link"
            >
              <BottomNavIcon icon={icon} />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

export function LoadingState({
  className = "",
  label = "불러오는 중이에요",
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className={`flex min-h-32 flex-col items-center justify-center gap-3 text-center text-sm text-text-secondary ${className}`}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-pill border-2 border-accent-primary/25 border-r-accent-primary"
      />
      <span>{label}</span>
    </div>
  );
}

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  action,
  className = "",
  description,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-8 text-center ${className}`}
      {...props}
    >
      <span aria-hidden="true" className="mb-3 text-2xl text-accent-secondary">
        ◇
      </span>
      <h3 className="font-editorial text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type ToastProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  message?: string;
  tone?: "default" | "danger";
};

export function Toast({
  className = "",
  message,
  title,
  tone = "default",
  ...props
}: ToastProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-md border bg-surface px-4 py-3 shadow-raised ${tone === "danger" ? "border-danger/35" : "border-line"} ${className}`}
      {...props}
    >
      <span
        aria-hidden="true"
        className={`mt-1 size-2 shrink-0 rounded-pill ${tone === "danger" ? "bg-danger" : "bg-online"}`}
      />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {message && <p className="mt-0.5 text-caption text-text-secondary">{message}</p>}
      </div>
    </div>
  );
}
