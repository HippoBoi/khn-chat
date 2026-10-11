import './SidebarButton.css';

interface SidebarButtonProps {
  onClick: () => void;
  open?: boolean;
}

export function SidebarButton({ onClick, open = false }: SidebarButtonProps) {
  return (
    <button
      type="button"
      className="sidebar-button"
      onClick={onClick}
      aria-label={open ? 'Close sidebar' : 'Open sidebar'}
      aria-expanded={open}
      aria-controls="chat-sidebar"
    >
        <i className="fa-solid fa-bars" aria-hidden="true"></i>
    </button>
  );
}