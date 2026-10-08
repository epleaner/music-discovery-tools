import { Component, createSignal, createUniqueId } from 'solid-js';
import Button from './Button';
import Input from './Input';

interface UsernameInputProps {
  onSubmit: (username: string) => void;
  initialUsername?: string;
}

const UsernameInput: Component<UsernameInputProps> = (props) => {
  const [localUsername, setLocalUsername] = createSignal(
    props.initialUsername || ''
  );
  const usernameId = createUniqueId();

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const username = localUsername().trim();
    if (username) {
      props.onSubmit(username);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="toolbar">
      <label for={usernameId} class="field-label">
        Last.fm
      </label>
      <Input
        id={usernameId}
        name="lastfm-username"
        type="text"
        autocomplete="username"
        autocapitalize="none"
        spellcheck={false}
        required
        value={localUsername()}
        onInput={(e) => setLocalUsername(e.currentTarget.value)}
        placeholder="Username"
        class="min-w-0 flex-1"
      />
      <Button type="submit" variant="secondary">
        Load
      </Button>
    </form>
  );
};

export default UsernameInput;
