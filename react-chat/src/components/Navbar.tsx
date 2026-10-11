import { ConnectionStatus } from './ConnectionStatus';
import { Title } from './Title';
import './Navbar.css';
import { SidebarButton } from './SidebarButton';

interface NavbarProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

function Navbar({ onMenuClick, sidebarOpen }: NavbarProps) {
    return (
        <div className="navbar">
            <SidebarButton onClick={onMenuClick} open={sidebarOpen} />
            <Title />
            <ConnectionStatus />
        </div>
    )
}

export default Navbar;