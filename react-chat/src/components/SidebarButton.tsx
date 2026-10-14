import './SidebarButton.css';

interface SidebarButtonProps {
  onClick: () => void;
  open?: boolean;
  hasNew?: boolean;
}

export function SidebarButton({ onClick, open = false, hasNew = false }: SidebarButtonProps) {
  return (
    <button
      type="button"
      className={`sidebar-button${hasNew ? ' has-new' : ''}`}
      onClick={onClick}
      aria-label={open ? 'Close sidebar' : hasNew ? 'Open sidebar (new chat)' : 'Open sidebar'}
      aria-expanded={open}
      aria-controls="chat-sidebar"
    >
        <i className="fa-solid fa-bars" aria-hidden="true"></i>
        {hasNew ? (
          <span className="sidebar-button-badge" aria-hidden="true">
            <i className="fa-solid fa-circle" aria-hidden="true"></i>
          </span>
        ) : null}
    </button>
  );
}