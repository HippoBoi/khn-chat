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

  if (!isChatVisible) {
    return (
      <div className="app-container">
        <p>Connecting to server...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Title />
      <ConnectionStatus />
      <UsernameForm />
      <ProfilePicturePicker />
      <MessageList />
      <MessageInput />
    </div>
  );
}

export default App;
