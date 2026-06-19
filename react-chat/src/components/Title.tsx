
import './Title.css';
import logo from '../assets/icon.svg';

export function Title() {
  return (
    <div className='title-container'>
      <h1>KHN Chat</h1>
      <img src={logo} alt="React" className="react-logo" />
    </div>
  );
}
