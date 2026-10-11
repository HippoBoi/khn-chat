import { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { useNotification } from './hooks/useNotification';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { NotificationToast } from './components/NotificationToast';
import { UsernameForm } from './components/UsernameForm';
import { ProfilePicturePicker } from './components/ProfilePicturePicker';
import { ChatList } from './components/ChatList';
import { ChatCreationModal } from './components/ChatCreationModal';
import { useChatStore } from './store/useChatStore';
import { useConversationStore } from './store/useConversationStore';
import { useAppUpdateCheck } from './hooks/useAppUpdateCheck';
import { UpdatePrompt } from './components/UpdatePrompt';
import { VIDEO_PLAYER_MEDIA_QUERY } from './utils/youtube';

import './App.css';
import Navbar from './components/Navbar';

function App() {
  useSocket();
  useNotification();
  const [selectedYouTubeVideoId, setSelectedYouTubeVideoId] = useState<string | null>(null);
  const [isCreationOpen, setIsCreationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isOutdated, currentVersionName, latest, dismiss } = useAppUpdateCheck();
  const isChatVisible = useChatStore((s) => s.isChatVisible);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    if (!selectedYouTubeVideoId) return;

    const mediaQuery = window.matchMedia(VIDEO_PLAYER_MEDIA_QUERY);
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setSelectedYouTubeVideoId(null);
    };

    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, [selectedYouTubeVideoId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 901px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsSidebarOpen(false);
    };

    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  return (
    <>
    <Navbar onMenuClick={() => setIsSidebarOpen((v) => !v)} sidebarOpen={isSidebarOpen} />
    <div className={`app-layout${selectedYouTubeVideoId ? ' app-layout--with-video' : ''}`}>
      <ChatList
        onCreateClick={() => setIsCreationOpen(true)}
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="app-container">
        {isChatVisible ? (
          <section className="profile-settings" aria-label="Profile settings">
            <UsernameForm />
            <ProfilePicturePicker />
          </section>
        ) : null}
        {isChatVisible ? (
          <MessageList onYouTubeVideoSelect={setSelectedYouTubeVideoId} />
        ) : (
          <ConnectionLoading />
        )}
        {activeConversation ? (
          <p className="active-conversation-label" aria-live="polite">
            {activeConversation.name}
          </p>
        ) : null}
        <MessageInput />
      </main>

      {selectedYouTubeVideoId ? (
        <aside className="video-panel" aria-label="YouTube video player">
          <div className="video-frame">
            <button
              type="button"
              className="video-close"
              onClick={() => setSelectedYouTubeVideoId(null)}
              aria-label="Close video"
              title="Close video"
            >
              X
            </button>
            <iframe
              key={selectedYouTubeVideoId}
              className="video-player"
              src={`https://www.youtube-nocookie.com/embed/${selectedYouTubeVideoId}?playsinline=1&rel=0`}
              title="YouTube video player"
              allow="encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </aside>
      ) : null}
      <NotificationToast />
      <ChatCreationModal open={isCreationOpen} onClose={() => setIsCreationOpen(false)} />
      {isOutdated && latest ? (
        <UpdatePrompt currentVersionName={currentVersionName} latest={latest} onLater={dismiss} />
      ) : null}
    </div>
    </>
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
