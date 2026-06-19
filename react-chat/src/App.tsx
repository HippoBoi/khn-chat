import { useEffect, useState } from 'react';
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
      {isChatVisible ? (
        <section className="profile-settings" aria-label="Profile settings">
          <UsernameForm />
          <ProfilePicturePicker />
        </section>
      ) : null}
      {isChatVisible ? <MessageList /> : <ConnectionLoading />}
      <MessageInput />
    </div>
  );
}

function ConnectionLoading() {
  const [showInitializingMessage, setShowInitializingMessage] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowInitializingMessage(true);
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="message-list">
      <div className="connection-loading">
        <p className="connection-message">Connecting to server...</p>
        <span className="connection-spinner" aria-label="Connecting" />
        {showInitializingMessage ? (
          <p className="connection-initializing-message">
            Server initializing, please wait a bit... 🥲
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default App;
