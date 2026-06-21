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

type ThemePreference = 'light' | 'dark';

const THEME_STORAGE_KEY = 'chat-theme';

// Paste the Subway Surfers YouTube URL here.
const SUBWAY_SURFERS_YOUTUBE_URL = 'https://www.youtube.com/watch?v=zZ7AimPACzc';

function getYouTubeVideoId(url: string): string | null {
  if (!url.trim()) return null;

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === 'youtu.be') {
      return parsedUrl.pathname.slice(1).split('/')[0] || null;
    }

    if (parsedUrl.hostname.endsWith('youtube.com')) {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v');
      }

      const [, route, videoId] = parsedUrl.pathname.split('/');
      if (route === 'embed' || route === 'shorts') return videoId || null;
    }
  } catch {
    return null;
  }

  return null;
}

function getInitialTheme(): ThemePreference {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  useSocket();
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const isChatVisible = useChatStore((s) => s.isChatVisible);
  const isDarkMode = theme === 'dark';
  const youtubeVideoId = getYouTubeVideoId(SUBWAY_SURFERS_YOUTUBE_URL);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-layout">
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
        {isChatVisible ? <MessageList /> : <ConnectionLoading />}
        <MessageInput />
      </main>

      <aside className="video-panel" aria-label="Subway Surfers video">
        <button
          type="button"
          className="video-toggle"
          onClick={() => setIsVideoEnabled((isEnabled) => !isEnabled)}
          aria-pressed={isVideoEnabled}
        >
          {isVideoEnabled ? 'Hide video' : 'Show video'}
        </button>

        {isVideoEnabled ? (
          youtubeVideoId ? (
            <iframe
              className="video-player"
              src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${youtubeVideoId}&playsinline=1&rel=0`}
              title="Subway Surfers gameplay"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <p className="video-placeholder">
              Add a YouTube URL in <code>SUBWAY_SURFERS_YOUTUBE_URL</code>.
            </p>
          )
        ) : null}
      </aside>
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
