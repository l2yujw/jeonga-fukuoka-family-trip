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
      className={`mobile-shell mx-auto min-h-svh w-full max-w-mobile bg-background ${className}`}
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
    home: (
      <>
        <path d="M2 14.5 18 4l16 10.5M5.5 13v14.3h9v-8.1h7v8.1h9V13" />
        <g className="bottom-nav-flower bottom-nav-flower--high">
          <circle cx="25.4" cy="7.4" r="2.5" />
          <circle cx="29.8" cy="7.4" r="2.5" />
          <circle cx="27.6" cy="4" r="2.5" />
          <circle cx="27.6" cy="10.8" r="2.5" />
          <circle cx="27.6" cy="7.4" r="1.5" />
        </g>
      </>
    ),
    schedule: (
      <>
        <rect x="2.5" y="5.5" width="28.5" height="23" rx="3.2" />
        <path d="M8.5 2.5v6.5M25.5 2.5v6.5M2.5 12h28.5" />
        <g className="bottom-nav-flower bottom-nav-flower--calendar">
          <circle cx="14.4" cy="21" r="2.5" />
          <circle cx="19.6" cy="21" r="2.5" />
          <circle cx="17" cy="17.2" r="2.5" />
          <circle cx="17" cy="24.8" r="2.5" />
          <circle cx="17" cy="21" r="1.5" />
        </g>
      </>
    ),
    album: (
      <>
        <rect x="3" y="4" width="27.5" height="24" rx="3.2" />
        <circle cx="10.6" cy="10.5" r="2.4" />
        <path d="m4.5 26 8.6-8.8 5.5 5.2 4.8-4.7 7.7 7.4" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="4" width="27.5" height="24" rx="3.2" />
        <path d="M16.75 22.8s-7.6-4.2-7.6-9c0-4.3 5.55-5.1 7.6-1.8 2.05-3.3 7.6-2.5 7.6 1.8 0 4.8-7.6 9-7.6 9Z" />
        <path className="bottom-nav-bookmark" d="M12.2 28v4l4.55-2.8L21.3 32v-4" />
        <g className="bottom-nav-flower bottom-nav-flower--low">
          <circle cx="37.5" cy="19" r="2" />
          <circle cx="41.2" cy="19" r="2" />
          <circle cx="39.3" cy="16" r="2" />
          <circle cx="39.3" cy="21.9" r="2" />
          <circle cx="39.3" cy="19" r="1.1" />
        </g>
      </>
    ),
  } as const;

  return (
    <svg
      aria-hidden="true"
      className="bottom-nav-icon"
      data-icon={icon}
      viewBox="0 0 34 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
      <g
        className="bottom-nav-leaves"
        transform={icon === "card" ? "translate(14.2 16) scale(.55 .47)" : undefined}
      >
        <path d="M31.5 29.2c3.1-1.7 6.1-4.6 9.4-9" />
        <ellipse cx="34.2" cy="26.7" rx="3.2" ry="1.7" transform="rotate(23 34.2 26.7)" />
        <ellipse cx="38.5" cy="23.7" rx="3.2" ry="1.7" transform="rotate(-43 38.5 23.7)" />
        <ellipse cx="41.6" cy="21" rx="2.8" ry="1.5" transform="rotate(-35 41.6 21)" />
      </g>
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
