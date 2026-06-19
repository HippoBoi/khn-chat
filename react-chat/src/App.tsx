import { useSocket } from './hooks/useSocket';
import { ConnectionStatus } from './components/ConnectionStatus';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { UsernameForm } from './components/UsernameForm';
import { ProfilePicturePicker } from './components/ProfilePicturePicker';
import { useChatStore } from './store/useChatStore';

import './App.css';
import { Title } from './components/Title';

function App() {
  useSocket();
  const isChatVisible = useChatStore((s) => s.isChatVisible);

  return (
    <div className="app-container">
      <nav className="app-navbar" aria-label="Chat status">
        <Title />
        <ConnectionStatus />
      </nav>
      <section className="profile-settings" aria-label="Profile settings">
        <UsernameForm />
        <ProfilePicturePicker />
      </section>
      {isChatVisible ? (
        <MessageList />
      ) : (
        <div className="message-list">
          <p className="connection-message">Connecting to server...</p>
        </div>
      )}
      <MessageInput />
    </div>
  );
}

export default App;
