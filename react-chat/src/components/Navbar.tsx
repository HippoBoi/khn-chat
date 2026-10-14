import { Title } from './Title';
import './Navbar.css';
import { SidebarButton } from './SidebarButton';
import { AccountButton } from './AccountButton';

interface NavbarProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
  onAccountClick: () => void;
  hasNewChat?: boolean;
}

function Navbar({ onMenuClick, sidebarOpen, onAccountClick, hasNewChat = false }: NavbarProps) {
    return (
        <div className="navbar">
            <div className="navbar-inner">
                <div className="navbar-side navbar-side--left">
                    <SidebarButton onClick={onMenuClick} open={sidebarOpen} hasNew={hasNewChat} />
                </div>
                <div className="navbar-center">
                    <Title />
                </div>
                <div className="navbar-side navbar-side--right">
                    <AccountButton onClick={onAccountClick} />
                </div>
            </div>
        </div>
    )
}

export default Navbar;