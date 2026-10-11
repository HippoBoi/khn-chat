import { Title } from './Title';
import './Navbar.css';
import { SidebarButton } from './SidebarButton';
import { AccountButton } from './AccountButton';

interface NavbarProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
  onAccountClick: () => void;
}

function Navbar({ onMenuClick, sidebarOpen, onAccountClick }: NavbarProps) {
    return (
        <div className="navbar">
            <SidebarButton onClick={onMenuClick} open={sidebarOpen} />
            <Title />
            <AccountButton onClick={onAccountClick} />
        </div>
    )
}

export default Navbar;