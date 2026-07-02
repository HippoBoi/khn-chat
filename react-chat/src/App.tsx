import { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { useNotification } from './hooks/useNotification';
import { ConnectionStatus } from './components/ConnectionStatus';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { NotificationToast } from './components/NotificationToast';
import { UsernameForm } from './components/UsernameForm';
import { ProfilePicturePicker } from './components/ProfilePicturePicker';
import { useChatStore } from './store/useChatStore';
import { VIDEO_PLAYER_MEDIA_QUERY } from './utils/youtube';

import './App.css';
import { Title } from './components/Title';

type ThemePreference = 'light' | 'dark';

const THEME_STORAGE_KEY = 'chat-theme';

function getInitialTheme(): ThemePreference {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  useSocket();
  useNotification();
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);
  const [selectedYouTubeVideoId, setSelectedYouTubeVideoId] = useState<string | null>(null);
  const isChatVisible = useChatStore((s) => s.isChatVisible);
  const isDarkMode = theme === 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedYouTubeVideoId) return;

    const mediaQuery = window.matchMedia(VIDEO_PLAYER_MEDIA_QUERY);
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setSelectedYouTubeVideoId(null);
    };

    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, [selectedYouTubeVideoId]);

  const handleThemeToggle = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className={`app-layout${selectedYouTubeVideoId ? ' app-layout--with-video' : ''}`}>
      <main className="app-container">
        <nav className="app-navbar" aria-label="Chat status">
          <Title />
          <div className="navbar-actions">
            <ThemeToggle isDarkMode={isDarkMode} onToggle={handleThemeToggle} />
            <ConnectionStatus />
          </div>
        </nav>
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
        <MessageInput />
      </main>

      {selectedYouTubeVideoId ? (
        <aside className="video-panel" aria-label="YouTube video player">
          <div className="video-frame">
            <button
              type="button"
              className="video-close"
              onClick={() => setSelectedYouTubeVideoId(null)}
              aria-label="Close video player"
              title="Close video player"
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
    </div>
  );
}

interface ThemeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

function ThemeToggle({ isDarkMode, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDarkMode}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
    </button>
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
