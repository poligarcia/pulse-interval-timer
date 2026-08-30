export type AppIconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'flame'
  | 'history'
  | 'home'
  | 'progress'
  | 'reset'
  | 'settings'
  | 'target'
  | 'timer'
  | 'trophy';

type AppIconProps = {
  name: AppIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

function IconPaths({ name }: Pick<AppIconProps, 'name'>) {
  switch (name) {
    case 'arrow-left':
      return <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>;
    case 'arrow-right':
      return <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>;
    case 'calendar':
      return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="m9 15 2 2 4-4" /></>;
    case 'check':
      return <path d="m5 12 4 4L19 6" />;
    case 'chevron-down':
      return <path d="m7 10 5 5 5-5" />;
    case 'chevron-up':
      return <path d="m7 14 5-5 5 5" />;
    case 'flame':
      return <path d="M12 22c4.4 0 7-3.1 7-7.2 0-3.2-1.6-5.8-4.7-8.5.1 2.2-.9 3.7-2.2 4.4.2-3.5-1.8-6.5-5-8.7.2 3.6-2.1 5.3-2.1 8.8C5 17 7.8 22 12 22Z" />;
    case 'history':
      return <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>;
    case 'home':
      return <><path d="m3.5 10.5 8.5-7 8.5 7" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></>;
    case 'progress':
      return <><path d="m4 17 6-6 4 4 6-7" /><path d="M15 8h5v5" /></>;
    case 'reset':
      return <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></>;
    case 'settings':
      return <><circle cx="12" cy="12" r="3" /><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4A2 2 0 0 0 4 9.9l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" /></>;
    case 'target':
      return <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>;
    case 'timer':
      return <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.8 1.8M9 2h6M12 5V2" /></>;
    case 'trophy':
      return <><path d="M8 3h8v4c0 4-1.8 6-4 6s-4-2-4-6V3Z" /><path d="M8 5H4v2c0 2.2 1.8 4 4 4M16 5h4v2c0 2.2-1.8 4-4 4M12 13v4M8 21h8M9 17h6" /></>;
  }
}

export function AppIcon({ name, size = 24, strokeWidth = 1.8, className }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `app-icon ${className}` : 'app-icon'}
      fill="none"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      <IconPaths name={name} />
    </svg>
  );
}
