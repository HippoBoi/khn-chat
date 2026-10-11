import './UsernameForm.css';

export const MAX_USERNAME_LENGTH = 12;

interface UsernameFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function UsernameForm({ value, onChange, onSubmit }: UsernameFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
  };

  const isUsernameTooLong = value.trim().length > MAX_USERNAME_LENGTH;

  return (
    <div className='form-container input-container'>
      <h3>Username: {value.trim() || 'unnamed'}</h3>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Username"
        maxLength={MAX_USERNAME_LENGTH}
        aria-invalid={isUsernameTooLong}
      />
    </div>
  );
}
